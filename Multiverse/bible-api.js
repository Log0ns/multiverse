// bible-api.js - ESV API fetcher with WEB fallback
const BibleAPI = (function() {
  const API_KEY = "a4f9e53cb1dae87621db43d8b9ad7d14024373b4";
  const cache = {};

  async function getChapter(book, chapter) {
    const key = book + "_" + chapter;
    if (cache[key]) return cache[key];

    try {
      const singleChapter = ["Obadiah","Philemon","2 John","3 John","Jude"];
      const q = encodeURIComponent(singleChapter.includes(book) ? book : book + " " + chapter);
      const res = await fetch(
        "https://api.esv.org/v3/passage/text/?q=" + q +
        "&include-headings=false&include-footnotes=false&include-verse-numbers=true" +
        "&include-short-copyright=true&include-passage-references=false",
        { headers: { Authorization: "Token " + API_KEY } }
      );
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      const text = (json.passages && json.passages[0]) || "";
      const verses = parseESV(text, book, chapter);
      if (verses.length > 0) {
        verses._translation = "ESV";
        cache[key] = verses;
        return verses;
      }
    } catch (e) {
      console.warn("ESV API failed, using WEB fallback:", e);
    }

    // Fallback to bundled WEB
    const fallback = BIBLE_DATA[book] && BIBLE_DATA[book][String(chapter)];
    if (fallback) { fallback._translation = "WEB"; }
    return fallback || [];
  }

  function parseESV(text, book, chapter) {
    const verses = [];
    const parts = text.split(/\[(\d+)\]\s*/);
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i]);
      let t = (parts[i + 1] || "").replace(/\s+/g, " ").trim();
      // Strip short copyright from last verse
      if (i + 2 >= parts.length) t = t.replace(/\s*\(ESV\)\s*$/, "");
      if (t) verses.push({ book, chapter: parseInt(chapter), verse: num, text: t });
    }
    return verses;
  }

  return { getChapter };
})();
