const BASE_API_URL = "http://127.0.0.1:8000";
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
let selectedQuickTags = new Set();
let quickSpecialNotes = null;
let currentUser = null; // { id: number }

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
  const created = await response.json();

  // if user attached a file, upload it to the backend and attach URL to note
  try {
    const fileInput = document.getElementById("note-attachment");
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const attachRes = await uploadAttachment(created.id, file);
      if (attachRes && attachRes.url) {
        created.attachment_url = attachRes.url;
      }
    }
  } catch (err) {
    console.warn("Attachment upload failed:", err);
  }

  return created;
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
    headers: {
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete failed: ${response.status} ${text}`);
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

  // show attachment paperclip if available
  if (note.attachment_url) {
    const attachLink = document.createElement("a");
    attachLink.href = note.attachment_url;
    attachLink.target = "_blank";
    attachLink.rel = "noopener noreferrer";
    attachLink.className = "attachment-link";
    attachLink.title = "View attachment";
    attachLink.innerHTML = `📎 View attachment`;
    card.appendChild(attachLink);
  }


  const ownerInfo = document.createElement("p");
  ownerInfo.textContent = `Owner ID: ${note.owner_id}`;
  card.appendChild(ownerInfo);


  const editFields = document.createElement("div");
  editFields.className = "edit-fields";
  editFields.style.display = "none";

  const titleEditGroup = document.createElement("div");
  titleEditGroup.className = "form-group";
  const titleEditLabel = document.createElement("label");
  titleEditLabel.textContent = "Title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = note.title;
  titleInput.required = true;
  titleEditGroup.appendChild(titleEditLabel);
  titleEditGroup.appendChild(titleInput);

  const contentEditGroup = document.createElement("div");
  contentEditGroup.className = "form-group";
  const contentEditLabel = document.createElement("label");
  contentEditLabel.textContent = "Content";
  const contentInput = document.createElement("textarea");
  contentInput.rows = 4;
  contentInput.value = note.content;
  contentInput.required = true;
  contentEditGroup.appendChild(contentEditLabel);
  contentEditGroup.appendChild(contentInput);

  const tagEditGroup = document.createElement("div");
  tagEditGroup.className = "form-group";
  const tagEditLabel = document.createElement("label");
  tagEditLabel.textContent = "Tag";
  const tagInput = document.createElement("input");
  tagInput.type = "text";
  tagInput.value = note.tag || "";
  tagEditGroup.appendChild(tagEditLabel);
  tagEditGroup.appendChild(tagInput);

  editFields.appendChild(titleEditGroup);
  editFields.appendChild(contentEditGroup);
  editFields.appendChild(tagEditGroup);
  card.appendChild(editFields);

  const controls = document.createElement("div");
  controls.className = "card-controls";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "Edit";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.style.display = "none";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.display = "none";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";

  const enterEditMode = () => {
    title.style.display = "none";
    content.style.display = "none";
    tagLine.style.display = "none";
    editFields.style.display = "block";
    editButton.style.display = "none";
    saveButton.style.display = "inline-block";
    cancelButton.style.display = "inline-block";
  };

  const exitEditMode = () => {
    title.style.display = "block";
    content.style.display = "block";
    tagLine.style.display = "block";
    editFields.style.display = "none";
    editButton.style.display = "inline-block";
    saveButton.style.display = "none";
    cancelButton.style.display = "none";
  };

  editButton.addEventListener("click", () => {
    enterEditMode();
  });

  saveButton.addEventListener("click", async () => {
    try {
      saveButton.disabled = true;
      cancelButton.disabled = true;
      const updated = await updateNote(note.id, {
        title: titleInput.value.trim(),
        content: contentInput.value.trim(),
        tag: tagInput.value.trim(),
      });
      note.title = updated.title;
      note.content = updated.content;
      note.tag = updated.tag;
      title.textContent = updated.title;
      content.textContent = updated.content;
      tagLine.innerHTML = `<span class="tag">Tag:</span> ${updated.tag || "(none)"}`;
      allNotes = allNotes.map((item) => (item.id === updated.id ? updated : item));
      updateTagFilterOptions();
      updateNotesDisplay();
      exitEditMode();
    } catch (err) {
      showError(err.message);
    } finally {
      saveButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  cancelButton.addEventListener("click", () => {
    titleInput.value = note.title;
    contentInput.value = note.content;
    tagInput.value = note.tag || "";
    exitEditMode();
  });

  deleteButton.addEventListener("click", async () => {
    try {
      deleteButton.disabled = true;
      await deleteNote(note.id);
      card.remove();
      allNotes = allNotes.filter((item) => item.id !== note.id);
      updateTagFilterOptions();
      updateNotesDisplay();
    } catch (err) {
      showError(err.message);
      deleteButton.disabled = false;
    }
  });

  controls.appendChild(editButton);
  controls.appendChild(saveButton);
  controls.appendChild(cancelButton);
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
        updateTagFilterOptions();
        updateNotesDisplay();
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
  return updateNote(id, { tag });
}

async function updateNote(id, data) {
  const response = await fetch(`${BASE_API_URL}/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update note: ${response.status} ${errorText}`);
  }
  return response.json();
}

async function uploadAttachment(noteId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const response = await fetch(`${BASE_API_URL}/notes/${noteId}/attachment`, {
    method: 'POST',
    body: fd,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errText}`);
  }
  return response.json();
}

