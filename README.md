# Zomato Notes

A full-stack internal knowledge base for incident notes with real backend, frontend, ranking algorithms, and AI-powered features.

## Setup

1. Create a Python virtual environment in the repository:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. Install dependencies:

   ```powershell
   pip install -r backend\requirements.txt
   ```

3. Seed the database:

   ```powershell
   python backend\seed.py
   ```

4. Start the backend:

   ```powershell
   uvicorn backend.main:app --reload
   ```

5. Serve the frontend from the `frontend` folder, for example:

   ```powershell
   cd frontend
   python -m http.server 5500
   ```

6. Open the app in the browser at `http://127.0.0.1:5500`.

## Backend

The backend uses SQLite via `backend/zomato_notes.db` and FastAPI.

Allowed CORS origins are exactly:

- `http://127.0.0.1:5500`
- `http://localhost:5500`

The delete endpoint requires the header `x-token` with the value `zomato-secret-token`.

### Validation and error behavior

- Missing required fields or invalid payloads return `422 Unprocessable Entity` with Pydantic validation details.
- Duplicate user emails return `400` with `A user with that email already exists`.
- `POST /notes` with a missing or non-existent `owner_id` returns `404` and creates no note.
- `POST /notes/import` with a non-existent `owner_id` returns `404` and imports zero notes.

### API Endpoints

- `POST /users` — create a user
- `POST /notes` — create a note
- `GET /notes` — list notes
- `GET /notes?tag=<value>` — filter notes by tag
- `GET /notes/{id}` — fetch a single note
- `PUT /notes/{id}` — update a note
- `DELETE /notes/{id}` — delete a note (requires x-token header)
- `POST /notes/import` — bulk import a text file of notes by owner_id
- `GET /reports/tag-summary` — raw SQL tag counts with count > 1
- `GET /reports/long-notes` — raw SQL subquery notes longer than average
- `GET /reports/user-notes` — raw SQL join user note counts
- `GET /notes/search?keyword=<value>` — ranked relevance search
- `GET /notes/search?sort_by=date` — ranked date search using the same insertion sort helper
- `GET /notes/lookup?title=<title>&algo=iterative|recursive` — exact title lookup
- `GET /notes/quick-find?tag=<value>` — first note by tag
- `GET /notes/smart-search?q=<query>` — semantic search over AI demo notes

### Response evidence

- `GET /notes` responds with `X-Process-Time` header on every response.
- `DELETE /notes/{id}` returns `401` when `x-token` is missing, `403` when wrong, and `200` when correct.
- `POST /notes` with valid data returns an `ai_suggestion` object in the response.
- `GET /reports/tag-summary` returns exactly `work`, `health`, `recipes`, and `random` for the seed dataset.

### Example request/response text

```bash
curl -i http://127.0.0.1:8000/notes
```
- Response includes `X-Process-Time: 0.01...`.

```bash
curl -X POST http://127.0.0.1:8000/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Integration note","content":"Test note content for integration.","tag":"test","owner_id":1}'
```
- Response contains `"ai_suggestion": {"tags": ["test", "note", "content"], "summary": "Test note content for integration."}`.

```bash
curl -X DELETE http://127.0.0.1:8000/notes/31 -H 'x-token: zomato-secret-token'
```
- Response: `{"detail":"Note deleted"}`.

```bash
curl http://127.0.0.1:8000/notes/search?keyword=apple
```
- Top result: `Apple Harvest Notes`.

```bash
curl http://127.0.0.1:8000/notes/smart-search?q=leg+day+exercise+plan
```
- Top 3 results include `Gym schedule change`.
```

### Ranking and AI evidence

- `GET /notes/search?keyword=apple` returns `Apple Harvest Notes` first.
- `GET /notes/search?keyword=coffee` returns `Coffee Tasting` first.
- `GET /notes/search?sort_by=date` returns notes ordered by `created_at_epoch` descending.
- `GET /notes/lookup?title=Apple Harvest Notes&algo=iterative` and `...&algo=recursive` both return the matching note.
- `GET /notes/quick-find?tag=travel` returns the first travel note.
- `GET /notes/smart-search?q=leg+day+exercise+plan` returns `Gym schedule change` in the top results.
- `GET /notes/smart-search?q=dinner+ideas+with+vegetables` returns `Recipe idea` in the top results.

## AI and Semantic Search

- AI suggestions are generated in mock mode by default using `MOCK_AI=1`.
- The prompt template is embedded verbatim in `backend/ai_service.py` and uses Instructions, Context, Input, Constraints, and Output Format.
- Semantic search uses `sentence-transformers==3.0.0` with the `all-MiniLM-L6-v2` model.
- The first time semantic search runs, the model downloads to the local Hugging Face cache (typically `~/.cache/huggingface`). After that initial download, no internet or API key is required.

## Frontend

The frontend is a plain HTML/CSS/JavaScript app with no build step.

- It dynamically fetches notes from the live backend using `fetch()`.
- The search box is debounced with a 400ms delay using `setTimeout` and `clearTimeout`.
- The CSS includes `@media (max-width: 600px) { main { grid-template-columns: 1fr; } }` to collapse the layout on narrow viewports.
- The tag tree is rendered recursively with a single function and supports expand/collapse at any depth.
- The smart search control is visually separate from the plain keyword filter.
- The quick tag jump buttons call the real backend `GET /notes/quick-find` endpoint.

## Notes

- The app persists notes in the live backend. Adding or deleting a note in the UI changes the backend data.
- The `sample_import.txt` file contains five non-empty lines for bulk import.
