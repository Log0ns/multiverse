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
const bibleScrollPositions = {};

// --- Init ---
async function init() {
  Graph.init(canvas, {
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onEdgeHover: handleEdgeHover,
    onNodeLongPress: handleNodeLongPress,
    onBannerHover: handleBannerHover,
    onLink: handleLink
  });
  setupTabs();
  buildBookNav();
  selectBook("Genesis");
  await Store.reconnectFolder();
  refreshAll();
}

// --- Mobile Bible Panel Toggle ---
document.getElementById("btn-bible-toggle").addEventListener("click", () => {
  detailPanel.classList.toggle("active");
});

// --- Mobile Sidebar Toggle ---
const sidebarEl = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  if (window.innerWidth <= 768) {
    sidebarEl.classList.toggle("open");
    sidebarOverlay.classList.toggle("open");
  } else {
    sidebarEl.classList.toggle("hidden");
    setTimeout(() => Graph.resize(), 250);
  }
});
sidebarOverlay.addEventListener("click", () => {
  sidebarEl.classList.remove("open");
  sidebarOverlay.classList.remove("open");
});

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

function updateBiblePanel() {
  if (!selectedChapterKey) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; detailPanel.classList.remove("active"); return; }
  const ch = String(selectedChapter);
  const bookData = BIBLE_DATA[selectedBook];
  if (!bookData) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; detailPanel.classList.remove("active"); return; }
  const chData = bookData[ch];
  if (!chData) { detailPanel.innerHTML = ""; detailPanel.style.display = "none"; detailPanel.classList.remove("active"); return; }
  let html = '<div class="dp-header"><button class="dp-nav dp-prev">&#9664;</button><h3 style="margin:0;flex:1;text-align:center;">' + selectedBook + " " + ch + '</h3><button class="dp-nav dp-next">&#9654;</button><button class="dp-nav dp-mem-tab" title="Memorize">&#9733;</button><span class="dp-toggle">&#9660;</span></div>';
  html += '<div class="dp-body">';
  for (const v of chData) {
    html += '<p class="bible-verse" data-verse="' + v.verse + '" data-text="' + v.text.replace(/"/g, "&quot;") + '"><sup style="color:#6b7280;margin-right:4px;">' + v.verse + "</sup>" + v.text + "</p>";
  }
  html += '</div>';
  detailPanel.innerHTML = html;
  detailPanel.querySelector(".dp-header").addEventListener("click", (e) => {
    if (e.target.closest(".dp-nav") || e.target.closest(".dp-mem-tab")) return;
    detailPanel.classList.toggle("minimized");
    detailPanel.querySelector(".dp-toggle").innerHTML = detailPanel.classList.contains("minimized") ? "&#9654;" : "&#9660;";
  });
  detailPanel.querySelector(".dp-mem-tab").addEventListener("click", () => {
    if (memPanelActive) {
      memPanelActive = false;
      updateBiblePanel();
    } else {
      showMemorizePanel();
    }
  });
  detailPanel.querySelector(".dp-prev").addEventListener("click", () => {
    memPanelActive = false;
    if (selectedChapter > 1) { selectChapter(selectedChapter - 1); }
    else {
      const idx = BOOK_NAMES.indexOf(selectedBook);
      if (idx > 0) { selectBook(BOOK_NAMES[idx - 1]); selectChapter(CHAPTER_COUNTS[BOOK_NAMES[idx - 1]]); }
    }
  });
  detailPanel.querySelector(".dp-next").addEventListener("click", () => {
    memPanelActive = false;
    if (selectedChapter < CHAPTER_COUNTS[selectedBook]) { selectChapter(selectedChapter + 1); }
    else {
      const idx = BOOK_NAMES.indexOf(selectedBook);
      if (idx < BOOK_NAMES.length - 1) { selectBook(BOOK_NAMES[idx + 1]); selectChapter(1); }
    }
  });
  const wasActive = detailPanel.classList.contains("active");
  const wasMinimized = detailPanel.classList.contains("minimized");
  detailPanel.style.display = "flex";
  if (window.innerWidth > 768) {
    detailPanel.classList.add("active");
  } else if (wasActive) {
    detailPanel.classList.add("active");
    if (wasMinimized) {
      detailPanel.classList.add("minimized");
      const toggle = detailPanel.querySelector(".dp-toggle");
      if (toggle) toggle.innerHTML = "&#9654;";
    }
  } else {
    detailPanel.classList.add("active");
    detailPanel.classList.add("minimized");
    const toggle = detailPanel.querySelector(".dp-toggle");
    if (toggle) toggle.innerHTML = "&#9654;";
  }
  // Color verses by memorization status
  const memVerses = Store.getMemorizationForChapter(selectedBook, selectedChapter);
  const memMap = {};
  for (const m of memVerses) { memMap[m.verse] = m; }
  detailPanel.querySelectorAll(".bible-verse").forEach(el => {
    const m = memMap[el.dataset.verse];
    if (m) {
      if (m.level >= 4) {
        el.style.borderLeft = "3px solid #eab308";
        el.style.paddingLeft = "6px";
      } else {
        el.style.borderLeft = "3px solid #3b82f6";
        el.style.paddingLeft = "6px";
      }
    }
  });

  bibleWordSelection = null;
  const verseEls = [...detailPanel.querySelectorAll(".bible-verse")];
  verseEls.forEach(el => {
    el.addEventListener("click", () => {
      const idx = verseEls.indexOf(el);
      if (el.style.background) {
        el.style.background = "";
        if (bibleWordSelection) {
          bibleWordSelection = bibleWordSelection.filter(v => v.verse !== el.dataset.verse);
          if (bibleWordSelection.length === 0) bibleWordSelection = null;
        }
      } else {
        el.style.background = "#3b82f644";
        if (!bibleWordSelection) bibleWordSelection = [];
        bibleWordSelection.push({ verse: el.dataset.verse, text: el.dataset.text });
        bibleWordSelection.sort((a, b) => parseInt(a.verse) - parseInt(b.verse));
      }
      updateBibleWordBar();
    });
  });
  updateKeywordChecklist(chData);
  const dpBodyEl = detailPanel.querySelector(".dp-body");
  if (dpBodyEl) {
    dpBodyEl.scrollTop = bibleScrollPositions[selectedChapterKey] || 0;
    dpBodyEl.addEventListener("scroll", () => { bibleScrollPositions[selectedChapterKey] = dpBodyEl.scrollTop; });
  }
}

