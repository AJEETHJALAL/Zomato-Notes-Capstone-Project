const BASE_API_URL = "http://127.0.0.1:8000";
const DELETE_TOKEN = "zomato-secret-token";
const CATEGORY_TREE = {
  name: "All Tags",
  children: [
    { name: "Work", children: [
      { name: "Standups", children: [] },
      { name: "Retros", children: [] },
    ]},
    { name: "Personal", children: [
      { name: "Health", children: [
        { name: "Fitness", children: [] },
      ]},
      { name: "Recipes", children: [] },
    ]},
    { name: "Travel", children: [] },
  ],
};

let allNotes = [];
let debounceTimer = null;

if (typeof USE_MOCK === "undefined") {
  window.USE_MOCK = false;
}

async function fetchNotes(tag = "") {
  if (window.USE_MOCK) {
    return MOCK_NOTES;
  }
  const url = new URL(`${BASE_API_URL}/notes`);
  if (tag) {
    url.searchParams.set("tag", tag);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }
  return response.json();
}

async function createNote(payload) {
  if (window.USE_MOCK) {
    const note = { ...payload, id: Date.now(), created_at: new Date().toISOString() };
    MOCK_NOTES.push(note);
    return note;
  }
  const response = await fetch(`${BASE_API_URL}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create failed: ${response.status} ${errorText}`);
  }
  return response.json();
}

async function deleteNote(id) {
  if (window.USE_MOCK) {
    const index = MOCK_NOTES.findIndex((n) => n.id === id);
    if (index !== -1) {
      MOCK_NOTES.splice(index, 1);
    }
    return;
  }
  const response = await fetch(`${BASE_API_URL}/notes/${id}`, {
    method: "DELETE",
    headers: { "x-token": DELETE_TOKEN },
  });
  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status}`);
  }
}

function renderNotes(notes) {
  const list = document.getElementById("notes-list");
  list.innerHTML = "";
  if (notes.length === 0) {
    list.textContent = "No notes match your filter.";
    return;
  }
  notes.forEach((note) => {
    list.appendChild(createNoteCard(note));
  });
}

function createNoteCard(note) {
  const card = document.createElement("article");
  card.className = "note-card";
  card.dataset.noteId = note.id;

  const title = document.createElement("h3");
  title.textContent = note.title;
  card.appendChild(title);

  const content = document.createElement("p");
  content.textContent = note.content;
  card.appendChild(content);

  const tagLine = document.createElement("p");
  tagLine.innerHTML = `<span class="tag">Tag:</span> ${note.tag || "(none)"}`;
  card.appendChild(tagLine);

  const ownerInfo = document.createElement("p");
  ownerInfo.textContent = `Owner ID: ${note.owner_id}`;
  card.appendChild(ownerInfo);

  const controls = document.createElement("div");
  controls.className = "card-controls";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", async () => {
    try {
      deleteButton.disabled = true;
      await deleteNote(note.id);
      card.remove();
      allNotes = allNotes.filter((item) => item.id !== note.id);
    } catch (err) {
      showError(err.message);
      deleteButton.disabled = false;
    }
  });
  controls.appendChild(deleteButton);

  if (note.ai_suggestion) {
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "Apply as tag";
    applyButton.addEventListener("click", async () => {
      try {
        applyButton.disabled = true;
        await updateNoteTag(note.id, note.ai_suggestion.tags[0]);
        note.tag = note.ai_suggestion.tags[0];
        tagLine.innerHTML = `<span class="tag">Tag:</span> ${note.tag}`;
      } catch (err) {
        showError(err.message);
      } finally {
        applyButton.disabled = false;
      }
    });
    controls.appendChild(applyButton);
  }

  card.appendChild(controls);

  if (note.ai_suggestion) {
    const suggestion = document.createElement("div");
    suggestion.className = "ai-suggestion";
    suggestion.innerHTML = `
      <strong>AI Suggests</strong>
      <p>Tags: ${note.ai_suggestion.tags.join(", ")}</p>
      <p>Summary: ${note.ai_suggestion.summary}</p>
    `;
    card.appendChild(suggestion);
  }

  return card;
}

async function updateNoteTag(id, tag) {
  const response = await fetch(`${BASE_API_URL}/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update tag: ${response.status} ${errorText}`);
  }
  return response.json();
}

function showError(message) {
  const error = document.getElementById("error-message");
  error.textContent = message;
}

function clearError() {
  showError("");
}

function setLoading(isLoading) {
  document.getElementById("loading-message").style.display = isLoading ? "block" : "none";
}

function filterNotes(value) {
  const term = value.trim().toLowerCase();
  const filtered = allNotes.filter((note) => {
    return note.title.toLowerCase().includes(term) || note.tag.toLowerCase().includes(term);
  });
  renderNotes(filtered);
}

function renderTree(node) {
  const li = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = node.name;
  li.appendChild(label);
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    li.classList.toggle("open");
  });

  if (node.children && node.children.length > 0) {
    const ul = document.createElement("ul");
    node.children.forEach((child) => {
      ul.appendChild(renderTree(child));
    });
    li.appendChild(ul);
  }
  return li;
}

function buildCategoryTree() {
  const root = document.getElementById("tree-root");
  root.innerHTML = "";
  const tree = document.createElement("ul");
  tree.appendChild(renderTree(CATEGORY_TREE));
  root.appendChild(tree);
}

async function performRankSearch() {
  const keyword = document.getElementById("rank-keyword").value.trim();
  const mode = document.getElementById("rank-mode").value;
  const resultContainer = document.getElementById("rank-results");
  resultContainer.textContent = "";
  try {
    let url = `${BASE_API_URL}/notes/search`;
    if (mode === "date") {
      url += "?sort_by=date";
    } else {
      if (!keyword) {
        resultContainer.textContent = "Enter a keyword for relevance search.";
        return;
      }
      url += `?keyword=${encodeURIComponent(keyword)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    const results = await response.json();
    resultContainer.innerHTML = results.length
      ? results.map((note) => `<div><strong>${note.title}</strong> (${note.tag})</div>`).join("")
      : "No ranked results.";
  } catch (err) {
    resultContainer.textContent = err.message;
  }
}