async function importNotes(ownerId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const response = await fetch(`${BASE_API_URL}/notes/import?owner_id=${encodeURIComponent(ownerId)}`, {
    method: 'POST',
    body: fd,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Import failed: ${response.status} ${errText}`);
  }
  return response.json();
}

function showError(message) {
  const error = document.getElementById("error-message");
  if (error) {
    error.textContent = message;
  }
}

function clearError() {
  showError("");
}

function setLoading(isLoading) {
  const loading = document.getElementById("loading-message");
  if (loading) {
    loading.style.display = isLoading ? "block" : "none";
  }
}

function getDisplayedNotes() {
  const searchTerm = document.getElementById("plain-search")?.value.trim().toLowerCase() || "";
  const tagFilter = document.getElementById("notes-tag-filter")?.value || "";
  const sortOrder = document.getElementById("notes-sort-order")?.value || "created_desc";
  const idFilterValue = document.getElementById("quick-id-filter")?.value || "";

  let filtered = quickSpecialNotes ? [...quickSpecialNotes] : allNotes.filter((note) => {
    const matchesSearch =
      !searchTerm ||
      note.title.toLowerCase().includes(searchTerm) ||
      note.tag.toLowerCase().includes(searchTerm) ||
      note.content.toLowerCase().includes(searchTerm);
    const matchesTag = !tagFilter || note.tag.toLowerCase() === tagFilter.toLowerCase();
    const matchesQuickTags =
      selectedQuickTags.size === 0 || selectedQuickTags.has((note.tag || "").toLowerCase());
    const matchesId =
      !idFilterValue || note.id === Number(idFilterValue);
    return matchesSearch && matchesTag && matchesQuickTags && matchesId;
  });

  filtered.sort((a, b) => {
    if (sortOrder === "created_asc") {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    if (sortOrder === "created_desc") {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortOrder === "title_asc") {
      return a.title.localeCompare(b.title);
    }
    if (sortOrder === "title_desc") {
      return b.title.localeCompare(a.title);
    }
    return 0;
  });

  return filtered;
}

function updateNotesDisplay() {
  renderNotes(getDisplayedNotes());
}

function updateTagFilterOptions() {
  const select = document.getElementById("notes-tag-filter");
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const tagSet = new Set();
  allNotes.forEach((note) => {
    if (note.tag?.trim()) {
      tagSet.add(note.tag.trim());
    }
  });

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All tags";
  select.appendChild(allOption);

  Array.from(tagSet)
    .sort((a, b) => a.localeCompare(b))
    .forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      select.appendChild(option);
    });

  if (currentValue && Array.from(tagSet).includes(currentValue)) {
    select.value = currentValue;
  }
}

function resetAllFilters() {
  const plainSearch = document.getElementById("plain-search");
  const notesTagFilter = document.getElementById("notes-tag-filter");
  const notesSortOrder = document.getElementById("notes-sort-order");
  const smartSearchQuery = document.getElementById("smart-search-query");
  const smartResults = document.getElementById("smart-results");

  if (plainSearch) {
    plainSearch.value = "";
  }
  if (notesTagFilter) {
    notesTagFilter.value = "";
  }
  if (notesSortOrder) {
    notesSortOrder.value = "created_desc";
  }
  if (smartSearchQuery) {
    smartSearchQuery.value = "";
  }
  if (smartResults) {
    smartResults.textContent = "";
  }
  resetQuickFilters();
}

function filterNotes(value) {
  updateNotesDisplay();
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

  if (mode !== "date" && !keyword) {
    resultContainer.textContent = "Enter a keyword for relevance search.";
    return;
  }

  let matchedNotes = [];

  /* Try the backend search endpoint first. */
  try {
    let url = `${BASE_API_URL}/notes/search`;
    if (mode === "date") {
      url += "?sort_by=date";
    } else {
      url += `?keyword=${encodeURIComponent(keyword)}`;
    }
    const response = await fetch(url);
    if (response.ok) {
      matchedNotes = await response.json();
    }
  } catch (err) {
    /* Backend not available — fall through to client-side logic. */
  }

  /* Client-side fallback. */
  if (matchedNotes.length === 0) {
    if (allNotes.length === 0) {
      resultContainer.textContent = "No notes loaded to search.";
      renderNotes([]);
      return;
    }

    if (mode === "date") {
      /* Sort by created_at descending. */
      matchedNotes = [...allNotes].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    } else {
      /* Relevance: filter by keyword in title, content, or tag. */
      const term = keyword.toLowerCase();
      matchedNotes = allNotes.filter((note) =>
        (note.title || "").toLowerCase().includes(term) ||
        (note.content || "").toLowerCase().includes(term) ||
        (note.tag || "").toLowerCase().includes(term)
      );
    }
  }

  if (matchedNotes.length === 0) {
    resultContainer.textContent = "No ranked results.";
    renderNotes([]);
    return;
  }

  /* Render matched notes as cards in the notes list (same as filterNotes). */
  renderNotes(matchedNotes);

  /* Also show a text summary in the rank-results panel. */
  resultContainer.innerHTML = matchedNotes
    .map((note) => `<div><strong>${note.title}</strong> (${note.tag || "none"})</div>`)
    .join("");
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

  let foundNote = null;

  /* Try the backend lookup endpoint first. */
  try {
    const response = await fetch(
      `${BASE_API_URL}/notes/lookup?title=${encodeURIComponent(title)}&algo=${encodeURIComponent(algo)}`
    );
    if (response.ok) {
      const note = await response.json();
      if (note && note.id !== undefined) {
        foundNote = note;
      }
    }
  } catch (err) {
    /* Backend not available — fall through to client-side lookup. */
  }

  /* Client-side fallback: find first note with matching title (case-insensitive exact match). */
  if (!foundNote) {
    if (allNotes.length === 0) {
      resultContainer.textContent = "No notes loaded to search.";
      renderNotes([]);
      return;
    }

    const term = title.toLowerCase();
    foundNote = allNotes.find((note) => (note.title || "").toLowerCase() === term);
  }

  if (!foundNote) {
    resultContainer.textContent = `No note found with title "${title}".`;
    renderNotes([]);
    return;
  }

  /* Render the found note as a card in the notes list. */
  renderNotes([foundNote]);

  resultContainer.innerHTML = `<strong>Found:</strong> ${foundNote.title} <span class="tag">${foundNote.tag || "none"}</span>`;
  highlightNote(foundNote.id);
}


/**
 * Client-side semantic scoring helper.
 * Scores a note against the query by counting overlapping keywords
 * in title, content, and tag. Returns a score between 0 and 1.
 */
function scoreNote(note, query) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) return 0;

  const haystack = [
    (note.title || "").toLowerCase(),
    (note.content || "").toLowerCase(),
    (note.tag || "").toLowerCase(),
  ].join(" ");

  let matches = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      matches++;
    }
  }
  return matches / queryTerms.length;
}


async function performSmartSearch() {
  const query = document.getElementById("smart-search-query").value.trim();
  const resultContainer = document.getElementById("smart-results");
  if (resultContainer) resultContainer.textContent = "";
  if (!query) {
    return;
  }

  let matchedNotes = [];

  /* Try the backend smart-search endpoint first. */
  try {
    const response = await fetch(`${BASE_API_URL}/notes/smart-search?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const results = await response.json();
      if (results.length > 0) {
        matchedNotes = results;
      }
    }
  } catch (err) {
    /* Backend not available — fall through to client-side scoring. */
  }

  /* Client-side fallback: rank allNotes by keyword overlap score. */
  if (matchedNotes.length === 0) {
    if (allNotes.length === 0) {
      return;
    }

    matchedNotes = allNotes
      .map((note) => ({ ...note, score: scoreNote(note, query) }))
      .filter((note) => note.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  if (matchedNotes.length === 0) {
    return;
  }

  /* Highlight top matched note, but do not render the list in the smart-results area. */
  highlightNote(matchedNotes[0].id);
  // optionally set tag filter to focus context
  const notesTagFilter = document.getElementById("notes-tag-filter");
  if (notesTagFilter && matchedNotes[0].tag) {
    notesTagFilter.value = matchedNotes[0].tag;
    updateNotesDisplay();
  }
}


function clearQuickSpecialMode() {
  quickSpecialNotes = null;
  const resultContainer = document.getElementById("quick-find-result");
  if (resultContainer) {
    resultContainer.textContent = "";
  }
}

function clearQuickSelections() {
  selectedQuickTags.clear();
  document.querySelectorAll(".quick-tag-btn").forEach((button) => {
    button.classList.remove("active");
  });
}

function toggleQuickTag(tag) {
  clearQuickSpecialMode();
  const normalized = tag.toLowerCase();
  if (selectedQuickTags.has(normalized)) {
    selectedQuickTags.delete(normalized);
  } else {
    selectedQuickTags.add(normalized);
  }
  document.querySelectorAll(".quick-tag-btn").forEach((button) => {
    const buttonTag = button.dataset.tag?.toLowerCase();
    if (buttonTag && selectedQuickTags.has(buttonTag)) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
  updateNotesDisplay();
}

async function performTagSummary() {
  const resultContainer = document.getElementById("quick-find-result");
  if (resultContainer) {
    resultContainer.textContent = "Loading summary...";
  }
  clearQuickSelections();
  try {
    const response = await fetch(`${BASE_API_URL}/reports/tag-summary`);
    if (!response.ok) {
      throw new Error(`Tag summary failed: ${response.status}`);
    }
    const tags = await response.json();
    const repeatedTags = tags.map((item) => item.tag.toLowerCase());
    quickSpecialNotes = allNotes.filter((note) => repeatedTags.includes((note.tag || "").toLowerCase()));
    if (resultContainer) {
      resultContainer.innerHTML = tags.length
        ? `<strong>Tags with count > 1:</strong> ${tags.map((item) => `${item.tag} (${item.count})`).join(", ")}`
        : "No repeated tags found.";
    }
    updateNotesDisplay();
  } catch (err) {
    if (resultContainer) {
      resultContainer.textContent = err.message;
    }
  }
}

async function performLongNotes() {
  const resultContainer = document.getElementById("quick-find-result");
  if (resultContainer) {
    resultContainer.textContent = "Loading long notes...";
  }
  clearQuickSelections();
  try {
    const response = await fetch(`${BASE_API_URL}/reports/long-notes`);
    if (!response.ok) {
      throw new Error(`Long notes request failed: ${response.status}`);
    }
    const notes = await response.json();
    quickSpecialNotes = notes;
    if (resultContainer) {
      resultContainer.innerHTML = notes.length
        ? `<strong>Long notes returned:</strong> ${notes.length}`
        : "No long notes found.";
    }
    updateNotesDisplay();
  } catch (err) {
    if (resultContainer) {
      resultContainer.textContent = err.message;
    }
  }
}

function resetQuickFilters() {
  clearQuickSelections();
  clearQuickSpecialMode();
  const quickIdFilter = document.getElementById("quick-id-filter");
  if (quickIdFilter) {
    quickIdFilter.value = "";
  }
  const notesSortOrder = document.getElementById("notes-sort-order");
  if (notesSortOrder) {
    notesSortOrder.value = "created_desc";
  }
  updateNotesDisplay();
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
    quickSpecialNotes = null;
    clearQuickSelections();
    updateTagFilterOptions();
    updateNotesDisplay();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}


function attachListeners() {
  // auth UI
  const signToggle = document.getElementById("sign-in-toggle");
  const signPanel = document.getElementById("sign-in-panel");
  const signForm = document.getElementById("sign-in-form");
  const signOutBtn = document.getElementById("sign-out-btn");
  const signStatus = document.getElementById("sign-status");

  if (signToggle && signPanel) {
    signToggle.addEventListener("click", () => {
      signPanel.style.display = signPanel.style.display === "none" ? "block" : "none";
    });
  }

  if (signForm) {
    signForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const ownerInput = document.getElementById("sign-owner-id");
      const ownerId = Number(ownerInput?.value || 0);
      if (!ownerId || ownerId < 1) {
        if (signStatus) signStatus.textContent = "Enter a valid owner id.";
        return;
      }
      // set current user locally (impersonate)
      currentUser = { id: ownerId };
      // propagate to Add Note owner field
      const noteOwner = document.getElementById("note-owner");
      if (noteOwner) {
        noteOwner.value = ownerId;
      }
      if (signStatus) signStatus.textContent = `Signed in as user ${ownerId}`;
      // show sign out button
      if (signOutBtn) signOutBtn.style.display = "inline-block";
      // hide submit button to avoid re-sign
      const submitBtn = signForm.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.style.display = "none";
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      currentUser = null;
      const noteOwner = document.getElementById("note-owner");
      if (noteOwner) noteOwner.value = "1";
      if (signStatus) signStatus.textContent = "Signed out";
      // reset form
      const submitBtn = signForm.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.style.display = "inline-block";
      signOutBtn.style.display = "none";
    });
  }
  const plainSearchInput = document.getElementById("plain-search");
  if (plainSearchInput) {
    plainSearchInput.addEventListener("input", (event) => {
      clearError();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        filterNotes(event.target.value);
      }, 400);
    });
  }

  const noteForm = document.getElementById("note-form");
  if (noteForm) {
    noteForm.addEventListener("submit", async (event) => {
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
        updateTagFilterOptions();
        updateNotesDisplay();
        event.target.reset();
        document.getElementById("note-owner").value = owner_id;
      } catch (err) {
        document.getElementById("form-error").textContent = err.message;
      }
    });
  }

  const rankBtn = document.getElementById("rank-search-btn");
  if (rankBtn) rankBtn.addEventListener("click", performRankSearch);
  const lookupBtn = document.getElementById("lookup-btn");
  if (lookupBtn) lookupBtn.addEventListener("click", performLookup);
  const smartBtn = document.getElementById("smart-search-btn");
  if (smartBtn) smartBtn.addEventListener("click", performSmartSearch);
  const notesTagFilter = document.getElementById("notes-tag-filter");
  if (notesTagFilter) notesTagFilter.addEventListener("change", updateNotesDisplay);
  const notesSortOrder = document.getElementById("notes-sort-order");
  if (notesSortOrder) notesSortOrder.addEventListener("change", updateNotesDisplay);
  const resetButton = document.getElementById("reset-filters-btn");
  if (resetButton) resetButton.addEventListener("click", resetAllFilters);
  const quickTagButtons = document.querySelectorAll(".quick-tag-btn");
  quickTagButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tag) {
        toggleQuickTag(button.dataset.tag);
      }
    });
  });
  const quickIdFilter = document.getElementById("quick-id-filter");
  if (quickIdFilter) {
    quickIdFilter.addEventListener("input", updateNotesDisplay);
  }
  const sortByDateBtn = document.getElementById("sort-by-date-btn");
  if (sortByDateBtn) {
    sortByDateBtn.addEventListener("click", () => {
      const notesSort = document.getElementById("notes-sort-order");
      if (notesSort) {
        notesSort.value = "created_desc";
      }
      updateNotesDisplay();
    });
  }
  const quickResetBtn = document.getElementById("quick-reset-filters-btn");
  if (quickResetBtn) {
    quickResetBtn.addEventListener("click", resetQuickFilters);
  }
  const quickSummaryBtn = document.getElementById("quick-tag-summary-btn");
  if (quickSummaryBtn) {
    quickSummaryBtn.addEventListener("click", performTagSummary);
  }
  const quickLongNotesBtn = document.getElementById("quick-long-notes-btn");
  if (quickLongNotesBtn) {
    quickLongNotesBtn.addEventListener("click", performLongNotes);
  }
  const bulkImportForm = document.getElementById("bulk-import-form");
  if (bulkImportForm) {
    bulkImportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fileInput = document.getElementById("bulk-import-file");
      const ownerInput = document.getElementById("bulk-owner-id");
      const status = document.getElementById("import-status");
      if (!fileInput || !ownerInput || !status) return;
      if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = "Please choose a .txt file to upload.";
        return;
      }
      const ownerId = Number(ownerInput.value);
      if (!ownerId || ownerId < 1) {
        status.textContent = "Enter a valid owner ID.";
        return;
      }
      status.textContent = "Uploading file...";
      try {
        await importNotes(ownerId, fileInput.files[0]);
        status.textContent = "Notes imported successfully.";
        await loadNotes();
        fileInput.value = "";
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }
}


window.addEventListener("DOMContentLoaded", () => {
  buildCategoryTree();
  attachListeners();
  loadNotes();
});
