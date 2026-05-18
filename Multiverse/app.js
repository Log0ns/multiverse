// app.js - Bible Study App (Unified Note System)
(function() {
"use strict";

// --- DOM Elements ---
const statusBar = document.getElementById("status-bar");
const bookNav = document.getElementById("book-nav");
const chapterNav = document.getElementById("chapter-nav");
const chapterInfo = document.getElementById("chapter-info");
const noteList = document.getElementById("note-list");
const tooltip = document.getElementById("tooltip");
const colorKey = document.getElementById("color-key");
const detailPanel = document.getElementById("detail-panel");
const keywordChecklist = document.getElementById("keyword-checklist");
const canvas = document.getElementById("graph");

// --- State ---
let selectedBook = null;
let selectedChapter = null;
let selectedChapterKey = null;

// --- Init ---
async function init() {
  Graph.init(canvas, {
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onLink: handleLink
  });
  setupTabs();
  buildBookNav();
  selectBook("Genesis");
  await Store.reconnectFolder();
  refreshAll();
}

// --- Tabs ---
function setupTabs() {
  const tabBtns = document.querySelectorAll("#sidebar-tabs button");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function switchToTab(tabName) {
  const tabBtns = document.querySelectorAll("#sidebar-tabs button");
  tabBtns.forEach(b => b.classList.remove("active"));
  const target = [...tabBtns].find(b => b.dataset.tab === tabName);
  if (target) target.classList.add("active");
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById("panel-" + tabName).classList.add("active");
}

// --- Book/Chapter Navigation ---
const BOOK_NAMES = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes",
  "Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
  "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk",
  "Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation"
];

const CHAPTER_COUNTS = {
  "Genesis":50,"Exodus":40,"Leviticus":27,"Numbers":36,"Deuteronomy":34,
  "Joshua":24,"Judges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,
  "1 Kings":22,"2 Kings":25,"1 Chronicles":29,"2 Chronicles":36,
  "Ezra":10,"Nehemiah":13,"Esther":10,"Job":42,"Psalms":150,"Proverbs":31,
  "Ecclesiastes":12,"Song of Solomon":8,"Isaiah":66,"Jeremiah":52,
  "Lamentations":5,"Ezekiel":48,"Daniel":12,"Hosea":14,"Joel":3,"Amos":9,
  "Obadiah":1,"Jonah":4,"Micah":7,"Nahum":3,"Habakkuk":3,"Zephaniah":3,
  "Haggai":2,"Zechariah":14,"Malachi":4,
  "Matthew":28,"Mark":16,"Luke":24,"John":21,"Acts":28,"Romans":16,
  "1 Corinthians":16,"2 Corinthians":13,"Galatians":6,"Ephesians":6,
  "Philippians":4,"Colossians":4,"1 Thessalonians":5,"2 Thessalonians":3,
  "1 Timothy":6,"2 Timothy":4,"Titus":3,"Philemon":1,"Hebrews":13,
  "James":5,"1 Peter":5,"2 Peter":3,"1 John":5,"2 John":1,"3 John":1,
  "Jude":1,"Revelation":22
};

function buildBookNav() {
  bookNav.innerHTML = "";
  const chaptersWithNotes = Store.getChaptersWithNotes();
  for (const book of BOOK_NAMES) {
    const btn = document.createElement("button");
    btn.textContent = book;
    btn.addEventListener("click", () => selectBook(book));
    if (book === selectedBook) btn.classList.add("active");
    const total = CHAPTER_COUNTS[book];
    let allHaveNotes = total > 0;
    for (let i = 1; i <= total && allHaveNotes; i++) {
      if (!chaptersWithNotes.has(book + "_" + i)) allHaveNotes = false;
    }
    if (allHaveNotes && total > 0) btn.classList.add("book-complete");
    bookNav.appendChild(btn);
  }
}

function buildChapterNav() {
  chapterNav.innerHTML = "";
  if (!selectedBook) return;
  const count = CHAPTER_COUNTS[selectedBook];
  const chaptersWithNotes = Store.getChaptersWithNotes();
  for (let i = 1; i <= count; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    const key = selectedBook + "_" + i;
    if (chaptersWithNotes.has(key)) btn.classList.add("has-notes");
    if (i === selectedChapter) btn.classList.add("selected");
    btn.addEventListener("click", () => selectChapter(i));
    chapterNav.appendChild(btn);
  }
}

function selectBook(book) {
  selectedBook = book;
  buildBookNav();
  buildChapterNav();
  selectChapter(1);
}

function selectChapter(num) {
  selectedChapter = num;
  selectedChapterKey = selectedBook + "_" + num;
  buildChapterNav();
  updateChapterInfo();
  updateBiblePanel();
  Graph.focusOnChapter(selectedChapterKey);
  const lbl = document.querySelector("#panel-notes > label");
  if (lbl) lbl.textContent = "New Note (linked to " + selectedBook + " " + num + ")";
}

// --- Chapter Info ---
function updateChapterInfo() {
  if (!selectedChapterKey) { chapterInfo.innerHTML = ""; return; }
  const notes = Store.getNotesForChapter(selectedChapterKey);
  let html = "<strong>" + selectedBook + " " + selectedChapter + "</strong>";
  html += " &mdash; " + notes.length + " note" + (notes.length !== 1 ? "s" : "");
  if (notes.length > 0) {
    html += '<div style="margin-top:6px;">';
    for (const n of notes) {
      html += '<div class="note-item" style="border-left-color:' + n.color + ';margin:3px 0;padding:4px 8px;" data-note-id="' + n.id + '">' + n.title + '</div>';
    }
    html += "</div>";
  }
  chapterInfo.innerHTML = html;
  chapterInfo.querySelectorAll("[data-note-id]").forEach(el => {
    el.addEventListener("click", () => {
      const id = parseInt(el.dataset.noteId);
      switchToTab("notes");
      Graph.focusOnNode("note_" + id);
      highlightNoteInList(id);
    });
  });
}

function highlightNoteInList(id) {
  noteList.querySelectorAll(".note-item").forEach(el => {
    const match = parseInt(el.dataset.noteId) === id;
    el.style.outline = match ? "1px solid #60a5fa" : "";
    if (match) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

// --- Bible Text Panel ---
let bibleWordSelection = [];
let bibleWordDragging = false;

function updateBiblePanel() {
  if (!selectedChapterKey) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; return; }
  const ch = String(selectedChapter);
  const bookData = BIBLE_DATA[selectedBook];
  if (!bookData) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; return; }
  const chData = bookData[ch];
  if (!chData) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; return; }
  let html = "<h3>" + selectedBook + " " + ch + "</h3>";
  for (const v of chData) {
    html += '<p><sup style="color:#6b7280;margin-right:4px;">' + v.verse + "</sup>";
    const words = v.text.split(/(\s+)/);
    for (const w of words) {
      if (/^\s+$/.test(w)) { html += w; }
      else { html += '<span class="bible-word">' + w + '</span>'; }
    }
    html += "</p>";
  }
  detailPanel.innerHTML = html;
  detailPanel.style.display = "block";
  bibleWordSelection = [];
  const wordEls = detailPanel.querySelectorAll(".bible-word");
  wordEls.forEach(el => {
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      bibleWordDragging = true;
      bibleWordSelection = [];
      wordEls.forEach(w => w.style.background = "");
      el.style.background = "#3b82f644";
      bibleWordSelection.push(el.textContent.replace(/[^a-zA-Z0-9' -]/g, ""));
      updateBibleWordBar();
    });
    el.addEventListener("mouseenter", () => {
      if (!bibleWordDragging) return;
      el.style.background = "#3b82f644";
      bibleWordSelection.push(el.textContent.replace(/[^a-zA-Z0-9' -]/g, ""));
      updateBibleWordBar();
    });
  });
  detailPanel.addEventListener("mouseup", () => { bibleWordDragging = false; });
  updateKeywordChecklist(chData);
}

function updateBibleWordBar() {
  const bar = document.getElementById("bible-word-bar");
  if (!bar) return;
  const text = bibleWordSelection.join(" ").trim();
  if (!text) { bar.style.display = "none"; return; }
  const existing = Store.getNotes().find(n => n.title.toLowerCase() === text.toLowerCase());
  let html = '<div class="selected-text">"' + text + '"</div>';
  if (existing) {
    html += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-open">Open Note</button>';
  } else {
    html += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-create">Create Note</button>';
  }
  html += '<button class="btn btn-secondary" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-clear">Clear</button>';
  bar.innerHTML = html;
  bar.style.display = "block";
  if (existing) {
    bar.querySelector("#bible-word-open").addEventListener("click", () => {
      if (!existing.chapters.includes(selectedChapterKey)) {
        Store.attachNoteToChapter(existing.id, selectedChapterKey);
        refreshAll();
      }
      expandedNoteId = existing.id;
      switchToTab("notes");
      refreshNoteList();
      highlightNoteInList(existing.id);
      showEditPanel(existing.id);
      clearBibleWordSelection();
    });
  } else {
    bar.querySelector("#bible-word-create").addEventListener("click", () => {
      const note = Store.createNote(text, "", selectedChapterKey);
      refreshAll();
      expandedNoteId = note.id;
      switchToTab("notes");
      refreshNoteList();
      highlightNoteInList(note.id);
      showEditPanel(note.id);
      clearBibleWordSelection();
    });
  }
  bar.querySelector("#bible-word-clear").addEventListener("click", clearBibleWordSelection);
}

function clearBibleWordSelection() {
  bibleWordSelection = [];
  detailPanel.querySelectorAll(".bible-word").forEach(w => w.style.background = "");
  const bar = document.getElementById("bible-word-bar");
  if (bar) bar.style.display = "none";
}

// --- Keyword Checklist ---
function stem(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length < 4) return word;
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("tion")) return word.slice(0, -4);
  if (word.endsWith("ness")) return word.slice(0, -4);
  if (word.endsWith("ment")) return word.slice(0, -4);
  if (word.endsWith("able")) return word.slice(0, -4);
  if (word.endsWith("ous")) return word.slice(0, -3);
  if (word.endsWith("ful")) return word.slice(0, -3);
  if (word.endsWith("less")) return word.slice(0, -4);
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("ed")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  if (word.endsWith("ly")) return word.slice(0, -2);
  return word;
}

function extractKeywords(text) {
  const stop = new Set(["the","and","of","to","in","a","that","is","was","for","it","with","he","his","him","her","she","they","them","this","but","not","are","were","be","have","has","had","from","or","an","will","all","would","there","their","what","which","when","who","how","been","if","its","than","into","our","your","you","shall","upon","may","said","unto"]);
  const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
  const freq = {};
  for (const w of words) {
    if (w.length < 4 || stop.has(w)) continue;
    const s = stem(w);
    if (s.length < 3) continue;
    freq[s] = (freq[s] || { stem: s, word: w, count: 0 });
    freq[s].count++;
  }
  return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 20);
}

function updateKeywordChecklist(chData) {
  const allText = chData.map(v => v.text).join(" ");
  const keywords = extractKeywords(allText);
  if (keywords.length === 0) { keywordChecklist.innerHTML = "<em style='color:#6b7280;'>No keywords</em>"; return; }
  let html = "";
  for (const kw of keywords) {
    html += '<label style="display:block;font-size:0.75rem;margin:2px 0;cursor:pointer;"><input type="checkbox" value="' + kw.word + '" style="margin-right:4px;">' + kw.word + ' (' + kw.count + ')</label>';
  }
  keywordChecklist.innerHTML = html;
}

// --- Create Notes from Keywords ---
document.getElementById("btn-create-from-keywords").addEventListener("click", () => {
  if (!selectedChapterKey) return;
  const checked = keywordChecklist.querySelectorAll("input[type=checkbox]:checked");
  if (checked.length === 0) return;
  checked.forEach(cb => {
    const title = cb.value.charAt(0).toUpperCase() + cb.value.slice(1);
    Store.createNote(title, "", selectedChapterKey);
  });
  refreshAll();
});

// --- Note Creation ---
document.getElementById("btn-create-note").addEventListener("click", () => {
  const titleEl = document.getElementById("new-note-title");
  const textEl = document.getElementById("new-note-text");
  const title = titleEl.value.trim();
  if (!title) return;
  Store.createNote(title, textEl.value.trim(), selectedChapterKey);
  titleEl.value = "";
  textEl.value = "";
  refreshAll();
});

// --- Note List ---
let expandedNoteId = null;

function refreshNoteList() {
  const notes = Store.getNotes();
  if (notes.length === 0) { noteList.innerHTML = "<em style='color:#6b7280;'>No notes yet</em>"; return; }
  let html = "";
  for (const n of notes) {
    const chCount = n.chapters.length;
    const lnCount = n.linkedNotes.length;
    html += '<div class="note-item" data-note-id="' + n.id + '" style="border-left-color:' + n.color + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<strong style="color:' + n.color + ';">' + n.title + '</strong>';
    html += '<span>';
    html += '<button class="note-edit-btn" data-id="' + n.id + '" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:0.8rem;padding:2px 4px;">&#9998;</button>';
    html += '<button class="note-del-btn" data-id="' + n.id + '" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:0.8rem;padding:2px 4px;">&#10005;</button>';
    html += '</span></div>';
    html += '<div style="font-size:0.7rem;color:#6b7280;margin-top:2px;">' + chCount + ' ch / ' + lnCount + ' linked</div>';
    if (expandedNoteId === n.id) {
      html += buildConnectionBars(n);
    }
    html += '</div>';
  }
  noteList.innerHTML = html;
  // Event listeners
  noteList.querySelectorAll(".note-item").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".note-edit-btn") || e.target.closest(".note-del-btn") || e.target.closest("[id^=\"edit-panel-\"]") || e.target.closest("[id^=\"del-panel-\"]")) return;
      const id = parseInt(el.dataset.noteId);
      expandedNoteId = (expandedNoteId === id) ? null : id;
      Graph.focusOnNode("note_" + id);
      refreshNoteList();
    });
  });
  noteList.querySelectorAll(".note-edit-btn").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); showEditPanel(parseInt(btn.dataset.id)); });
  });
  noteList.querySelectorAll(".note-del-btn").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); showDeletePanel(parseInt(btn.dataset.id)); });
  });
  noteList.querySelectorAll("[data-bar-chapter]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = el.dataset.barChapter;
      const parts = key.split("_");
      const ch = parseInt(parts.pop());
      const book = parts.join(" ");
      selectBook(book);
      selectChapter(ch);
      switchToTab("navigate");
    });
  });
  noteList.querySelectorAll("[data-bar-note]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.barNote);
      const note = Store.getNoteById(id);
      if (note && note.chapters.length > 0) {
        const key = note.chapters[0];
        const parts = key.split("_");
        const ch = parseInt(parts.pop());
        const book = parts.join(" ");
        selectBook(book);
        selectChapter(ch);
      }
      expandedNoteId = id;
      Graph.focusOnNode("note_" + id);
      refreshNoteList();
      highlightNoteInList(id);
    });
  });
}

