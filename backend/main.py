import os
import time
import json
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
import crud, models, schemas, ai_service, semantic_search
from database import Base, engine, get_db
from sqlalchemy.orm import Session
import pathlib

# ensure uploads directory exists
BASE_DIR = pathlib.Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

Base.metadata.create_all(bind=engine)

FRONTEND_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://zomato-notes-capstone-project.vercel.app",
]

app = FastAPI(title="Zomato Notes API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# mount attachments static directory
app.mount("/attachments", StaticFiles(directory=str(UPLOADS_DIR)), name="attachments")


class ProcessTimeMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.time()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                process_time = time.time() - start
                headers = message.setdefault("headers", [])
                headers.append((b"x-process-time", str(process_time).encode()))
            await send(message)

        await self.app(scope, receive, send_wrapper)


app.add_middleware(ProcessTimeMiddleware)


def simulate_indexing(note_id: int) -> None:
    time.sleep(2)
    logging.info(f"Indexed note {note_id} in background")


def note_to_dict(note: models.Note) -> dict:
    attachment_url = None
    pattern = f"{note.id}_*"
    candidates = list(UPLOADS_DIR.glob(pattern))
    if candidates:
        latest = max(candidates, key=lambda p: p.stat().st_mtime)
        attachment_url = f"/attachments/{latest.name}"

    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tag": note.tag or "",
        "owner_id": note.owner_id,
        "created_at": note.created_at.isoformat(),
        "attachment_url": attachment_url,
    }

@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = crud.create_user(db, user)
        
        return { 
            "id": db_user.id,
            "name": db_user.name,
            "email": db_user.email,
            "created_at": db_user.created_at.isoformat(),
        }
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A user with that email already exists")
        
    except Exception as exc:
        db.rollback()
        logging.exception("User creation failed")
        raise HTTPException(
            status_code=500,
            detail="Unable to create user"
        )

@app.post("/auth/login", response_model=schemas.LoginResponse)
def login_user(login: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, login.email, login.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"id": user.id, "name": user.name, "email": user.email}