function updateBibleWordBar() {
  const bar = document.getElementById("bible-word-bar");
  if (!bar) return;
  if (!bibleWordSelection || bibleWordSelection.length === 0) { bar.style.display = "none"; return; }
  const verses = bibleWordSelection.map(v => v.verse);
  const text = bibleWordSelection.map(v => v.text).join(" ");
  const verseRef = selectedBook + " " + selectedChapter + ":" + verses.join(",");
  const title = bibleWordSelection[0].text.length > 40 ? bibleWordSelection[0].text.slice(0, 40) : bibleWordSelection[0].text;
  const existing = Store.getNotes().find(n => n.title.toLowerCase() === title.toLowerCase());
  const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;
  let html = '<div class="selected-text">[' + verseRef + ']<br>"' + preview + '"</div>';

  if (existing) {
    html += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-open">Open Note</button>';
  } else {
    html += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-create">Create Note</button>';
  }
  html += '<button class="btn" style="font-size:0.7rem;padding:3px 8px;background:#2563eb;" id="bible-word-memorize">Memorize</button>';
  const notes = Store.getNotes();
  if (notes.length > 0) {
    html += '<select id="bible-word-attach" style="font-size:0.7rem;margin-top:4px;width:100%;"><option value="">Attach to note...</option>';
    for (const n of notes) { html += '<option value="' + n.id + '">' + n.title + '</option>'; }
    html += '</select>';
  }
  html += '<button class="btn btn-secondary" style="font-size:0.7rem;padding:3px 8px;" id="bible-word-clear">Clear</button>';
  bar.innerHTML = html;
  bar.style.display = "block";
  const attachSel = bar.querySelector("#bible-word-attach");
  if (attachSel) {
    attachSel.addEventListener("change", () => {
      if (!attachSel.value) return;
      const noteId = parseInt(attachSel.value);
      const note = Store.getNoteById(noteId);
      if (!note) return;
      const append = "<br><br>[" + verseRef + "]<br>" + text;
      Store.updateNote(noteId, { text: (note.text || "") + append });
      if (!note.chapters.includes(selectedChapterKey)) {
        Store.attachNoteToChapter(noteId, selectedChapterKey);
      }
      clearBibleWordSelection();
      refreshAll();
    });
  }
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
      const noteText = "[" + verseRef + "]<br>" + text;
      const note = Store.createNote(title, noteText, selectedChapterKey);
      refreshAll();
      expandedNoteId = note.id;
      switchToTab("notes");
      refreshNoteList();
      highlightNoteInList(note.id);
      showEditPanel(note.id);
      clearBibleWordSelection();
    });
  }
  bar.querySelector("#bible-word-memorize").addEventListener("click", () => {
    if (!bibleWordSelection || bibleWordSelection.length === 0) return;
    for (const v of bibleWordSelection) {
      Store.addToMemorize(selectedBook, selectedChapter, v.verse, v.text);
    }
    clearBibleWordSelection();
    updateBiblePanel();
  });
  bar.querySelector("#bible-word-clear").addEventListener("click", clearBibleWordSelection);
}

