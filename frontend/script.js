const BASE_API_URL = "https://zomato-notes-capstone-project-production.up.railway.app";
const DEFAULT_TAGS = ["work", "health", "recipes", "travel", "random"];
const TAG_ICON_MAP = {
  work: "💼",
  health: "💪",
  recipes: "🍽️",
  travel: "🧳",
  random: "🗒️",
  study: "📚",
  school: "🎓",
  finance: "💰",
  money: "💰",
  shopping: "🛍️",
  ideas: "💡",
  family: "👪",
  food: "🍲",
  project: "🧩",
};

const CATEGORY_TREE = {
  name: "All Tags",
  children: [
    { name: "Work", children: [
      { name: "Standups", children: [] },
      { name: "Retros", children: [] },
      { name: "Project", children: [] },
      { name: "Purchase", children: [] },
    ]},
    { name: "Personal", children: [
      { name: "Health", children: [
        { name: "Fitness", children: [] },
        { name: "Play", children: [] },
      ]},
      { name: "Recipes", children: [] },
      { name: "Service", children: [] },
    ]},
    { name: "Travel", children: [] },
    { name: "Random", children: [] },
  ],
};

const SYNONYM_MAP = {
  work: ["project", "meeting", "task", "standup", "retrospective", "retros"],
  health: ["fitness", "wellness", "exercise", "diet", "wellbeing"],
  recipes: ["food", "cooking", "meal", "ingredient", "recipe", "dinner", "lunch", "breakfast"],
  travel: ["trip", "journey", "vacation", "destination", "flight", "tour"],
  random: ["misc", "miscellaneous", "general", "note"],
};

let allNotes = [];
let debounceTimer = null;
let selectedQuickTags = new Set();
let quickSpecialNotes = null;
let currentUser = null; // { id: number }
let currentNotesPage = 1;
const NOTES_PER_PAGE = 8;
const collapsedTreeNodes = new Set();

function persistCurrentUser() {
  if (currentUser) {
    localStorage.setItem("zomatoNotesCurrentUser", JSON.stringify(currentUser));
  } else {
    localStorage.removeItem("zomatoNotesCurrentUser");
  }
}

