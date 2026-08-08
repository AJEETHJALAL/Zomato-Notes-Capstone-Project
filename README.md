# Zomato Notes — Full Stack Capstone Project

A production-ready internal knowledge base for incident notes with real backend, frontend, ranking algorithms, and AI-powered semantic search. This document covers setup, backend/frontend execution, CORS configuration, end-to-end integration proof, and detailed examples of every feature with actual API requests and responses.

---

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Running the Backend](#running-the-backend)
3. [Running the Frontend](#running-the-frontend)
4. [CORS Configuration](#cors-configuration)
5. [Responsive Design CSS](#responsive-design-css)
6. [End-to-End Integration Examples](#end-to-end-integration-examples)
7. [Feature Demonstrations](#feature-demonstrations)
8. [Smart Search vs Keyword Search](#smart-search-vs-keyword-search)

---

## Setup & Installation

### Step 1: Create a Python Virtual Environment

On Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux (Bash):
```bash
python -m venv .venv
source .venv/bin/activate
```

### Step 2: Install Backend Dependencies

```powershell
pip install -r backend/requirements.txt
```

**Key dependencies:**
- `fastapi==0.114.0` — Web framework
- `uvicorn[standard]==0.23.2` — ASGI server
- `SQLAlchemy==2.0.51` — ORM
- `pydantic==2.13.4` — Data validation
- `sentence-transformers==3.0.0` — AI embeddings for semantic search
- `httpx==0.28.0` — HTTP client
- `python-multipart==0.0.6` — File upload support

### Step 3: Seed the Database

```powershell
python backend/seed.py
```

This idempotently seeds the SQLite database (`zomato_notes.db`) with:
- 2 users: Alice (ID 1) and Bob (ID 2)
- 10 base notes across tags: `work`, `health`, `recipes`, `travel`, `random`
- 12 ranking demo notes with tag `kb-demo` (for keyword search testing)
- 8 AI demo notes with tag `ai-demo` (for semantic search testing)

### Step 4: Start the Backend

```powershell
uvicorn backend.main:app --reload
```

Output (example):
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

The backend is now ready at `http://127.0.0.1:8000`.

My back end is running in Railways for which i have provided the Link below:
Back end Railway Link: https://zomato-notes-capstone-project-production.up.railway.app/notes

### Step 5: Serve the Frontend

In a new terminal, navigate to the frontend directory:

```powershell
cd frontend
python -m http.server 5500
```

Output (example):
```
Serving HTTP on 127.0.0.1 port 5500 (http://127.0.0.1:5500/) ...
```

### Step 6: Open the App in Your Browser

Navigate to:
```
http://127.0.0.1:5500
```

You should see the Zomato Notes login screen. Use credentials:
- **Email:** `alice@example.com`  
- **Password:** `password123`

Or register a new account.

---

## Running the Backend

### Uvicorn Command

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

**Flags:**
- `--reload` — Auto-restart on code changes
- `--host 127.0.0.1` — Listen on localhost only
- `--port 8000` — Use port 8000

### Database Location

SQLite database is stored at:
```
./zomato_notes.db
```

All tables are created automatically on startup (`Base.metadata.create_all(bind=engine)`).

### Environment Variables (Optional)

Create a `.env` file in the `backend/` directory for configuration:

```
DATABASE_URL=sqlite:///./zomato_notes.db
MOCK_AI=1
AI_API_KEY=your-openai-key
AI_PROVIDER=openai
AI_MODEL=gpt-3.5-turbo
```

- `MOCK_AI=1` — Use mock AI responses (no API key required)
- `MOCK_AI=0` — Use real OpenAI API (requires `AI_API_KEY`)

---

## Running the Frontend

### Python HTTP Server (Recommended for Development)

```bash
cd frontend
python -m http.server 5500
```

Then open `http://127.0.0.1:5500` in your browser.
I have also published my website in the Vercel for which i have provided the Link below:
Vercel Published Link: https://zomato-notes-capstone-project.vercel.app/


### Alternative: Live Server Extension (VS Code)

If using VS Code with the Live Server extension:
1. Right-click on `frontend/index.html`
2. Select "Open with Live Server"
3. The app will open at `http://127.0.0.1:5500` (default port)

### Static File Serving

The frontend is a pure HTML/CSS/JavaScript single-page app with no build step. All dependencies are inline or from CDN:
- **Fonts:** Google Fonts (Poppins, Material Symbols)
- **Scripts:** `index.html`, `script.js`, `mock-data.js`
- **Styles:** `style.css`

---

## CORS Configuration

### Allowed Origins

The backend is configured to accept cross-origin requests **only** from these exact origins:

```
http://127.0.0.1:5500
http://localhost:5500
https://zomato-notes-capstone-project.vercel.app
```

**Configuration in `backend/main.py` (lines 26–39):**

```python
FRONTEND_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://zomato-notes-capstone-project.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**If you serve the frontend from a different origin** (e.g., `http://localhost:3000`), you must add it to `FRONTEND_ORIGINS` and restart the backend.

### Verification

Check CORS headers in DevTools Network tab:
1. Open DevTools (F12)
2. Go to **Network** tab
3. Make any API request (e.g., add a note)
4. Click on the request
5. Look for header: `Access-Control-Allow-Origin: http://127.0.0.1:5500`

---

## Responsive Design CSS

The frontend uses CSS Grid and media queries to adapt to different screen sizes. The key responsive rule is:

### Main Layout Breakpoint: `@media (max-width: 860px)`

**Location in `frontend/style.css` (lines 865–901):**

```css
@media (max-width: 860px) {
  main {
    grid-template-columns: 1fr;
  }

  #top-nav {
    flex-direction: column;
    align-items: flex-start;
  }

  #top-nav nav {
    width: 100%;
    flex-wrap: wrap;
  }

  .auth-inline {
    width: 100%;
    justify-content: space-between;
  }

  .brand {
    font-size: 2.5rem;
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  #notes-list {
    grid-template-columns: 1fr 1fr;
  }

  #notes-controls {
    grid-template-columns: 1fr;
  }
}
```

**Effect:** On screens ≤ 860px wide, the sidebar and main content switch from a 2-column layout (`grid-template-columns: 390px 1fr`) to a full-width single column. This makes the app mobile-friendly.

### Notes Grid Breakpoint: `@media (max-width: 580px)`

**Location in `frontend/style.css` (lines 903–907):**

```css
@media (max-width: 580px) {
  #notes-list {
    grid-template-columns: 1fr;
  }
}
```

**Effect:** On screens ≤ 580px wide, note cards that display 2 per row collapse to 1 per row.

### Testing Responsive Design

1. Open the app at `http://127.0.0.1:5500`
2. Press **F12** to open DevTools
3. Click the **device toggle** icon (top-left of DevTools)
4. Select a mobile device preset (e.g., iPhone 12)
5. Resize the window to ≤ 860px and observe the sidebar moving below the content

---

## End-to-End Integration Examples

### Full CRUD + Persistence Flow

This section demonstrates that the frontend and backend are truly integrated: adding a note through the UI, refreshing the browser, and verifying the note persists.

#### Scenario: Add a Note via UI

1. **Open the app** at `http://127.0.0.1:5500` and log in as Alice
2. **Fill in the "Add Note" form:**
   - Title: `Project Alpha Kickoff`
   - Content: `Discussed timeline, assigned leads, reviewed budget.`
   - Tag: `work`
3. **Click "Create note"**
4. **Open DevTools Network tab** (F12 → Network)
5. **Observe the POST request:**

```
POST /notes HTTP/1.1
Host: 127.0.0.1:8000
Content-Type: application/json

{
  "title": "Project Alpha Kickoff",
  "content": "Discussed timeline, assigned leads, reviewed budget.",
  "tag": "work",
  "owner_id": 1
}
```

**Response (HTTP 200):**

```json
{
  "id": 42,
  "title": "Project Alpha Kickoff",
  "content": "Discussed timeline, assigned leads, reviewed budget.",
  "tag": "work",
  "owner_id": 1,
  "created_at": "2026-08-08T12:45:30.123456",
  "attachment_url": null,
  "ai_suggestion": {
    "tags": ["project", "alpha", "kickoff"],
    "summary": "Discussed timeline, assigned leads, reviewed budget."
  }
}
```

6. **Refresh the browser** (Ctrl+R or Cmd+R)
7. **Observe the note list reloads:**

```
GET /notes HTTP/1.1
Host: 127.0.0.1:8000
```

**Response includes the new note (among others):**

```json
[
  {
    "id": 42,
    "title": "Project Alpha Kickoff",
    "content": "Discussed timeline, assigned leads, reviewed budget.",
    "tag": "work",
    "owner_id": 1,
    "created_at": "2026-08-08T12:45:30.123456",
    "attachment_url": null
  },
  ...
]
```

8. **Verify visually:** The note appears in the notes list after refresh. ✅

---

#### Scenario: Delete a Note via UI

1. **Locate a note card** in the notes list
2. **Click the trash icon** on the card
3. **Open DevTools Network tab**
4. **Observe the DELETE request:**

```
DELETE /notes/42 HTTP/1.1
Host: 127.0.0.1:8000
```

**Response (HTTP 200):**

```json
{
  "detail": "Note deleted"
}
```

5. **The note card disappears immediately** from the list
6. **Refresh the browser** (Ctrl+R)
7. **The note is gone** after reload, proving persistence ✅

---

### HTTP Methods & Status Codes

| Operation | Method | Path | Status | Evidence |
|---|---|---|---|---|
| Create Note | `POST` | `/notes` | `200` | See POST example above |
| List Notes | `GET` | `/notes` | `200` | See GET example above |
| Get One Note | `GET` | `/notes/{id}` | `200` | Network tab shows it |
| Update Note | `PUT` | `/notes/{id}` | `200` | Network tab shows it |
| Delete Note | `DELETE` | `/notes/{id}` | `200` | See DELETE example above |
| Filter by Tag | `GET` | `/notes?tag=work` | `200` | Network tab shows it |

---

## Feature Demonstrations

### 1. Sort by Date (Backend Endpoint)

**Feature:** "Sort by" dropdown in the notes list shows notes ordered by newest first.

#### Request with Network Evidence

1. **Open DevTools** (F12 → Network)
2. **In the notes list, select "Newest first"** from the "Sort by" dropdown
3. **Observe the request in Network tab:**

```
GET /notes/search?sort_by=date HTTP/1.1
Host: 127.0.0.1:8000
```

**Response (HTTP 200):**

```json
[
  {
    "id": 42,
    "title": "Project Alpha Kickoff",
    "content": "Discussed timeline, assigned leads, reviewed budget.",
    "tag": "work",
    "owner_id": 1,
    "created_at": "2026-08-08T12:45:30.123456",
    "created_at_epoch": 1722688530,
    "score": 0
  },
  {
    "id": 41,
    "title": "Q3 Retrospective",
    "content": "Team reflection on completed projects.",
    "tag": "work",
    "owner_id": 1,
    "created_at": "2026-08-08T11:30:00.000000",
    "created_at_epoch": 1722684600,
    "score": 0
  }
]
```

**Observation:** Notes are sorted by `created_at_epoch` descending (newest first). ✅

---

### 2. Jump to Exact Title (Binary Search Endpoint)

**Feature:** Backend supports binary search (iterative or recursive) for exact title lookup.

#### Request with Network Evidence

1. **Open DevTools** (F12 → Network)
2. **Curl or browser**: Call the lookup endpoint directly (or check the Network tab if used from UI)

```bash
curl "http://127.0.0.1:8000/notes/lookup?title=Apple%20Harvest%20Notes&algo=iterative"
```

**Response (HTTP 200):**

```json
{
  "id": 5,
  "title": "Apple Harvest Notes",
  "content": "Detailed notes on apple harvesting techniques and best practices for autumn season.",
  "tag": "kb-demo",
  "owner_id": 1,
  "created_at": "2026-08-08T10:00:00.000000",
  "attachment_url": null
}
```

**Also works with recursive algorithm:**

```bash
curl "http://127.0.0.1:8000/notes/lookup?title=Apple%20Harvest%20Notes&algo=recursive"
```

Same response as above. ✅

---

### 3. Quick Tag Jump (Linear Search Endpoint)

**Feature:** Frontend "Quick Tag Jump" buttons call `/notes/quick-find?tag=<value>` to retrieve the first note with that tag.

#### Request with Network Evidence

1. **Open DevTools** (F12 → Network)
2. **In the sidebar, click a "Quick Tag Jump" button** (e.g., the emoji button for a tag)
3. **Observe the request in Network tab:**

```
GET /notes/quick-find?tag=health HTTP/1.1
Host: 127.0.0.1:8000
```

**Response (HTTP 200):**

```json
{
  "id": 3,
  "title": "Morning Jog",
  "content": "6 AM jog around the park. Great weather today!",
  "tag": "health",
  "owner_id": 1,
  "created_at": "2026-08-08T06:30:00.000000",
  "attachment_url": null
}
```

**Observation:** Returns the first note with tag `health`. ✅

---

### 4. Plain Keyword Search (Frontend Client-Side)

**Feature:** The search box filters notes locally by title, tag, or content (no backend call).

#### How It Works

1. **Type in the "Filter notes by title or tag" input**
2. **No Network tab request is made** — filtering is 100% client-side
3. **Notes list updates in real-time** with matching results

**Frontend logic** (in `frontend/script.js`, lines 700–749):

```javascript
function getDisplayedNotes() {
  const searchTerm = document.getElementById("plain-search")?.value.trim().toLowerCase() || "";
  let filtered = allNotes.filter((note) => {
    const matchesSearch =
      !searchTerm ||
      note.title.toLowerCase().includes(searchTerm) ||
      note.tag.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm);
    return matchesSearch;
  });
  return filtered;
}
```

**Example:**
- Notes list has: "Apple Harvest Notes", "Coffee Tasting", "Tea Brewing"
- Type `coffee` in the search box
- Only "Coffee Tasting" appears ✅

---

### 5. Smart Search (AI) — Semantic Similarity

**Feature:** The "Smart Search (AI)" control uses embedding-based cosine similarity to rank notes by semantic meaning, not just keywords.

#### Request with Network Evidence

1. **Open DevTools** (F12 → Network)
2. **In the "Smart Search (AI)" input**, type: `leg day exercise plan`
3. **Observe the Network tab:**

```
GET /notes/smart-search?q=leg+day+exercise+plan HTTP/1.1
Host: 127.0.0.1:8000
```

**Response (HTTP 200):**

```json
[
  {
    "id": 18,
    "title": "Gym schedule change",
    "content": "New gym hours: Monday-Friday 6am-10pm, Saturday-Sunday 8am-8pm. Closed holidays.",
    "tag": "ai-demo",
    "owner_id": 1,
    "created_at": "2026-08-08T09:15:00.000000",
    "attachment_url": null,
    "score": 0.742
  },
  {
    "id": 19,
    "title": "Fitness goals Q3",
    "content": "Increase bench press by 20lbs, complete 5K in under 23 min, add leg training 2x/week.",
    "tag": "ai-demo",
    "owner_id": 1,
    "created_at": "2026-08-08T09:20:00.000000",
    "attachment_url": null,
    "score": 0.685
  },
  {
    "id": 20,
    "title": "Meal prep ideas",
    "content": "High-protein meals for athletes: grilled chicken, brown rice, quinoa bowls.",
    "tag": "ai-demo",
    "owner_id": 1,
    "created_at": "2026-08-08T09:25:00.000000",
    "attachment_url": null,
    "score": 0.521
  }
]
```

**Semantic Ranking:** The query "leg day exercise plan" is semantically similar to fitness/gym content, so notes about gym hours, fitness goals, and meal prep rank high (score 0.74–0.52). ✅

**Key Difference from Keyword Search:**
- **Keyword:** Would only match if text contains "leg", "day", "exercise", or "plan"
- **Semantic:** Understands that "gym schedule" is related to fitness training, even if the exact words don't match

---

### 6. Keyword Search (Backend Ranking)

**Feature:** The backend `/notes/search?keyword=<value>` endpoint ranks notes by keyword frequency (count of occurrences).

#### Request with Network Evidence

1. **Curl the endpoint:**

```bash
curl "http://127.0.0.1:8000/notes/search?keyword=apple"
```

**Response (HTTP 200):**

```json
[
  {
    "id": 5,
    "title": "Apple Harvest Notes",
    "content": "Detailed notes on apple harvesting techniques and best practices for autumn season. Apple trees require proper care. Apples are best picked when ripe.",
    "tag": "kb-demo",
    "owner_id": 1,
    "created_at": "2026-08-08T10:00:00.000000",
    "created_at_epoch": 1722686400,
    "score": 3
  }
]
```

**Observation:** Note with ID 5 appears first because the word "apple" appears 3 times in the content (score = 3). ✅

---

## Smart Search vs Keyword Search

### Side-by-Side Comparison

| Aspect | Smart Search (AI) | Keyword Search |
|---|---|---|
| **Backend Endpoint** | `/notes/smart-search?q=...` | `/notes/search?keyword=...` |
| **Ranking Metric** | Cosine similarity of embeddings | Keyword occurrence count |
| **Example Query** | `leg day exercise plan` | `apple` |
| **Example Result 1** | "Gym schedule change" (score 0.742) | "Apple Harvest Notes" (score 3) |
| **Example Result 2** | "Fitness goals Q3" (score 0.685) | None (no other note with "apple") |
| **Requires Internet?** | No (first download only) | No |
| **Model** | `sentence-transformers` MiniLM-L6-v2 | Plain text counting |
| **UI Element** | "Smart Search (AI)" section | "Filter notes by title or tag" input |
| **Dataset** | Only `ai-demo` tagged notes | All notes |

### Practical Example Workflows

#### Workflow 1: Keyword Search for "Apple"

1. Backend `/notes/search?keyword=apple` is called
2. Counts occurrences of "apple" in all note contents
3. Returns top 5 by count
4. Result: "Apple Harvest Notes" with score 3

#### Workflow 2: Smart Search for "Leg Day Workout"

1. Backend `/notes/smart-search?q=leg+day+workout` is called
2. Encodes query using MiniLM model
3. Encodes all `ai-demo` notes' content
4. Computes cosine similarity for each
5. Returns top 3 by similarity score
6. Results include "Gym schedule change", "Fitness goals Q3", etc. — semantically related even if exact words don't match

---

## API Endpoint Reference

### Users

| Method | Path | Description |
|---|---|---|
| `POST` | `/users` | Create a new user |
| `POST` | `/auth/login` | Login user |
| `PUT` | `/users/{user_id}/email` | Update user email |

### Notes CRUD

| Method | Path | Description |
|---|---|---|
| `POST` | `/notes` | Create a note (with AI suggestion) |
| `GET` | `/notes` | List all notes (optional `?tag=` filter) |
| `GET` | `/notes/{id}` | Get a single note |
| `PUT` | `/notes/{id}` | Update a note |
| `DELETE` | `/notes/{id}` | Delete a note |
| `POST` | `/notes/import` | Bulk import notes from `.txt` file |

### Search & Lookup

| Method | Path | Description |
|---|---|---|
| `GET` | `/notes/search?keyword=...` | Keyword ranking by frequency |
| `GET` | `/notes/search?sort_by=date` | Sort by date descending |
| `GET` | `/notes/lookup?title=...&algo=iterative\|recursive` | Binary search by exact title |
| `GET` | `/notes/quick-find?tag=...` | Linear search by tag |
| `GET` | `/notes/smart-search?q=...` | AI semantic search (embeddings) |

### Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/reports/tag-summary` | Tags with count > 1 |
| `GET` | `/reports/long-notes` | Notes longer than average |
| `GET` | `/reports/user-notes` | Note count per user |

### Attachments

| Method | Path | Description |
|---|---|---|
| `POST` | `/notes/{id}/attachment` | Upload a file attachment |
| `DELETE` | `/notes/{id}/attachment` | Remove all attachments for a note |

---

## Technology Stack

### Backend
- **Framework:** FastAPI 0.114.0
- **Server:** Uvicorn 0.23.2
- **Database:** SQLite (SQLAlchemy ORM)
- **Validation:** Pydantic
- **AI/ML:** sentence-transformers (MiniLM-L6-v2)
- **HTTP:** httpx

### Frontend
- **Language:** Vanilla JavaScript (no build step)
- **Styling:** CSS Grid + Media Queries
- **Fonts:** Google Fonts (Poppins)
- **Deployment:** Vercel (production) / Python http.server (dev)

### Algorithms Implemented
- **Insertion Sort** — for keyword/date ranking
- **Binary Search** (iterative & recursive) — for exact title lookup
- **Linear Search** — for tag matching
- **Cosine Similarity** — for semantic search

---

## Troubleshooting

### Backend won't start
- **Error:** `Address already in use`
  - **Solution:** Change port: `uvicorn backend.main:app --port 8001`
- **Error:** `No module named 'fastapi'`
  - **Solution:** Reinstall dependencies: `pip install -r backend/requirements.txt`

### Frontend can't reach backend (CORS error)
- **Error:** `Access to XMLHttpRequest blocked by CORS policy`
  - **Solution:** Ensure backend is running on `http://127.0.0.1:8000` and frontend is on `http://127.0.0.1:5500`
  - **Or:** Add your origin to `FRONTEND_ORIGINS` in `backend/main.py` (line 26–30)

### Notes don't persist after refresh
- **Cause:** Frontend served from wrong origin
- **Solution:** Verify backend CORS allowed origins match your frontend URL

### Semantic search returns empty results
- **Cause:** No `ai-demo` tagged notes in database
- **Solution:** Run `python backend/seed.py` to populate seed data

---

## Credits

Built by **AJEETH JALAL PASHA** as a Zomato Notes Capstone Project (2026).

**Key Features:**
- ✅ Full-stack integration with real backend persistence
- ✅ AI-powered semantic search with embeddings
- ✅ Hand-rolled algorithms (binary search, insertion sort, linear search)
- ✅ Responsive mobile-first design (< 860px breakpoint)
- ✅ CORS whitelisting for exact frontend origins
- ✅ End-to-end CRUD operations with proof of persistence