@app.put("/users/{user_id}/email", response_model=schemas.LoginResponse)
def update_user_email(user_id: int, payload: schemas.UserEmailUpdate, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = crud.get_user_by_email(db, payload.email)
    if existing and existing.id != user.id:
        raise HTTPException(status_code=400, detail="A user with that email already exists")

    updated = crud.update_user_email(db, user, payload.email)
    return {"id": updated.id, "name": updated.name, "email": updated.email}


@app.post("/notes", response_model=schemas.NoteCreateResponse)
def create_note(
    note: schemas.NoteCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    owner = crud.get_user(db, note.owner_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Owner not found")
    db_note = crud.create_note(db, note)
    ai_suggestion = None
    try:
        raw_response = ai_service.get_ai_response(db_note.content, ai_service.AI_PROMPT_TEMPLATE)
        parsed = json.loads(raw_response)
        ai_suggestion = schemas.AISuggestion(**parsed)
    except Exception as exc:
        logging.warning("AI suggestion parse failed: %s", exc)
        logging.warning("Raw AI response: %s", raw_response if 'raw_response' in locals() else "<none>")
        ai_suggestion = None
    background_tasks.add_task(simulate_indexing, db_note.id)
    return {**note_to_dict(db_note), "ai_suggestion": ai_suggestion}


@app.get("/notes", response_model=List[schemas.NoteOut])
def list_notes(tag: Optional[str] = None, db: Session = Depends(get_db)):
    notes = crud.get_notes(db, tag=tag)
    return [note_to_dict(note) for note in notes]


@app.post("/notes/import")
def import_notes(owner_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    owner = crud.get_user(db, owner_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="Owner not found")
    contents = file.file.read().decode("utf-8")
    lines = [line.strip() for line in contents.splitlines()]
    blocks: list[list[str]] = []
    current_block: list[str] = []

    for line in lines:
        if not line:
            continue
        if line == "---":
            if current_block:
                blocks.append(current_block)
                current_block = []
            continue
        current_block.append(line)

    if current_block:
        blocks.append(current_block)

    created = []
    for block in blocks:
        if len(block) < 3:
            raise HTTPException(
                status_code=400,
                detail="Each note must include title, content, and tag on three lines separated by '---'",
            )

        title, content, tag = block[0], block[1], block[2]
        note_in = schemas.NoteCreate(title=title[:120], content=content, tag=tag, owner_id=owner_id)
        note = crud.create_note(db, note_in)
        created.append(note_to_dict(note))
    return {"imported": len(created), "notes": created}


@app.get("/reports/tag-summary")
def tag_summary(db: Session = Depends(get_db)):
    return crud.raw_tag_summary(db)


@app.get("/reports/long-notes")
def long_notes(db: Session = Depends(get_db)):
    return crud.raw_long_notes(db)


@app.get("/reports/user-notes")
def user_notes(db: Session = Depends(get_db)):
    return crud.raw_user_notes(db)


@app.get("/notes/search")
def note_search(keyword: Optional[str] = None, sort_by: Optional[str] = None, db: Session = Depends(get_db)):
    notes = [note_to_dict(note) for note in crud.get_notes(db)]
    if sort_by == "date":
        for note in notes:
            dt = datetime.fromisoformat(note["created_at"])
            note["created_at_epoch"] = int(dt.timestamp())
        from algorithms import insertion_sort_by_key
        return insertion_sort_by_key(notes, key="created_at_epoch")[:5]
    if keyword:
        keyword_lower = keyword.lower()
        for note in notes:
            note["score"] = note["content"].lower().count(keyword_lower)
        from algorithms import insertion_sort_by_key
        return insertion_sort_by_key(notes, key="score")[:5]
    raise HTTPException(status_code=400, detail="keyword or sort_by=date required")


@app.get("/notes/lookup")
def lookup_note(title: str, algo: str = "iterative", db: Session = Depends(get_db)):
    notes = crud.get_notes_ordered_by_title(db)
    titles = [note.title for note in notes]
    from algorithms import binary_search_iterative, binary_search_recursive
    if algo == "iterative":
        index = binary_search_iterative(titles, title)
    else:
        index = binary_search_recursive(titles, title, 0, len(titles) - 1)
    if index == -1:
        raise HTTPException(status_code=404, detail="Note not found")
    return note_to_dict(notes[index])


@app.get("/notes/quick-find")
def quick_find(tag: str, db: Session = Depends(get_db)):
    notes = [note_to_dict(note) for note in crud.get_notes(db)]
    from algorithms import linear_search
    found = linear_search(notes, key="tag", value=tag)
    if not found:
        raise HTTPException(status_code=404, detail="Note not found")
    return found


@app.get("/notes/smart-search")
def smart_search(q: str, db: Session = Depends(get_db)):
    notes = [note_to_dict(note) for note in crud.get_notes(db, tag="ai-demo")]
    if not notes:
        return []
    try:
        ranked = semantic_search.rank_notes_by_similarity(notes, q)
    except Exception as exc:
        logging.error("Smart search failed: %s", exc)
        raise HTTPException(status_code=503, detail="Smart search unavailable")
    return ranked[:3]


@app.get("/notes/{note_id:int}", response_model=schemas.NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note_to_dict(note)


@app.put("/notes/{note_id:int}", response_model=schemas.NoteOut)
def update_note(note_id: int, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = crud.get_note(db, note_id)
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    updated = crud.update_note(db, db_note, note_update)
    return note_to_dict(updated)


@app.delete("/notes/{note_id:int}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = crud.get_note(db, note_id)
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    crud.delete_note(db, note_id)
    logging.info("Deleted note %s", note_id)
    return JSONResponse(content={"detail": "Note deleted"})


@app.post("/notes/{note_id:int}/attachment")
async def upload_attachment(note_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    # sanitize filename
    filename = os.path.basename(file.filename)
    # prefix with note id and timestamp to avoid clashes
    ts = int(time.time())
    dest_name = f"{note_id}_{ts}_{filename}"
    dest_path = UPLOADS_DIR / dest_name
    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)
    # return URL to attachments mount
    url = f"/attachments/{dest_name}"
    return {"filename": dest_name, "url": url}


@app.delete("/notes/{note_id:int}/attachment")
def remove_attachment(note_id: int, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    pattern = f"{note_id}_*"
    removed = 0
    for file_path in UPLOADS_DIR.glob(pattern):
        try:
            file_path.unlink(missing_ok=True)
            removed += 1
        except OSError:
            continue

    return {"removed": removed}