function restoreCurrentUser() {
  try {
    const raw = localStorage.getItem("zomatoNotesCurrentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getTagIcon(tag) {
  const normalizedTag = (tag || "").toLowerCase().trim();
  if (!normalizedTag) {
    return "🏷️";
  }
  if (TAG_ICON_MAP[normalizedTag]) {
    return TAG_ICON_MAP[normalizedTag];
  }
  if (/work|project|task|meeting|office|job/.test(normalizedTag)) {
    return "💼";
  }
  if (/health|fit|well|diet|exercise|medical|clinic/.test(normalizedTag)) {
    return "🩺";
  }
  if (/recipe|cook|food|meal|kitchen|dish|bake|restaurant/.test(normalizedTag)) {
    return "🍲";
  }
  if (/travel|trip|journey|flight|tour|vacation|holiday/.test(normalizedTag)) {
    return "✈️";
  }
  if (/study|learn|school|class|exam|course|book/.test(normalizedTag)) {
    return "📚";
  }
  if (/finance|money|bill|budget|pay|tax|invoice/.test(normalizedTag)) {
    return "💰";
  }
  if (/family|home|parent|kid|friend/.test(normalizedTag)) {
    return "👪";
  }
  if (/shop|buy|order|store|market/.test(normalizedTag)) {
    return "🛍️";
  }
  if (/idea|brainstorm|plan|goal/.test(normalizedTag)) {
    return "💡";
  }
  return "🏷️";
}

function absoluteAttachmentUrl(url) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${BASE_API_URL}${url}`;
}

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

async function loginUser(email, password) {
  const response = await fetch(`${BASE_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function createAccount(name, email, password) {
  const response = await fetch(`${BASE_API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create account failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function updateUserEmail(userId, email) {
  const response = await fetch(`${BASE_API_URL}/users/${userId}/email`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile update failed: ${response.status} ${text}`);
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
    renderPagination(0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  currentNotesPage = Math.min(Math.max(currentNotesPage, 1), totalPages);
  const startIndex = (currentNotesPage - 1) * NOTES_PER_PAGE;
  const pageNotes = notes.slice(startIndex, startIndex + NOTES_PER_PAGE);

  pageNotes.forEach((note) => {
    list.appendChild(createNoteCard(note));
  });

  renderPagination(notes.length);
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

  const attachmentBlock = document.createElement("div");
  const attachmentPreview = document.createElement("img");
  attachmentPreview.className = "attachment-preview";
  const attachLink = document.createElement("a");
  attachLink.className = "attachment-link";
  attachLink.target = "_blank";
  attachLink.rel = "noopener noreferrer";
  attachLink.title = "View attachment";
  attachLink.innerHTML = "📎 View attachment";
  attachmentBlock.appendChild(attachmentPreview);
  attachmentBlock.appendChild(attachLink);
  card.appendChild(attachmentBlock);

  const hiddenAttachInput = document.createElement("input");
  hiddenAttachInput.type = "file";
  hiddenAttachInput.accept = "image/*,application/pdf";
  hiddenAttachInput.style.display = "none";
  card.appendChild(hiddenAttachInput);

  function refreshAttachmentView() {
    if (!note.attachment_url) {
      attachmentBlock.style.display = "none";
      return;
    }
    const attachmentUrl = absoluteAttachmentUrl(note.attachment_url);
    const isImage = /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(attachmentUrl);
    attachLink.href = attachmentUrl;
    attachmentPreview.style.display = isImage ? "block" : "none";
    if (isImage) {
      attachmentPreview.src = attachmentUrl;
      attachmentPreview.alt = `Attachment preview for ${note.title}`;
    }
    attachmentBlock.style.display = "block";
  }

  refreshAttachmentView();

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
  editButton.className = "btn-indigo";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save";
  saveButton.className = "btn-indigo";
  saveButton.style.display = "none";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.display = "none";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.className = "danger-btn";
    
  const addAttachmentBtn = document.createElement("button");
  addAttachmentBtn.type = "button";
  addAttachmentBtn.textContent = "Add attachment";
  addAttachmentBtn.className = "btn-teal";
  addAttachmentBtn.style.display = "none";

  const removeAttachmentBtn = document.createElement("button");
  removeAttachmentBtn.type = "button";
  removeAttachmentBtn.textContent = "Remove attachment";
  removeAttachmentBtn.className = "btn-amber";
  removeAttachmentBtn.style.display = "none";

  const enterEditMode = () => {
    title.style.display = "none";
    content.style.display = "none";
    tagLine.style.display = "none";
    editFields.style.display = "block";
    editButton.style.display = "none";
    saveButton.style.display = "inline-block";
    cancelButton.style.display = "inline-block";
    addAttachmentBtn.style.display = "inline-block";
    removeAttachmentBtn.style.display = "inline-block";
  };

  const exitEditMode = () => {
    title.style.display = "block";
    content.style.display = "block";
    tagLine.style.display = "block";
    editFields.style.display = "none";
    editButton.style.display = "inline-block";
    saveButton.style.display = "none";
    cancelButton.style.display = "none";
    addAttachmentBtn.style.display = "none";
    removeAttachmentBtn.style.display = "none";
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
    const shouldDelete = window.confirm("Are you sure you want to delete this note? This will remove it from the database.");
    if (!shouldDelete) {
      return;
    }
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

  addAttachmentBtn.addEventListener("click", () => {
    hiddenAttachInput.click();
  });

  hiddenAttachInput.addEventListener("change", async () => {
    if (!hiddenAttachInput.files || hiddenAttachInput.files.length === 0) {
      return;
    }
    try {
      addAttachmentBtn.disabled = true;
      const result = await uploadAttachment(note.id, hiddenAttachInput.files[0]);
      note.attachment_url = result.url;
      allNotes = allNotes.map((item) => (item.id === note.id ? { ...item, attachment_url: result.url } : item));
      refreshAttachmentView();
      hiddenAttachInput.value = "";
      showToast("Attachment added");
    } catch (err) {
      showError(err.message);
    } finally {
      addAttachmentBtn.disabled = false;
    }
  });

  removeAttachmentBtn.addEventListener("click", async () => {
    try {
      removeAttachmentBtn.disabled = true;
      await removeAttachment(note.id);
      note.attachment_url = null;
      allNotes = allNotes.map((item) => (item.id === note.id ? { ...item, attachment_url: null } : item));
      refreshAttachmentView();
      showToast("Attachment removed");
    } catch (err) {
      showError(err.message);
    } finally {
      removeAttachmentBtn.disabled = false;
    }
  });

  controls.appendChild(editButton);
  controls.appendChild(saveButton);
  controls.appendChild(cancelButton);
  controls.appendChild(addAttachmentBtn);
  controls.appendChild(removeAttachmentBtn);
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

async function removeAttachment(noteId) {
  const response = await fetch(`${BASE_API_URL}/notes/${noteId}/attachment`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Remove attachment failed: ${response.status} ${errText}`);
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

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function clearError() {
  showError("");
}

function syncSignedUserLabel() {
  const signedUserLabel = document.getElementById("signed-user-label");
  if (signedUserLabel && currentUser) {
    signedUserLabel.textContent = `Logged in as ${currentUser.name}`;
  }
}

function setLoading(isLoading) {
  const loading = document.getElementById("loading-message");
  if (loading) {
    loading.style.display = isLoading ? "block" : "none";
  }
}

function normalizeText(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function getQueryTerms(query) {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  const terms = new Set(tokens);

  tokens.forEach((token) => {
    const synonyms = SYNONYM_MAP[token];
    if (synonyms) {
      synonyms.forEach((synonym) => terms.add(synonym));
    }
  });

  return Array.from(terms);
}

function relevanceScore(note, queryTerms) {
  const haystack = normalizeText([note.title, note.content, note.tag].join(" "));
  const titleText = normalizeText(note.title);
  const tagText = normalizeText(note.tag);
  let score = 0;

  queryTerms.forEach((term) => {
    if (haystack.includes(term)) {
      score += 12;
    }
    if (titleText.includes(term)) {
      score += 4;
    }
    if (tagText.includes(term)) {
      score += 6;
    }
  });

  const exactPhrase = queryTerms.join(" ");
  if (exactPhrase && haystack.includes(exactPhrase)) {
    score += 18;
  }

  return score;
}

function updateSmartSearchMeta(query, count) {
  const meta = document.getElementById("smart-search-meta");
  if (!meta) return;
  if (!query) {
    meta.style.display = "none";
    meta.textContent = "";
    return;
  }
  meta.style.display = "block";
  meta.textContent = `${count} result${count === 1 ? "" : "s"} for "${query}"`;
}

function getDisplayedNotes() {
  const searchTerm = document.getElementById("plain-search")?.value.trim().toLowerCase() || "";
  const relevanceQuery = document.getElementById("smart-search-query")?.value.trim() || "";
  const relevanceTerms = relevanceQuery ? getQueryTerms(relevanceQuery) : [];
  const tagDropdownValue = document.getElementById("notes-tag-filter")?.value || "";
  const tagFilter = activeTagFilter || tagDropdownValue;
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
      !idFilterValue || note.owner_id === Number(idFilterValue);
    return matchesSearch && matchesTag && matchesQuickTags && matchesId;
  });

  if (relevanceTerms.length > 0) {
    const scored = filtered
      .map((note) => ({ note, score: relevanceScore(note, relevanceTerms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.note.created_at) - new Date(a.note.created_at));

    filtered = scored.map((item) => item.note);
  } else {
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
  }

  updateSmartSearchMeta(relevanceQuery, filtered.length);
  return filtered;
}

function renderPagination(totalNotes) {
  const pagination = document.getElementById("notes-pagination");
  if (!pagination) {
    return;
  }

  if (totalNotes === 0) {
    pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalNotes / NOTES_PER_PAGE));
  currentNotesPage = Math.min(Math.max(currentNotesPage, 1), totalPages);
  const start = (currentNotesPage - 1) * NOTES_PER_PAGE + 1;
  const end = Math.min(currentNotesPage * NOTES_PER_PAGE, totalNotes);

  pagination.innerHTML = `
    <button type="button" class="secondary small-button" data-page-action="prev" ${currentNotesPage === 1 ? "disabled" : ""}>Prev</button>
    <span class="notes-pagination-label">Showing ${start}-${end} of ${totalNotes}</span>
    <button type="button" class="secondary small-button" data-page-action="next" ${currentNotesPage === totalPages ? "disabled" : ""}>Next</button>
  `;

  pagination.querySelectorAll("button[data-page-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.pageAction;
      if (action === "prev" && currentNotesPage > 1) {
        currentNotesPage -= 1;
      }
      if (action === "next" && currentNotesPage < totalPages) {
        currentNotesPage += 1;
      }
      renderNotes(getDisplayedNotes());
    });
  });
}

function updateNotesDisplay() {
  currentNotesPage = 1;
  renderNotes(getDisplayedNotes());
}

function updateActiveTreeLabels() {
  document.querySelectorAll("#tree-root .tag-label").forEach((label) => {
    const nodeTags = (label.dataset.nodeTags || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    const hasSelectedTag = nodeTags.some((tag) => selectedQuickTags.has(tag));
    if (hasSelectedTag || (activeTagFilter && label.dataset.tag?.toLowerCase() === activeTagFilter.toLowerCase())) {
      label.classList.add("active-tag");
    } else {
      label.classList.remove("active-tag");
    }
  });
}

function getAllKnownTags() {
  const tags = new Set(DEFAULT_TAGS);
  allNotes.forEach((note) => {
    const cleanedTag = (note.tag || "").trim().toLowerCase();
    if (cleanedTag) {
      tags.add(cleanedTag);
    }
  });
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function updateQuickTagSearchInput() {
  const quickTagSearch = document.getElementById("quick-tag-search");
  if (!quickTagSearch) {
    return;
  }

  const selected = Array.from(selectedQuickTags);
  quickTagSearch.value = selected.join(", ");
}

function renderQuickTagPills() {
  const pillsContainer = document.getElementById("quick-tag-pills");
  if (!pillsContainer) {
    return;
  }

  pillsContainer.innerHTML = "";
  Array.from(selectedQuickTags)
    .sort((a, b) => a.localeCompare(b))
    .forEach((tag) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "tag-pill";
      pill.innerHTML = `${getTagIcon(tag)} ${tag} <span class="tag-pill-close" aria-hidden="true">&times;</span>`;
      pill.setAttribute("aria-label", `Remove ${tag}`);
      pill.addEventListener("click", () => {
        selectedQuickTags.delete(tag);
        updateQuickTagSearchInput();
        renderQuickTagPills();
        updateActiveTreeLabels();
        updateNotesDisplay();
      });
      pillsContainer.appendChild(pill);
    });
}

function collectNodeTags(node) {
  const tags = [node.name.toLowerCase()];
  (node.children || []).forEach((child) => {
    collectNodeTags(child).forEach((tag) => tags.push(tag));
  });
  return Array.from(new Set(tags));
}

function getNodePath(node, parentPath = "") {
  const nodeSlug = node.name.toLowerCase().replace(/\s+/g, "-");
  return parentPath ? `${parentPath}/${nodeSlug}` : nodeSlug;
}

function initializeCollapsedTree(node, parentPath = "") {
  const nodePath = getNodePath(node, parentPath);
  if (node.children && node.children.length > 0) {
    collapsedTreeNodes.add(nodePath);
    node.children.forEach((child) => initializeCollapsedTree(child, nodePath));
  }
}

function toggleNodeTagSet(nodeTags) {
  if (nodeTags.length === 0) {
    return;
  }

  const allSelected = nodeTags.every((tag) => selectedQuickTags.has(tag));
  if (allSelected) {
    nodeTags.forEach((tag) => selectedQuickTags.delete(tag));
  } else {
    nodeTags.forEach((tag) => selectedQuickTags.add(tag));
  }

  const tagDropdown = document.getElementById("notes-tag-filter");
  if (tagDropdown) {
    tagDropdown.value = "";
  }
  activeTagFilter = null;
  clearQuickSpecialMode();
  updateQuickTagSearchInput();
  renderQuickTagPills();
  updateActiveTreeLabels();
  updateNotesDisplay();
}

function renderTreeNode(node, parentPath = "") {
  const li = document.createElement("li");
  const nodePath = getNodePath(node, parentPath);
  const nodeRow = document.createElement("div");
  nodeRow.className = "tree-node-row";

  if (node.children && node.children.length > 0) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "tree-toggle";
    const isCollapsed = collapsedTreeNodes.has(nodePath);
    toggleButton.textContent = isCollapsed ? "▸" : "▾";
    toggleButton.setAttribute("aria-label", `${isCollapsed ? "Expand" : "Collapse"} ${node.name}`);
    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (collapsedTreeNodes.has(nodePath)) {
        collapsedTreeNodes.delete(nodePath);
      } else {
        collapsedTreeNodes.add(nodePath);
      }
      buildCategoryTree();
    });
    nodeRow.appendChild(toggleButton);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "tree-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    nodeRow.appendChild(spacer);
  }

  const label = document.createElement("span");
  label.textContent = `${getTagIcon(node.name)} ${node.name}`;
  label.className = "tag-label";
  label.dataset.tag = node.name;

  const nodeTags = collectNodeTags(node).filter((tag) => tag !== "all tags");
  label.dataset.nodeTags = nodeTags.join(",");

  label.addEventListener("click", (event) => {
    event.stopPropagation();
    if (node.name === "All Tags") {
      resetQuickFilters();
      return;
    }
    toggleNodeTagSet(nodeTags);
  });

  nodeRow.appendChild(label);
  li.appendChild(nodeRow);

  if (node.children && node.children.length > 0) {
    const childrenList = document.createElement("ul");
    childrenList.className = "tag-tree-list";
    childrenList.style.display = collapsedTreeNodes.has(nodePath) ? "none" : "block";
    node.children.forEach((child) => {
      childrenList.appendChild(renderTreeNode(child, nodePath));
    });
    li.appendChild(childrenList);
  }

  return li;
}

function updateTagFilterOptions() {
  const select = document.getElementById("notes-tag-filter");
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const tags = getAllKnownTags();

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All tags";
  select.appendChild(allOption);

  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    select.appendChild(option);
  });

  if (currentValue && tags.includes(currentValue.toLowerCase())) {
    select.value = currentValue;
  }

  updateQuickTagSearchInput();
  renderQuickTagPills();
  buildCategoryTree();
}

function clearTagTreeFilter() {
  activeTagFilter = null;
  const notesTagFilter = document.getElementById("notes-tag-filter");
  if (notesTagFilter) {
    notesTagFilter.value = "";
  }
  updateActiveTreeLabels();
}

function resetAllFilters() {
  const plainSearch = document.getElementById("plain-search");
  const notesTagFilter = document.getElementById("notes-tag-filter");
  const notesSortOrder = document.getElementById("notes-sort-order");
  const smartSearchQuery = document.getElementById("smart-search-query");

  clearTagTreeFilter();

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
  updateSmartSearchMeta("", 0);
  resetQuickFilters();
}

function filterNotes(value) {
  updateNotesDisplay();
}

function buildCategoryTree() {
  const root = document.getElementById("tree-root");
  if (!root) {
    return;
  }
  root.innerHTML = "";
  const tree = document.createElement("ul");
  tree.className = "tag-tree-list";
  tree.appendChild(renderTreeNode(CATEGORY_TREE, ""));

  root.appendChild(tree);
  updateActiveTreeLabels();
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
  currentNotesPage = 1;
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
  currentNotesPage = 1;
  renderNotes([foundNote]);

  resultContainer.innerHTML = `<strong>Found:</strong> ${foundNote.title} <span class="tag">${foundNote.tag || "none"}</span>`;
  highlightNote(foundNote.id);
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
  updateQuickTagSearchInput();
  renderQuickTagPills();
  updateActiveTreeLabels();
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
  clearTagTreeFilter();
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
  const signOutBtn = document.getElementById("sign-out-btn");

  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      currentUser = null;
      persistCurrentUser();
      const appShell = document.getElementById("app-shell");
      const authScreen = document.getElementById("auth-screen");
      if (appShell) appShell.style.display = "none";
      if (authScreen) authScreen.style.display = "flex";
      const authStatus = document.getElementById("auth-status");
      if (authStatus) authStatus.textContent = "Signed out.";
      showToast("Logged out successfully");
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
      const owner_id = currentUser?.id;
      if (!title || !content) {
        document.getElementById("form-error").textContent = "Title and content are required.";
        return;
      }
      if (!owner_id) {
        document.getElementById("form-error").textContent = "Please log in again to create a note.";
        return;
      }
      document.getElementById("form-error").textContent = "";
      try {
        const created = await createNote({ title, content, tag, owner_id });
        allNotes.unshift(created);
        updateTagFilterOptions();
        updateNotesDisplay();
        event.target.reset();
      } catch (err) {
        document.getElementById("form-error").textContent = err.message;
      }
    });
  }

  const rankBtn = document.getElementById("rank-search-btn");
  if (rankBtn) rankBtn.addEventListener("click", performRankSearch);
  const lookupBtn = document.getElementById("lookup-btn");
  if (lookupBtn) lookupBtn.addEventListener("click", performLookup);
  const smartSearchInput = document.getElementById("smart-search-query");
  if (smartSearchInput) {
    smartSearchInput.addEventListener("input", () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        updateNotesDisplay();
      }, 250);
    });
  }
  const notesTagFilter = document.getElementById("notes-tag-filter");
  if (notesTagFilter) {
    notesTagFilter.addEventListener("change", () => {
      activeTagFilter = notesTagFilter.value || null;
      updateActiveTreeLabels();
      updateNotesDisplay();
    });
  }
  const notesSortOrder = document.getElementById("notes-sort-order");
  if (notesSortOrder) notesSortOrder.addEventListener("change", updateNotesDisplay);
  const resetButton = document.getElementById("reset-filters-btn");
  if (resetButton) resetButton.addEventListener("click", resetAllFilters);
  const quickIdFilter = document.getElementById("quick-id-filter");
  if (quickIdFilter) {
    quickIdFilter.addEventListener("input", updateNotesDisplay);
  }
  const quickClearBtn = document.getElementById("quick-clear-filters-btn");
  if (quickClearBtn) {
    quickClearBtn.addEventListener("click", resetQuickFilters);
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
      const status = document.getElementById("import-status");
      if (!fileInput || !status) return;
      if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = "Please choose a .txt file to upload.";
        return;
      }
      if (!currentUser?.id) {
        status.textContent = "Please log in again before importing notes.";
        return;
      }
      status.textContent = "Uploading file...";
      try {
        await importNotes(currentUser.id, fileInput.files[0]);
        status.textContent = "Notes imported successfully.";
        await loadNotes();
        fileInput.value = "";
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }
}

function setPasswordToggle(toggleButtonId, inputId) {
  const toggleBtn = document.getElementById(toggleButtonId);
  const input = document.getElementById(inputId);
  if (!toggleBtn || !input) {
    return;
  }
  const icon = toggleBtn.querySelector(".material-symbols-outlined");
  toggleBtn.addEventListener("click", () => {
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    if (icon) {
      icon.textContent = nextType === "password" ? "visibility_off" : "visibility";
    }
  });
}

function setupNavSectionHighlight() {
  const sections = ["notes", "add-note", "category-tree", "quick-tags-panel"];
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const sectionId = entry.target.id;
        document.querySelectorAll("#top-nav .nav-link").forEach((link) => {
          const isActive = link.getAttribute("href") === `#${sectionId}`;
          link.classList.toggle("active", isActive);
        });
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach((id) => {
    const section = document.getElementById(id);
    if (section) {
      observer.observe(section);
    }
  });
}

function initAuthUI() {
  const showLoginBtn = document.getElementById("show-login-btn");
  const showRegisterBtn = document.getElementById("show-register-btn");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authStatus = document.getElementById("auth-status");
  const appShell = document.getElementById("app-shell");
  const authScreen = document.getElementById("auth-screen");
  const signedUserLabel = document.getElementById("signed-user-label");
  const profileBtn = document.getElementById("profile-btn");
  const profileModal = document.getElementById("profile-modal");
  const profileCloseBtn = document.getElementById("profile-close-btn");
  const profileSaveBtn = document.getElementById("profile-save-btn");
  const profileName = document.getElementById("profile-name");
  const profileId = document.getElementById("profile-id");
  const profileEmail = document.getElementById("profile-email");
  const profileStatus = document.getElementById("profile-status");

  const showLogin = () => {
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
    if (authStatus) authStatus.textContent = "";
    showLoginBtn?.classList.add("active");
    showRegisterBtn?.classList.remove("active");
    showLoginBtn?.setAttribute("aria-selected", "true");
    showRegisterBtn?.setAttribute("aria-selected", "false");
  };

  const showRegister = () => {
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
    if (authStatus) authStatus.textContent = "";
    showRegisterBtn?.classList.add("active");
    showLoginBtn?.classList.remove("active");
    showRegisterBtn?.setAttribute("aria-selected", "true");
    showLoginBtn?.setAttribute("aria-selected", "false");
  };

  const openProfileModal = () => {
    if (!currentUser || !profileModal) {
      return;
    }
    if (profileId) profileId.value = currentUser.id || "";
    if (profileName) profileName.value = currentUser.name || "";
    if (profileEmail) profileEmail.value = currentUser.email || "";
    if (profileStatus) profileStatus.textContent = "";
    profileModal.style.display = "flex";
  };

  const closeProfileModal = () => {
    if (profileModal) {
      profileModal.style.display = "none";
    }
  };

  showLoginBtn?.addEventListener("click", showLogin);
  showRegisterBtn?.addEventListener("click", showRegister);

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value || "";
    if (!email || !password) {
      if (authStatus) authStatus.textContent = "Enter email and password.";
      return;
    }
    try {
      const user = await loginUser(email, password);
      currentUser = user;
      persistCurrentUser();
      if (signedUserLabel) {
        signedUserLabel.textContent = `Logged in as ${user.name}`;
      }
      if (authScreen) authScreen.style.display = "none";
      if (appShell) appShell.style.display = "block";
      showToast("Logged in successfully");
      await loadNotes();
      setupNavSectionHighlight();
    } catch (err) {
      if (authStatus) authStatus.textContent = err.message;
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("register-name")?.value.trim();
    const email = document.getElementById("register-email")?.value.trim();
    const password = document.getElementById("register-password")?.value || "";
    if (!name || !email || !password) {
      if (authStatus) authStatus.textContent = "Fill all fields to create account.";
      return;
    }
    try {
      await createAccount(name, email, password);
      if (authStatus) authStatus.textContent = "Account created. Please login.";
      showLogin();
      const loginEmail = document.getElementById("login-email");
      if (loginEmail) loginEmail.value = email;
    } catch (err) {
      if (authStatus) authStatus.textContent = err.message;
    }
  });

  profileBtn?.addEventListener("click", openProfileModal);
  profileCloseBtn?.addEventListener("click", closeProfileModal);

  profileModal?.addEventListener("click", (event) => {
    if (event.target === profileModal) {
      closeProfileModal();
    }
  });

  profileSaveBtn?.addEventListener("click", async () => {
    if (!currentUser || !profileEmail) {
      return;
    }
    const nextEmail = profileEmail.value.trim();
    if (!nextEmail) {
      if (profileStatus) profileStatus.textContent = "Email is required.";
      return;
    }
    try {
      profileSaveBtn.disabled = true;
      const updated = await updateUserEmail(currentUser.id, nextEmail);
      currentUser = { ...currentUser, email: updated.email, name: updated.name };
      persistCurrentUser();
      syncSignedUserLabel();
      if (profileStatus) profileStatus.textContent = "Email updated.";
      showToast("Profile updated");
    } catch (err) {
      if (profileStatus) profileStatus.textContent = err.message;
    } finally {
      profileSaveBtn.disabled = false;
    }
  });

  setPasswordToggle("toggle-login-password", "login-password");
  setPasswordToggle("toggle-register-password", "register-password");
}

window.addEventListener("DOMContentLoaded", () => {
  if (collapsedTreeNodes.size === 0) {
    initializeCollapsedTree(CATEGORY_TREE);
  }
  attachListeners();
  initAuthUI();
  currentUser = restoreCurrentUser();
  if (currentUser) {
    const appShell = document.getElementById("app-shell");
    const authScreen = document.getElementById("auth-screen");
    const signedUserLabel = document.getElementById("signed-user-label");
    if (signedUserLabel) {
      signedUserLabel.textContent = `Logged in as ${currentUser.name || "user"}`;
    }
    if (authScreen) authScreen.style.display = "none";
    if (appShell) appShell.style.display = "block";
    loadNotes();
    setupNavSectionHighlight();
  }
  updateTagFilterOptions();
});
// State management
let activeTagFilter = null;