function clearBibleWordSelection() {
  bibleWordSelection = null;
  detailPanel.querySelectorAll(".bible-verse").forEach(v => v.style.background = "");
  const bar = document.getElementById("bible-word-bar");
  if (bar) bar.style.display = "none";
}

// --- Memorization Quiz ---
function startMemorizationQuiz(verses) {
  const due = verses || Store.getDueMemorization();
  if (due.length === 0) return;
  let queue = [...due];
  let currentIndex = 0;
  let revealLevel = 0; // 0=first letters, 1=blank, 2=full reveal

  const modal = document.getElementById("edit-modal");
  activeEditId = null;
  activeEditRender = null;

  function renderQuizCard() {
    if (currentIndex >= queue.length) {
      renderQuizComplete();
      return;
    }
    const m = queue[currentIndex];
    const ref = m.book + ' ' + m.chapter + ':' + m.verse;
    let displayText = '';

    if (revealLevel === 0) {
      // Fully blank
      displayText = m.text.split(' ').map(w => w.replace(/[a-zA-Z]/g, '_')).join(' ');
    } else if (revealLevel === 1) {
      // First letter hints
      displayText = m.text.split(' ').map(w => {
        if (w.length === 0) return '';
        return '<span style="color:#60a5fa;">' + w[0] + '</span>' + w.slice(1).replace(/[a-zA-Z]/g, '_');
      }).join(' ');
    } else {
      // Full reveal
      displayText = m.text;
    }

    let html = '<div class="modal-header"><h2>Memorize: ' + ref + '</h2><button class="modal-close-btn">&times;</button></div>';
    html += '<div class="modal-body" style="padding:16px;justify-content:center;align-items:center;text-align:center;">';
    html += '<div style="font-size:0.7rem;color:#6b7280;margin-bottom:12px;">' + (currentIndex + 1) + ' / ' + queue.length + '</div>';
    html += '<div style="font-size:1.1rem;line-height:1.8;color:#e0e0e0;max-width:600px;margin:0 auto;font-family:serif;">' + displayText + '</div>';
    html += '<div style="margin-top:24px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
    if (revealLevel < 2) {
      html += '<button class="btn btn-secondary quiz-hint-btn" style="padding:8px 16px;">Show More</button>';
      html += '<button class="btn quiz-reveal-btn" style="padding:8px 16px;">Reveal</button>';
    } else {
      html += '<button class="btn quiz-got-btn" style="padding:8px 20px;background:#16a34a;">Got it</button>';
      html += '<button class="btn quiz-almost-btn" style="padding:8px 20px;background:#d97706;">Almost</button>';
      html += '<button class="btn quiz-missed-btn" style="padding:8px 20px;background:#dc2626;">Missed</button>';
    }
    html += '</div>';
    html += '</div>';
    modal.innerHTML = html;
    modal.classList.add("active");

    modal.querySelector(".modal-close-btn").addEventListener("click", () => { modal.classList.remove("active"); });

    if (revealLevel < 2) {
      modal.querySelector(".quiz-hint-btn").addEventListener("click", () => {
        if (revealLevel === 0) { revealLevel = 1; }
        else { revealLevel = 2; }
        renderQuizCard();
      });
      modal.querySelector(".quiz-reveal-btn").addEventListener("click", () => {
        revealLevel = 2;
        renderQuizCard();
      });
    } else {
      modal.querySelector(".quiz-got-btn").addEventListener("click", () => {
        Store.updateMemorization(queue[currentIndex].key, 'got');
        nextCard();
      });
      modal.querySelector(".quiz-almost-btn").addEventListener("click", () => {
        Store.updateMemorization(queue[currentIndex].key, 'almost');
        nextCard();
      });
      modal.querySelector(".quiz-missed-btn").addEventListener("click", () => {
        Store.updateMemorization(queue[currentIndex].key, 'missed');
        nextCard();
      });
    }
  }

  function nextCard() {
    currentIndex++;
    revealLevel = 0;
    renderQuizCard();
  }

  function renderQuizComplete() {
    let html = '<div class="modal-header"><h2>Session Complete</h2><button class="modal-close-btn">&times;</button></div>';
    html += '<div class="modal-body" style="padding:16px;justify-content:center;align-items:center;text-align:center;">';
    html += '<div style="font-size:1.2rem;color:#e0e0e0;margin-bottom:12px;">Reviewed ' + queue.length + ' verse' + (queue.length !== 1 ? 's' : '') + '</div>';
    html += '<button class="btn quiz-done-btn" style="padding:8px 20px;">Done</button>';
    html += '</div>';
    modal.innerHTML = html;

    modal.querySelector(".modal-close-btn").addEventListener("click", () => { modal.classList.remove("active"); refreshAll(); if (memPanelActive) showMemorizePanel(); });
    modal.querySelector(".quiz-done-btn").addEventListener("click", () => { modal.classList.remove("active"); refreshAll(); if (memPanelActive) showMemorizePanel(); });
  }

  renderQuizCard();
}