function buildConnectionBars(note) {
  let html = '<div style="margin-top:4px;padding-left:4px;border-left:2px solid ' + note.color + '44;font-size:0.7rem;">';
  for (const ch of note.chapters) {
    const label = ch.replace("_", " ");
    html += '<div data-bar-chapter="' + ch + '" style="color:#60a5fa;cursor:pointer;padding:1px 0;">' + label + '</div>';
  }
  for (const lid of note.linkedNotes) {
    const linked = Store.getNoteById(lid);
    if (linked) {
      html += '<div data-bar-note="' + lid + '" style="color:' + linked.color + ';cursor:pointer;padding:1px 0;">' + linked.title + '</div>';
    }
  }
  html += '</div>';
  return html;
}

// --- Note Edit Panel (Draggable/Resizable Modal) ---
let activeEditId = null;
let activeEditRender = null;

function refreshEditPanel() {
  if (activeEditId !== null && activeEditRender) activeEditRender(true);
}

function showEditPanel(id) {
  const modal = document.getElementById("edit-modal");
  const note = Store.getNoteById(id);
  if (!note) return;
  if (activeEditId === id && modal.classList.contains("active")) return;
  activeEditId = id;
  let pendingChapters = [...note.chapters];
  let pendingLinked = [...note.linkedNotes];
  function renderModal(fromStore) {
    const note = Store.getNoteById(id);
    if (!note) { modal.classList.remove("active"); activeEditId = null; activeEditRender = null; return; }
    if (fromStore) {
      pendingChapters = [...note.chapters];
      pendingLinked = [...note.linkedNotes];
    }
    let html = '<div class="modal-header"><h2 style="color:' + note.color + ';">Edit: ' + note.title.replace(/</g, "&lt;") + '</h2><button class="modal-close-btn">&times;</button></div>';
    html += '<div class="modal-body">';
    html += '<label>Title</label><input type="text" id="edit-title-' + id + '" value="' + note.title.replace(/"/g, "&quot;") + '" style="width:100%;">';
    html += '<label>Text</label><textarea id="edit-text-' + id + '">' + (note.text || "").replace(/</g, "&lt;") + '</textarea>';
    html += '<label>Chapters</label><div class="chip-area">';
    for (const ch of pendingChapters) {
      html += '<span class="chip">' + ch.replace("_", " ") + '<button class="chip-rm-ch" data-ch="' + ch + '">&times;</button></span>';
    }
    html += '</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;margin:4px 0;">';
    html += '<select id="edit-ch-book-' + id + '" style="font-size:0.75rem;flex:1;"><option value="">Book...</option>';
    for (const b of BOOK_NAMES) { html += '<option value="' + b + '">' + b + '</option>'; }
    html += '</select>';
    html += '<select id="edit-ch-num-' + id + '" style="font-size:0.75rem;width:60px;"><option value="">Ch</option></select>';
    html += '<button class="btn btn-secondary add-ch-select-btn" style="font-size:0.7rem;padding:3px 8px;">+</button>';
    html += '<button class="btn btn-secondary suggest-ch-btn" style="font-size:0.7rem;padding:3px 8px;">Suggest</button>';
    html += '</div>';
    html += '<div id="edit-suggestions-' + id + '" style="max-height:100px;overflow-y:auto;font-size:0.72rem;"></div>';
    html += '<label>Linked Notes</label><div class="chip-area">';
    for (const lid of pendingLinked) {
      const ln = Store.getNoteById(lid);
      if (ln) {
        html += '<span class="chip" style="color:' + ln.color + ';">' + ln.title + '<button class="chip-rm-ln" data-lid="' + lid + '">&times;</button></span>';
      }
    }
    html += '</div>';
    const otherNotes = Store.getNotes().filter(n => n.id !== id && !pendingLinked.includes(n.id));
    if (otherNotes.length > 0) {
      html += '<select id="edit-add-link-' + id + '"><option value="">+ Link a note...</option>';
      for (const o of otherNotes) { html += '<option value="' + o.id + '">' + o.title + '</option>'; }
      html += '</select>';
    }
    html += '<div class="btn-row">';
    html += '<button class="btn edit-save-btn">Save</button>';
    html += '<button class="btn btn-secondary edit-cancel-btn">Cancel</button>';
    html += '<button class="btn btn-danger edit-delete-btn" style="margin-left:auto;">Delete</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="resize-handle"></div>';
    modal.innerHTML = html;
    modal.querySelectorAll(".chip-rm-ch").forEach(b => {
      b.addEventListener("click", () => { pendingChapters = pendingChapters.filter(c => c !== b.dataset.ch); renderModal(); });
    });
    modal.querySelectorAll(".chip-rm-ln").forEach(b => {
      b.addEventListener("click", () => { pendingLinked = pendingLinked.filter(l => l !== parseInt(b.dataset.lid)); renderModal(); });
    });
    const bookSel = modal.querySelector("#edit-ch-book-" + id);
    const numSel = modal.querySelector("#edit-ch-num-" + id);
    bookSel.addEventListener("change", () => {
      numSel.innerHTML = '<option value="">Ch</option>';
      const count = CHAPTER_COUNTS[bookSel.value] || 0;
      for (let i = 1; i <= count; i++) { numSel.innerHTML += '<option value="' + i + '">' + i + '</option>'; }
    });
    const addChSelBtn = modal.querySelector(".add-ch-select-btn");
    addChSelBtn.addEventListener("click", () => {
      if (!bookSel.value || !numSel.value) return;
      const key = bookSel.value + "_" + numSel.value;
      if (!pendingChapters.includes(key)) { pendingChapters.push(key); renderModal(); }
    });
    modal.querySelector(".suggest-ch-btn").addEventListener("click", () => {
      const title = document.getElementById("edit-title-" + id).value || "";
      const text = document.getElementById("edit-text-" + id).value || "";
      const query = (title + " " + text).trim();
      if (!query) return;
      const suggestions = suggestChapters(query).filter(s => !pendingChapters.includes(s.key));
      const container = modal.querySelector("#edit-suggestions-" + id);
      if (suggestions.length === 0) { container.innerHTML = "<em style='color:#6b7280;'>No matches</em>"; return; }
      let h = "";
      for (const s of suggestions) {
        h += '<div data-sug-ch="' + s.key + '" style="color:#60a5fa;cursor:pointer;padding:2px 0;">' + s.label + ' (' + s.score + ')</div>';
      }
      container.innerHTML = h;
      container.querySelectorAll("[data-sug-ch]").forEach(el => {
        el.addEventListener("click", () => {
          if (!pendingChapters.includes(el.dataset.sugCh)) { pendingChapters.push(el.dataset.sugCh); renderModal(); }
        });
      });
    });
    const addLinkSel = modal.querySelector("#edit-add-link-" + id);
    if (addLinkSel) addLinkSel.addEventListener("change", () => { if (addLinkSel.value) { pendingLinked.push(parseInt(addLinkSel.value)); renderModal(); } });
    modal.querySelector(".edit-save-btn").addEventListener("click", () => {
      const title = document.getElementById("edit-title-" + id).value.trim();
      const text = document.getElementById("edit-text-" + id).value;
      if (!title) return;
      const oldLinked = note.linkedNotes;
      const removed = oldLinked.filter(lid => !pendingLinked.includes(lid));
      const added = pendingLinked.filter(lid => !oldLinked.includes(lid));
      Store.updateNote(id, { title: title, text: text, chapters: pendingChapters, linkedNotes: pendingLinked });
      for (const lid of removed) {
        const other = Store.getNoteById(lid);
        if (other) Store.updateNote(lid, { linkedNotes: other.linkedNotes.filter(x => x !== id) });
      }
      for (const lid of added) {
        const other = Store.getNoteById(lid);
        if (other && !other.linkedNotes.includes(id)) Store.updateNote(lid, { linkedNotes: [...other.linkedNotes, id] });
      }
      refreshAll();
    });
    modal.querySelector(".edit-cancel-btn").addEventListener("click", () => { modal.classList.remove("active"); activeEditId = null; activeEditRender = null; });
    modal.querySelector(".modal-close-btn").addEventListener("click", () => { modal.classList.remove("active"); activeEditId = null; activeEditRender = null; });
    modal.querySelector(".edit-delete-btn").addEventListener("click", () => {
      const btn = modal.querySelector(".edit-delete-btn");
      if (btn.dataset.confirm) {
        Store.deleteNote(id);
        modal.classList.remove("active");
        activeEditId = null;
        activeEditRender = null;
        refreshAll();
      } else {
        btn.dataset.confirm = "1";
        btn.textContent = "Confirm Delete";
      }
    });
    // Drag
    const header = modal.querySelector(".modal-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      const startX = e.clientX, startY = e.clientY;
      const rect = modal.getBoundingClientRect();
      const origLeft = rect.left, origTop = rect.top;
      function onMove(ev) {
        modal.style.left = (origLeft + ev.clientX - startX) + "px";
        modal.style.top = (origTop + ev.clientY - startY) + "px";
      }
      function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
    // Resize
    const handle = modal.querySelector(".resize-handle");
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const startW = modal.offsetWidth, startH = modal.offsetHeight;
      function onMove(ev) {
        modal.style.width = Math.max(300, startW + ev.clientX - startX) + "px";
        modal.style.height = Math.max(280, startH + ev.clientY - startY) + "px";
      }
      function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }
  activeEditRender = renderModal;
  renderModal();
  modal.classList.add("active");
}

// --- Note Delete Panel ---
function showDeletePanel(id) {
  if (document.getElementById("del-panel-" + id)) return;
  const note = Store.getNoteById(id);
  if (!note) return;
  const panel = document.createElement("div");
  panel.id = "del-panel-" + id;
  panel.style.cssText = "background:#1f2937;border:1px solid #dc2626;border-radius:6px;padding:10px;margin-top:6px;font-size:0.78rem;";
  panel.innerHTML = '<div>Delete "' + note.title + '"?</div><div style="margin-top:6px;display:flex;gap:6px;"><button class="btn btn-danger del-confirm">Delete</button><button class="btn btn-secondary del-cancel">Keep</button></div>';
  panel.querySelector(".del-confirm").addEventListener("click", () => { Store.deleteNote(id); panel.remove(); refreshAll(); });
  panel.querySelector(".del-cancel").addEventListener("click", () => { panel.remove(); });
  const noteEl = noteList.querySelector('[data-note-id="' + id + '"]');
  if (noteEl) noteEl.appendChild(panel);
}

// --- Graph Callbacks ---
function handleNodeClick(node) {
  if (!node) return;
  if (node.type === "chapter") {
    const parts = node.id.split("_");
    const ch = parseInt(parts.pop());
    const book = parts.join(" ");
    selectBook(book);
    selectChapter(ch);
    switchToTab("navigate");
  } else if (node.type === "note") {
    const note = Store.getNoteById(node.noteId);
    if (note && note.chapters.length > 0) {
      const key = note.chapters[0];
      const parts = key.split("_");
      const ch = parseInt(parts.pop());
      const book = parts.join(" ");
      selectedBook = book;
      selectedChapter = ch;
      selectedChapterKey = key;
      buildBookNav();
      buildChapterNav();
      updateBiblePanel();
    }
    switchToTab("notes");
    expandedNoteId = note ? note.id : null;
    refreshNoteList();
    if (note) {
      highlightNoteInList(note.id);
      showEditPanel(note.id);
    }
  }
}

function handleNodeHover(node, mx, my) {
  if (!node) { tooltip.style.display = "none"; return; }
  let html = "";
  if (node.type === "chapter") {
    const notes = Store.getNotesForChapter(node.id);
    html = "<strong>" + node.label + "</strong>";
    if (notes.length > 0) html += "<br>" + notes.length + " note" + (notes.length !== 1 ? "s" : "");
  } else if (node.type === "note") {
    const note = Store.getNoteById(node.noteId);
    if (note) {
      html = "<strong style='color:" + note.color + ";'>" + note.title + "</strong>";
      if (note.text) html += "<br>" + note.text.slice(0, 120) + (note.text.length > 120 ? "..." : "");
      html += "<br><span style='color:#6b7280;'>" + note.chapters.length + " ch / " + note.linkedNotes.length + " linked</span>";
    }
  }
  if (html) {
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    tooltip.style.left = (mx - canvas.parentElement.getBoundingClientRect().left + 12) + "px";
    tooltip.style.top = (my - canvas.parentElement.getBoundingClientRect().top + 12) + "px";
  } else {
    tooltip.style.display = "none";
  }
}

function handleLink(source, target) {
  if (source.type === "note" && target.type === "chapter") {
    Store.attachNoteToChapter(source.noteId, target.id);
  } else if (source.type === "chapter" && target.type === "note") {
    Store.attachNoteToChapter(target.noteId, source.id);
  } else if (source.type === "note" && target.type === "note") {
    Store.linkNotes(source.noteId, target.noteId);
  }
  refreshAll();
}

// --- Color Key ---
function updateColorKey() {
  const notes = Store.getNotes();
  if (notes.length === 0) { colorKey.innerHTML = ""; colorKey.style.display = "none"; return; }
  let html = "";
  for (const n of notes) {
    html += '<div><span class="swatch" style="background:' + n.color + ';"></span>' + n.title + '</div>';
  }
  colorKey.innerHTML = html;
  colorKey.style.display = "block";
}

// --- Status Bar ---
function updateStatus() {
  const notes = Store.getNotes();
  const chCount = Store.getChaptersWithNotes().size;
  statusBar.textContent = notes.length + " notes / " + chCount + " chapters";
  if (Store.isFileSystemConnected()) {
    statusBar.textContent += " [synced]";
  } else {
    statusBar.textContent += " (click to sync folder)";
  }
}

statusBar.addEventListener("click", async () => {
  const ok = await Store.connectFolder();
  if (ok) updateStatus();
});

// --- Export ---
document.getElementById("btn-export-zip").addEventListener("click", () => {
  Store.exportAsZip();
});

document.getElementById("btn-save").addEventListener("click", () => {
  Store.save();
  const data = localStorage.getItem("bible-study-data");
  if (!data) return;
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "multiverse-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-load").addEventListener("click", () => {
  document.getElementById("load-json-input").click();
});

document.getElementById("load-json-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.notes && !parsed.subjects) { updateStatus(); return; }
      localStorage.setItem("bible-study-data", JSON.stringify(parsed));
      Store.load();
      refreshAll();
    } catch (err) { console.error("Invalid JSON", err); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// --- Suggest Chapters ---
document.getElementById("btn-suggest").addEventListener("click", () => {
  const titleEl = document.getElementById("new-note-title");
  const textEl = document.getElementById("new-note-text");
  const query = (titleEl.value + " " + textEl.value).trim();
  if (!query) return;
  const suggestions = suggestChapters(query);
  const container = document.getElementById("suggestions");
  if (suggestions.length === 0) { container.innerHTML = "<em style='color:#6b7280;'>No matches</em>"; return; }
  let html = "";
  for (const s of suggestions) {
    html += '<div data-suggest-ch="' + s.key + '" style="font-size:0.75rem;color:#60a5fa;cursor:pointer;padding:2px 0;">' + s.label + ' (' + s.score + ')</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll("[data-suggest-ch]").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.suggestCh;
      const parts = key.split("_");
      const ch = parseInt(parts.pop());
      const book = parts.join(" ");
      selectBook(book);
      selectChapter(ch);
      switchToTab("navigate");
    });
  });
});

function suggestChapters(query) {
  const queryStems = query.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).map(stem).filter(s => s.length >= 3);
  if (queryStems.length === 0) return [];
  const NT_START = BOOK_NAMES.indexOf("Matthew");
  const ntFirst = [...BOOK_NAMES.slice(NT_START), ...BOOK_NAMES.slice(0, NT_START)];
  const results = [];
  for (const book of ntFirst) {
    const bookData = BIBLE_DATA[book];
    if (!bookData) continue;
    for (const ch of Object.keys(bookData)) {
      const text = bookData[ch].map(v => v.text).join(" ").toLowerCase();
      let score = 0;
      for (const s of queryStems) {
        if (text.includes(s)) score++;
      }
      if (score > 0) results.push({ key: book + "_" + ch, label: book + " " + ch, score: score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

// --- Refresh All ---
function refreshGraph() { Graph.updateDynamicNodes(Store.getNotes()); }

function refreshAll() {
  refreshGraph();
  refreshNoteList();
  refreshEditPanel();
  updateChapterInfo();
  buildChapterNav();
  buildBookNav();
  updateColorKey();
  updateStatus();
}

document.addEventListener("DOMContentLoaded", init);
})();
