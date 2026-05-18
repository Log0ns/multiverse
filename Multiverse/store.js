// store.js — Persistent data store for notes and chapter links
const Store = (() => {
  let dirHandle = null;
  let data = { notes: [], nextId: 1 };

  // Note: { id, title, text, color, chapters: [chapterKey...], linkedNotes: [noteId...], created }

  const COLORS = [
    '#f472b6','#fb923c','#facc15','#4ade80','#22d3ee','#818cf8',
    '#e879f9','#f87171','#34d399','#60a5fa','#a78bfa','#fbbf24',
    '#2dd4bf','#f97316','#a3e635','#c084fc','#fb7185','#38bdf8',
    '#84cc16','#e11d48','#7c3aed','#0891b2','#ca8a04','#dc2626'
  ];

  function getNextColor() {
    const used = data.notes.map(n => n.color);
    const available = COLORS.filter(c => !used.includes(c));
    return available.length > 0 ? available[0] : COLORS[data.notes.length % COLORS.length];
  }

  function genId() { return data.nextId++; }

  // --- CRUD ---
  function createNote(title, text, chapterKey) {
    const note = { id: genId(), title, text: text || '', color: getNextColor(), chapters: chapterKey ? [chapterKey] : [], linkedNotes: [], created: Date.now() };
    data.notes.push(note);
    save();
    return note;
  }

  function deleteNote(id) {
    data.notes = data.notes.filter(n => n.id !== id);
    // Remove from linkedNotes of other notes
    data.notes.forEach(n => { n.linkedNotes = n.linkedNotes.filter(lid => lid !== id); });
    save();
  }

  function updateNote(id, updates) {
    const note = data.notes.find(n => n.id === id);
    if (!note) return;
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.text !== undefined) note.text = updates.text;
    if (updates.color !== undefined) note.color = updates.color;
    if (updates.chapters !== undefined) note.chapters = updates.chapters;
    if (updates.linkedNotes !== undefined) note.linkedNotes = updates.linkedNotes;
    save();
  }

  function attachNoteToChapter(noteId, chapterKey) {
    const note = data.notes.find(n => n.id === noteId);
    if (note && !note.chapters.includes(chapterKey)) {
      note.chapters.push(chapterKey);
      save();
    }
  }

  function linkNotes(id1, id2) {
    const n1 = data.notes.find(n => n.id === id1);
    const n2 = data.notes.find(n => n.id === id2);
    if (n1 && n2) {
      if (!n1.linkedNotes.includes(id2)) n1.linkedNotes.push(id2);
      if (!n2.linkedNotes.includes(id1)) n2.linkedNotes.push(id1);
      save();
    }
  }

  function getNotes() { return data.notes; }
  function getNoteById(id) { return data.notes.find(n => n.id === id); }
  function getNotesForChapter(chapterKey) { return data.notes.filter(n => n.chapters.includes(chapterKey)); }
  function getChaptersWithNotes() {
    const set = new Set();
    data.notes.forEach(n => n.chapters.forEach(c => set.add(c)));
    return set;
  }

  // --- Persistence ---
  function save() {
    localStorage.setItem('bible-study-data', JSON.stringify(data));
    if (dirHandle) saveToFiles();
  }

  function load() {
    const stored = localStorage.getItem('bible-study-data');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migration: if old format with subjects/concepts, convert
        if (parsed.subjects && !parsed.notes) {
          data = migrateOldData(parsed);
        } else if (parsed.notes) {
          data = parsed;
        }
      } catch (e) { console.error('Failed to load data', e); }
    }
  }

  function migrateOldData(old) {
    const migrated = { notes: [], nextId: 1 };
    const subjectMap = {}; // old subject id -> new note id
    // Convert subjects to notes
    for (const s of (old.subjects || [])) {
      const note = { id: migrated.nextId++, title: s.name, text: '', color: s.color, chapters: s.chapters || [], linkedNotes: [], created: Date.now() };
      migrated.notes.push(note);
      subjectMap[s.id] = note.id;
    }
    // Convert concepts to notes, link to former subjects
    for (const c of (old.concepts || [])) {
      const note = { id: migrated.nextId++, title: c.title || c.text.slice(0, 40), text: c.text || '', color: COLORS[migrated.notes.length % COLORS.length], chapters: c.chapterKey ? [c.chapterKey] : [], linkedNotes: [], created: c.created || Date.now() };
      // Link to former subject notes
      for (const sid of (c.subjectIds || [])) {
        if (subjectMap[sid]) {
          note.linkedNotes.push(subjectMap[sid]);
          const parentNote = migrated.notes.find(n => n.id === subjectMap[sid]);
          if (parentNote) parentNote.linkedNotes.push(note.id);
        }
      }
      migrated.notes.push(note);
    }
    return migrated;
  }

  // --- File System Access API ---
  async function connectFolder() {
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const loaded = await loadFromFiles();
      if (loaded) {
        localStorage.setItem('bible-study-data', JSON.stringify(data));
      } else {
        await saveToFiles();
      }
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return false;
    }
  }

  async function loadFromFiles() {
    if (!dirHandle) return false;
    try {
      const fileHandle = await dirHandle.getFileHandle('_data.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed && parsed.notes) {
        data = parsed;
        return true;
      }
    } catch (e) { /* file doesn't exist */ }
    return false;
  }

  async function saveToFiles() {
    if (!dirHandle) return;
    try {
      await writeFile('_data.json', JSON.stringify(data, null, 2));
      await writeFile('_index.md', generateIndexMd());
      for (const note of data.notes) {
        const filename = sanitizeFilename(note.title) + '.md';
        await writeFile(filename, generateNoteMd(note));
      }
    } catch (e) { console.error('File save error:', e); }
  }

  function generateIndexMd() {
    let md = '# Bible Study Notes\n\n';
    md += `Generated: ${new Date().toLocaleString()}\n\n`;
    md += '## Notes\n\n';
    for (const n of data.notes) {
      md += `- **${n.title}** (${n.chapters.length} chapters)\n`;
    }
    md += `\n## Stats\n\n`;
    md += `- Notes: ${data.notes.length}\n`;
    md += `- Chapters touched: ${getChaptersWithNotes().size}\n`;
    return md;
  }

  function generateNoteMd(note) {
    let md = `# ${note.title}\n\n`;
    if (note.text) md += `${note.text}\n\n`;
    md += `## Chapters\n\n`;
    for (const ch of note.chapters) {
      md += `- ${ch.replace('_', ' ')}\n`;
    }
    if (note.linkedNotes.length > 0) {
      md += `\n## Linked Notes\n\n`;
      for (const lid of note.linkedNotes) {
        const linked = data.notes.find(n => n.id === lid);
        if (linked) md += `- ${linked.title}\n`;
      }
    }
    return md;
  }

  async function writeFile(filename, content) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').toLowerCase();
  }

  function isFileSystemConnected() { return dirHandle !== null; }

  // --- Zip Export ---
  function exportAsZip() {
    const files = [];
    files.push({ name: '_index.md', content: generateIndexMd() });
    for (const note of data.notes) {
      const filename = sanitizeFilename(note.title) + '.md';
      files.push({ name: filename, content: generateNoteMd(note) });
    }
    const zip = buildZip(files);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bible-study-notes.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildZip(files) {
    const encoder = new TextEncoder();
    const centralDir = [];
    const localFiles = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const contentBytes = encoder.encode(file.content);
      const crc = crc32(contentBytes);
      const local = new Uint8Array(30 + nameBytes.length + contentBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, contentBytes.length, true);
      lv.setUint32(22, contentBytes.length, true);
      lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(contentBytes, 30 + nameBytes.length);
      localFiles.push(local);
      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, contentBytes.length, true);
      cv.setUint32(24, contentBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralDir.push(central);
      offset += local.length;
    }
    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const c of centralDir) centralDirSize += c.length;
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);
    const result = new Uint8Array(offset + centralDirSize + 22);
    let pos = 0;
    for (const l of localFiles) { result.set(l, pos); pos += l.length; }
    for (const c of centralDir) { result.set(c, pos); pos += c.length; }
    result.set(end, pos);
    return result;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) { crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  load();

  return {
    createNote, deleteNote, updateNote, attachNoteToChapter, linkNotes,
    getNotes, getNoteById, getNotesForChapter, getChaptersWithNotes,
    connectFolder, isFileSystemConnected, exportAsZip, save, load
  };
})();