// --- Memorize Panel ---
let memPanelActive = false;

function showMemorizePanel() {
  memPanelActive = true;
  const allMem = Store.getAllMemorization();
  const due = Store.getDueMemorization();
  const dpBody = detailPanel.querySelector(".dp-body");
  if (!dpBody) return;
  const levelLabels = ['New', 'Learning', 'Familiar', 'Known', 'Memorized'];
  const levelColors = ['#6b7280', '#3b82f6', '#8b5cf6', '#10b981', '#eab308'];
  let html = '<div style="padding:4px 0;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
  html += '<strong style="color:#e0e0e0;font-size:0.85rem;">Memorization</strong>';
  if (due.length > 0) {
    html += '<button class="btn mem-practice-btn" style="font-size:0.7rem;padding:3px 10px;">Practice (' + due.length + ' due)</button>';
  }
  html += '</div>';
  if (allMem.length === 0) {
    html += '<em style="color:#6b7280;font-size:0.75rem;">No verses added yet. Select a verse and click Memorize.</em>';
  } else {
    // Due verses first
    if (due.length > 0) {
      html += '<div style="margin-bottom:8px;"><span style="color:#f59e0b;font-size:0.72rem;font-weight:bold;">Due for Review</span></div>';
      for (const m of due) {
        html += buildMemVerseItem(m, levelLabels, levelColors);
      }
    }
    // Not due
    const notDue = allMem.filter(m => m.nextReview > Date.now());
    if (notDue.length > 0) {
      html += '<div style="margin:8px 0 4px;"><span style="color:#6b7280;font-size:0.72rem;font-weight:bold;">Upcoming</span></div>';
      for (const m of notDue) {
        html += buildMemVerseItem(m, levelLabels, levelColors);
      }
    }
  }
  html += '</div>';
  dpBody.innerHTML = html;
  // Practice button
  const practiceBtn = dpBody.querySelector(".mem-practice-btn");
  if (practiceBtn) {
    practiceBtn.addEventListener("click", () => { startMemorizationQuiz(); });
  }
  // Practice individual verse
  dpBody.querySelectorAll(".mem-practice-one-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const m = Store.getAllMemorization().find(v => v.key === btn.dataset.key);
      if (m) startMemorizationQuiz([m]);
    });
  });
  // Remove buttons
  dpBody.querySelectorAll(".mem-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      Store.removeFromMemorize(btn.dataset.key);
      showMemorizePanel();
    });
  });
  // Navigate to chapter on verse click
  dpBody.querySelectorAll(".mem-verse-ref").forEach(el => {
    el.addEventListener("click", () => {
      const book = el.dataset.book;
      const ch = parseInt(el.dataset.chapter);
      selectBook(book);
      selectChapter(ch);
    });
  });
}