async function performLookup() {
  const title = document.getElementById("lookup-title").value.trim();
  const algo = document.getElementById("lookup-algo").value;
  const resultContainer = document.getElementById("lookup-result");
  resultContainer.textContent = "";
  if (!title) {
    resultContainer.textContent = "Enter an exact title.";
    return;
  }
  try {
    const response = await fetch(
      `${BASE_API_URL}/notes/lookup?title=${encodeURIComponent(title)}&algo=${encodeURIComponent(algo)}`
    );
    if (!response.ok) {
      throw new Error(`Lookup failed: ${response.status}`);
    }
    const note = await response.json();
    resultContainer.innerHTML = `<strong>Found:</strong> ${note.title} <span class="tag">${note.tag}</span>`;
    highlightNote(note.id);
  } catch (err) {
    resultContainer.textContent = err.message;
  }
}

async function performSmartSearch() {
  const query = document.getElementById("smart-search-query").value.trim();
  const resultContainer = document.getElementById("smart-results");
  resultContainer.textContent = "";
  if (!query) {
    resultContainer.textContent = "Enter a semantic query.";
    return;
  }
  try {
    const response = await fetch(`${BASE_API_URL}/notes/smart-search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Smart search failed: ${response.status}`);
    }
    const results = await response.json();
    resultContainer.innerHTML = results.length
      ? results
          .map(
            (note) => `<div><strong>${note.title}</strong> (${note.tag}) — score ${note.score.toFixed(3)}</div>`
          )
          .join("")
      : "No AI smart results.";
  } catch (err) {
    resultContainer.textContent = err.message;
  }
}

async function performQuickTagJump(tag) {
  const resultContainer = document.getElementById("quick-find-result");
  resultContainer.textContent = "";
  try {
    const response = await fetch(`${BASE_API_URL}/notes/quick-find?tag=${encodeURIComponent(tag)}`);
    if (!response.ok) {
      throw new Error(`Quick find failed: ${response.status}`);
    }
    const note = await response.json();
    resultContainer.innerHTML = `<strong>Found:</strong> ${note.title} <span class="tag">${note.tag}</span>`;
    highlightNote(note.id);
  } catch (err) {
    resultContainer.textContent = err.message;
  }
}

function highlightNote(id) {
  const cards = document.querySelectorAll(".note-card");
  cards.forEach((card) => card.classList.toggle("highlighted", card.dataset.noteId == id));
  const noteCard = document.querySelector(`.note-card[data-note-id='${id}']`);
  if (noteCard) {
    noteCard.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => noteCard.classList.remove("highlighted"), 4000);
  }
}

async function loadNotes() {
  setLoading(true);
  clearError();
  try {
    allNotes = await fetchNotes();
    renderNotes(allNotes);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function attachListeners() {
  document.getElementById("plain-search").addEventListener("input", (event) => {
    clearError();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      filterNotes(event.target.value);
    }, 400);
  });

  document.getElementById("note-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const title = document.getElementById("note-title").value.trim();
    const content = document.getElementById("note-content").value.trim();
    const tag = document.getElementById("note-tag").value.trim();
    const owner_id = Number(document.getElementById("note-owner").value);
    if (!title || !content) {
      document.getElementById("form-error").textContent = "Title and content are required.";
      return;
    }
    document.getElementById("form-error").textContent = "";
    try {
      const created = await createNote({ title, content, tag, owner_id });
      allNotes.unshift(created);
      renderNotes(allNotes);
      event.target.reset();
      document.getElementById("note-owner").value = owner_id;
    } catch (err) {
      document.getElementById("form-error").textContent = err.message;
    }
  });

  const rankBtn = document.getElementById("rank-search-btn");
  if (rankBtn) rankBtn.addEventListener("click", performRankSearch);
  const lookupBtn = document.getElementById("lookup-btn");
  if (lookupBtn) lookupBtn.addEventListener("click", performLookup);
  const smartBtn = document.getElementById("smart-search-btn");
  if (smartBtn) smartBtn.addEventListener("click", performSmartSearch);
  document.querySelectorAll(".quick-tag-btn").forEach((button) => {
    button.addEventListener("click", () => performQuickTagJump(button.dataset.tag));
  });
}

buildCategoryTree();
attachListeners();
loadNotes();
