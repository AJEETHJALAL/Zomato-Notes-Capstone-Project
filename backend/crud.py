from sqlalchemy.orm import Session
from sqlalchemy import text, func, select
import models, schemas
from typing import List, Optional, Any


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(name=user.name, email=user.email, password=user.password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.get(models.User, user_id)


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.scalar(select(models.User).where(models.User.email == email))


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if user is None:
        return None
    if user.password != password:
        return None
    return user


def create_note(db: Session, note: schemas.NoteCreate) -> models.Note:
    db_note = models.Note(
        title=note.title.strip(),
        content=note.content.strip(),
        tag=(note.tag or "").strip(),
        owner_id=note.owner_id,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


def get_note(db: Session, note_id: int) -> Optional[models.Note]:
    return db.get(models.Note, note_id)


def get_notes(db: Session, tag: Optional[str] = None) -> List[models.Note]:
    if tag:
        return db.scalars(select(models.Note).where(models.Note.tag == tag)).all()
    return db.scalars(select(models.Note)).all()


def update_note(db: Session, db_note: models.Note, note_update: schemas.NoteUpdate) -> models.Note:
    if note_update.title is not None:
        db_note.title = note_update.title.strip()
    if note_update.content is not None:
        db_note.content = note_update.content.strip()
    if note_update.tag is not None:
        db_note.tag = note_update.tag.strip()
    db.commit()
    db.refresh(db_note)
    return db_note


def delete_note(db: Session, note_id: int) -> None:
    note = get_note(db, note_id)
    if note:
        db.delete(note)
        db.commit()


def raw_tag_summary(db: Session) -> List[Any]:
    query = text("SELECT tag, COUNT(*) as count FROM notes GROUP BY tag HAVING COUNT(*) > 1")
    return [dict(row) for row in db.execute(query).mappings().all()]


def raw_long_notes(db: Session) -> List[Any]:
    query = text(
        "SELECT id, title, content, tag, owner_id, created_at FROM notes WHERE LENGTH(content) > (SELECT AVG(LENGTH(content)) FROM notes)"
    )
    return [dict(row) for row in db.execute(query).mappings().all()]


def raw_user_notes(db: Session) -> List[Any]:
    query = text(
        "SELECT users.id as user_id, users.name as user_name, users.email as email, COUNT(notes.id) as note_count "
        "FROM users JOIN notes ON users.id = notes.owner_id GROUP BY users.id, users.name, users.email"
    )
    return [dict(row) for row in db.execute(query).mappings().all()]


def get_notes_ordered_by_title(db: Session) -> List[models.Note]:
    return db.scalars(select(models.Note).order_by(models.Note.title.asc())).all()