function buildMemVerseItem(m, levelLabels, levelColors) {
  const daysUntil = Math.max(0, Math.ceil((m.nextReview - Date.now()) / (24 * 60 * 60 * 1000)));
  const preview = m.text.length > 50 ? m.text.slice(0, 50) + '...' : m.text;
  let html = '<div style="background:#1f2937;border-radius:4px;padding:6px 8px;margin:3px 0;font-size:0.73rem;border-left:3px solid ' + levelColors[m.level] + ';">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
  html += '<span class="mem-verse-ref" data-book="' + m.book + '" data-chapter="' + m.chapter + '" style="color:#60a5fa;cursor:pointer;">' + m.book + ' ' + m.chapter + ':' + m.verse + '</span>';
  html += '<span style="color:' + levelColors[m.level] + ';font-size:0.65rem;">' + levelLabels[m.level] + (m.streak > 0 ? ' x' + m.streak : '') + '</span>';
  html += '</div>';
  html += '<div style="color:#9ca3af;margin-top:2px;">' + preview + '</div>';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;">';
  html += '<span style="color:#6b7280;font-size:0.63rem;">' + (daysUntil === 0 ? 'Due now' : daysUntil + 'd until review') + '</span>';
  html += '<span><button class="mem-practice-one-btn" data-key="' + m.key + '" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:0.63rem;">practice</button>';
  html += '<button class="mem-remove-btn" data-key="' + m.key + '" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:0.7rem;">&times;</button></span>';
  html += '</div></div>';
  return html;
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
      if (e.target.closest(".note-edit-btn") || e.target.closest(".note-del-btn") || e.target.closest("[id^=\"edit-panel-\"]") || e.target.closest("[id^=\"del-panel-\"]") || e.target.closest(".note-preview")) return;
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
  let html = '<div class="note-preview" style="margin-top:4px;max-height:120px;overflow-y:auto;padding:6px 8px;background:#111827;border:1px solid #374151;border-radius:4px;font-size:0.75rem;line-height:1.5;color:#d1d5db;">' + (note.text || '<em style="color:#6b7280;">No text</em>') + '</div>';
  html += '<div style="margin-top:4px;padding-left:4px;border-left:2px solid ' + note.color + '44;font-size:0.7rem;">';
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
  document.getElementById("note-preview-popup").classList.remove("active");
  previewPopupNode = null;
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
    html += '<div class="modal-body" style="padding:12px 16px;">';
    html += '<input type="text" id="edit-title-' + id + '" value="' + note.title.replace(/"/g, "&quot;") + '" style="width:100%;font-size:1rem;font-weight:bold;margin-bottom:8px;">';
    html += '<div class="edit-toolbar"><button type="button" class="fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button><button type="button" class="fmt-btn" data-cmd="highlight" title="Highlight"><mark>H</mark></button><button type="button" class="fmt-btn" data-cmd="notelink" title="Link to Note">&#128279;</button></div>';
    html += '<div id="edit-notelink-picker-' + id + '" style="display:none;margin-bottom:4px;"><select id="edit-notelink-select-' + id + '" style="font-size:0.75rem;width:100%;"><option value="">Select note to link...</option>';
    const linkableNotes = Store.getNotes().filter(n => n.id !== id);
    for (const ln of linkableNotes) { html += '<option value="' + ln.id + '" data-color="' + ln.color + '">' + ln.title + '</option>'; }
    html += '</select></div>';
    html += '<div id="edit-text-' + id + '" class="edit-content" contenteditable="true">' + (note.text || "") + '</div>';
    const detailsOpen = modal.querySelector("details") ? modal.querySelector("details").open : false;
    html += '<details style="margin-top:8px;font-size:0.78rem;"' + (detailsOpen ? ' open' : '') + '><summary style="cursor:pointer;color:#9ca3af;padding:6px 0;">Chapters & Links</summary><div style="padding:8px 0;">';
    html += '<label>Chapters</label><div class="chip-area">';
    for (const ch of pendingChapters) {
      html += '<span class="chip"><span class="chip-link chip-ch-link" data-ch="' + ch + '" style="cursor:pointer;">' + ch.replace("_", " ") + '</span><button class="chip-rm-ch" data-ch="' + ch + '">&times;</button></span>';
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
    html += '<label style="margin-top:8px;">Linked Notes</label><div class="chip-area">';
    for (const lid of pendingLinked) {
      const ln = Store.getNoteById(lid);
      if (ln) {
        html += '<span class="chip" style="color:' + ln.color + ';"><span class="chip-link chip-ln-link" data-lid="' + lid + '" style="cursor:pointer;">' + ln.title + '</span><button class="chip-rm-ln" data-lid="' + lid + '">&times;</button></span>';
      }
    }
    html += '</div>';
    const otherNotes = Store.getNotes().filter(n => n.id !== id && !pendingLinked.includes(n.id));
    if (otherNotes.length > 0) {
      html += '<select id="edit-add-link-' + id + '"><option value="">+ Link a note...</option>';
      for (const o of otherNotes) { html += '<option value="' + o.id + '">' + o.title + '</option>'; }
      html += '</select>';
    }
    html += '</div></details>';
    html += '</div>';
    html += '<div class="btn-row" style="padding:10px 16px;border-top:1px solid #374151;">';
    html += '<button class="btn edit-save-btn">Save</button>';
    html += '<button class="btn btn-secondary edit-cancel-btn">Cancel</button>';
    html += '<button class="btn btn-danger edit-delete-btn" style="margin-left:auto;">Delete</button>';
    html += '</div>';
    modal.innerHTML = html;
    modal.querySelectorAll(".fmt-btn").forEach(btn => {
      function applyFormat(e) {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        if (cmd === "underline") {
          document.execCommand("underline", false, null);
        } else if (cmd === "highlight") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const mark = document.createElement("mark");
            mark.style.background = "#facc15";
            mark.style.color = "#000";
            range.surroundContents(mark);
          }
        } else if (cmd === "notelink") {
          const sel = window.getSelection();
          if (sel.rangeCount > 0 && !sel.isCollapsed) {
            modal._savedRange = sel.getRangeAt(0).cloneRange();
            const picker = modal.querySelector("#edit-notelink-picker-" + id);
            picker.style.display = "block";
          }
        }
      }
      btn.addEventListener("mousedown", applyFormat);
      btn.addEventListener("touchend", applyFormat);
    });
    const notelinkSel = modal.querySelector("#edit-notelink-select-" + id);
    if (notelinkSel) {
      notelinkSel.addEventListener("change", () => {
        const picker = modal.querySelector("#edit-notelink-picker-" + id);
        if (!notelinkSel.value) return;
        const targetId = parseInt(notelinkSel.value);
        const targetNote = Store.getNoteById(targetId);
        if (!targetNote) return;
        const range = modal._savedRange;
        if (range) {
          const link = document.createElement("span");
          link.className = "note-text-link";
          link.dataset.noteId = targetId;
          link.style.background = targetNote.color + "33";
          link.style.borderBottom = "2px solid " + targetNote.color;
          link.style.cursor = "pointer";
          link.style.padding = "0 2px";
          link.style.borderRadius = "2px";
          range.surroundContents(link);
        }
        if (!pendingLinked.includes(targetId)) { pendingLinked.push(targetId); }
        Store.linkNotes(id, targetId);
        modal._savedRange = null;
        picker.style.display = "none";
        notelinkSel.value = "";
      });
    }
    modal.querySelectorAll(".chip-rm-ch").forEach(b => {
      b.addEventListener("click", () => { pendingChapters = pendingChapters.filter(c => c !== b.dataset.ch); renderModal(); });
    });
    modal.querySelectorAll(".chip-rm-ln").forEach(b => {
      b.addEventListener("click", () => { pendingLinked = pendingLinked.filter(l => l !== parseInt(b.dataset.lid)); renderModal(); });
    });
    const editContent = modal.querySelector("#edit-text-" + id);
    if (editContent) {
      editContent.addEventListener("click", (e) => {
        const link = e.target.closest(".note-text-link");
        if (!link) return;
        const targetId = parseInt(link.dataset.noteId);
        const targetNote = Store.getNoteById(targetId);
        if (!targetNote) return;
        // Save current note first
        const title = document.getElementById("edit-title-" + id).value.trim();
        const text = document.getElementById("edit-text-" + id).innerHTML;
        if (title) Store.updateNote(id, { title: title, text: text, chapters: pendingChapters, linkedNotes: pendingLinked });
        modal.classList.remove("active"); activeEditId = null; activeEditRender = null;
        expandedNoteId = targetId;
        switchToTab("notes");
        refreshNoteList();
        highlightNoteInList(targetId);
        Graph.focusOnNode("note_" + targetId);
        showEditPanel(targetId);
      });
    }
    modal.querySelectorAll(".chip-ch-link").forEach(el => {
      el.addEventListener("click", () => {
        const key = el.dataset.ch;
        const parts = key.split("_");
        const ch = parseInt(parts.pop());
        const book = parts.join(" ");
        modal.classList.remove("active"); activeEditId = null; activeEditRender = null;
        selectBook(book);
        selectChapter(ch);
        switchToTab("navigate");
      });
    });
    modal.querySelectorAll(".chip-ln-link").forEach(el => {
      el.addEventListener("click", () => {
        const lid = parseInt(el.dataset.lid);
        modal.classList.remove("active"); activeEditId = null; activeEditRender = null;
        const note = Store.getNoteById(lid);
        if (note) {
          expandedNoteId = lid;
          switchToTab("notes");
          refreshNoteList();
          highlightNoteInList(lid);
          Graph.focusOnNode("note_" + lid);
          showEditPanel(lid);
        }
      });
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
      const text = document.getElementById("edit-text-" + id).innerHTML;
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
      modal.classList.remove("active");
      activeEditId = null;
      activeEditRender = null;
      refreshAll();

    });
    function closeModal() {
      modal.classList.remove("active"); activeEditId = null; activeEditRender = null;
    }
    modal.querySelector(".edit-cancel-btn").addEventListener("click", closeModal);
    modal.querySelector(".modal-close-btn").addEventListener("click", closeModal);
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

// --- Graph Add Note Button ---
const graphAddNoteBtn = document.getElementById("graph-add-note-btn");
let graphAddNoteNode = null;
let previewPopupNode = null;

function updateGraphAddNotePos() {
  if (!graphAddNoteNode) return;
  const cam = Graph.getCamera();
  const wrap = canvas.parentElement.getBoundingClientRect();
  const sx = (graphAddNoteNode.x * cam.zoom + cam.x + wrap.width / 2);
  const sy = (graphAddNoteNode.y * cam.zoom + cam.y + wrap.height / 2);
  graphAddNoteBtn.style.left = (sx + 12) + "px";
  graphAddNoteBtn.style.top = (sy - 12) + "px";
}
function updatePreviewPopupPos() {
  if (!previewPopupNode) return;
  const popup = document.getElementById("note-preview-popup");
  if (!popup.classList.contains("active")) return;
  const cam = Graph.getCamera();
  const wrap = canvas.parentElement.getBoundingClientRect();
  const sx = previewPopupNode.x * cam.zoom + cam.x + wrap.width / 2;
  const sy = previewPopupNode.y * cam.zoom + cam.y + wrap.height / 2;
  popup.style.left = Math.min(sx + 12, wrap.width - 220) + "px";
  popup.style.top = Math.min(sy + 12, wrap.height - 200) + "px";
}
setInterval(() => { updateGraphAddNotePos(); updatePreviewPopupPos(); }, 16);

function showGraphAddNote(node) {
  if (!node || node.type !== "chapter") { graphAddNoteBtn.style.display = "none"; graphAddNoteNode = null; return; }
  graphAddNoteNode = node;
  updateGraphAddNotePos();
  graphAddNoteBtn.style.display = "block";
  graphAddNoteBtn.onclick = () => {
    const title = "New Note";
    const note = Store.createNote(title, "", node.id);
    graphAddNoteBtn.style.display = "none";
    graphAddNoteNode = null;
    refreshAll();
    expandedNoteId = note.id;
    switchToTab("notes");
    refreshNoteList();
    highlightNoteInList(note.id);
    showEditPanel(note.id);
  };
}

// --- Graph Callbacks ---
function handleNodeLongPress(node, sx, sy) {
  if (!node) return;
  if (node.type !== "note") return;
  const note = Store.getNoteById(node.noteId);
  if (!note) return;
  const graphNode = Graph.nodes().find(n => n.id === "note_" + note.id);
  if (graphNode) previewPopupNode = graphNode;
  const popup = document.getElementById("note-preview-popup");
  const wrap = canvas.parentElement.getBoundingClientRect();
  popup.innerHTML = '<div class="npp-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #374151;"><strong style="color:' + note.color + ';font-size:0.8rem;">' + note.title + '</strong><button class="npp-close" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1rem;">&times;</button></div><div class="npp-body">' + (note.text || '<em style="color:#6b7280;">No text</em>') + '</div>';
  popup.style.left = Math.min(sx + 12, wrap.width - 220) + "px";
  popup.style.top = Math.min(sy + 12, wrap.height - 200) + "px";
  popup.classList.add("active");
  popup.querySelector(".npp-close").addEventListener("click", () => { popup.classList.remove("active"); previewPopupNode = null; });
  popup.querySelectorAll(".note-text-link").forEach(link => {
    link.addEventListener("click", () => {
      const targetId = parseInt(link.dataset.noteId);
      const targetNote = Store.getNoteById(targetId);
      if (!targetNote) return;
      popup.classList.remove("active");
      previewPopupNode = null;
      expandedNoteId = targetId;
      switchToTab("notes");
      refreshNoteList();
      highlightNoteInList(targetId);
      Graph.focusOnNode("note_" + targetId);
      const targetGraphNode = Graph.nodes().find(n => n.id === "note_" + targetId);
      if (targetGraphNode) {
        setTimeout(() => {
          const cam = Graph.getCamera();
          const wrap = canvas.parentElement.getBoundingClientRect();
          const sx2 = targetGraphNode.x * cam.zoom + cam.x + wrap.width / 2;
          const sy2 = targetGraphNode.y * cam.zoom + cam.y + wrap.height / 2;
          handleNodeLongPress({ type: "note", noteId: targetId }, sx2, sy2);
        }, 450);
      }
    });
  });
}

function handleNodeClick(node, wasSelected) {
  if (!node) { graphAddNoteBtn.style.display = "none"; graphAddNoteNode = null; document.getElementById("note-preview-popup").classList.remove("active"); previewPopupNode = null; return; }
  if (node.type === "chapter") {
    showGraphAddNote(node);
    const parts = node.id.split("_");
    const ch = parseInt(parts.pop());
    const book = parts.join(" ");
    selectBook(book);
    selectChapter(ch);
    switchToTab("navigate");
  } else if (node.type === "note") {
    graphAddNoteBtn.style.display = "none";
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
      if (wasSelected) {
        document.getElementById("note-preview-popup").classList.remove("active");
        showEditPanel(note.id);
      } else {
        const cam = Graph.getCamera();
        const wrap = canvas.parentElement.getBoundingClientRect();
        const noteNode = Graph.nodes().find(n => n.id === "note_" + note.id);
        if (noteNode) {
          previewPopupNode = noteNode;
          const sx = noteNode.x * cam.zoom + cam.x + wrap.width / 2;
          const sy = noteNode.y * cam.zoom + cam.y + wrap.height / 2;
          handleNodeLongPress({ type: "note", noteId: note.id }, sx, sy);
        }
      }
    }
  }
}

function handleNodeHover(node, mx, my, ctrlKey) {
  if (!node || !ctrlKey) { tooltip.style.display = "none"; return; }
  let html = "";
  if (node.type === "chapter") {
    const notes = Store.getNotesForChapter(node.id);
    html = "<strong>" + node.label + "</strong>";
    if (notes.length > 0) html += "<br>" + notes.length + " note" + (notes.length !== 1 ? "s" : "");
  } else if (node.type === "note") {
    graphAddNoteBtn.style.display = "none";
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

function handleBannerHover(banner, mx, my) {
  if (!banner) { tooltip.style.display = "none"; return; }
  let html = '<strong style="color:#eab308;">Memorized Verses</strong><br>';
  for (const chKey of banner.chapters) {
    const parts = chKey.split('_');
    const chNum = parts.pop();
    const bookName = parts.join(' ');
    const memVerses = Store.getMemorizationForChapter(bookName, chNum);
    for (const m of memVerses) {
      const levelColors = ['#6b7280', '#3b82f6', '#8b5cf6', '#10b981', '#eab308'];
      const preview = m.text.length > 40 ? m.text.slice(0, 40) + '...' : m.text;
      html += '<div style="color:' + levelColors[m.level] + ';font-size:0.7rem;">' + m.book + ' ' + m.chapter + ':' + m.verse + ' - ' + preview + '</div>';
    }
  }
  tooltip.innerHTML = html;
  tooltip.style.display = "block";
  tooltip.style.left = (mx - canvas.parentElement.getBoundingClientRect().left + 12) + "px";
  tooltip.style.top = (my - canvas.parentElement.getBoundingClientRect().top + 12) + "px";
}

function handleEdgeHover(edgeInfo, selected, mx, my) {
  if (!edgeInfo || !selected) { return; }
  const otherNode = (edgeInfo.source.id === selected.id) ? edgeInfo.target : edgeInfo.source;
  let label = otherNode.label || "";
  if (otherNode.type === "note") {
    const note = Store.getNoteById(otherNode.noteId);
    if (note) label = note.title;
  }
  if (label) {
    tooltip.innerHTML = label;
    tooltip.style.display = "block";
    tooltip.style.left = (mx - canvas.parentElement.getBoundingClientRect().left + 12) + "px";
    tooltip.style.top = (my - canvas.parentElement.getBoundingClientRect().top + 12) + "px";
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
  let html = '<div class="ck-header"><span>Color Key</span><span class="ck-toggle">&#9660;</span></div><div class="ck-body">';
  for (const n of notes) {
    html += '<div><span class="swatch" style="background:' + n.color + ';"></span>' + n.title + '</div>';
  }
  html += '</div>';
  colorKey.innerHTML = html;
  colorKey.style.display = "block";
  if (!colorKey.classList.contains("minimized")) colorKey.classList.add("minimized");
  colorKey.querySelector(".ck-toggle").innerHTML = "&#9654;";
  colorKey.querySelector(".ck-header").addEventListener("click", () => {
    colorKey.classList.toggle("minimized");
    colorKey.querySelector(".ck-toggle").innerHTML = colorKey.classList.contains("minimized") ? "&#9654;" : "&#9660;";
  });
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
  const raw = JSON.parse(localStorage.getItem("bible-study-data") || "{}");
  const positions = localStorage.getItem("bible-study-positions");
  if (positions) raw._positions = JSON.parse(positions);
  const data = JSON.stringify(raw);
  if (!data) return;
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "multiverse-backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("btn-load").addEventListener("click", () => {
  const input = document.getElementById("load-json-input");
  input.value = "";
  input.click();
});

document.getElementById("load-json-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.notes && !parsed.subjects) { updateStatus(); return; }
      if (parsed._positions) {
        localStorage.setItem("bible-study-positions", JSON.stringify(parsed._positions));
        delete parsed._positions;
      }
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
