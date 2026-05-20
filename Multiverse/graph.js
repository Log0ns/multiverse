// graph.js — Hybrid layout: fixed radial chapters + force-directed notes
const Graph = (() => {
  let canvas, ctx, width, height;
  let nodes = [], edges = [];
  let hoveredNode = null, hoveredEdge = null, selectedNode = null;
  let dragNode = null, dragOffset = { x: 0, y: 0 }, dragMoved = false;
  let panStart = null;
  let linkDrag = null;
  let camera = { x: 0, y: 0, zoom: 0.8 };
  let animId = null;
  let onNodeClick = null, onNodeHover = null, onEdgeHover = null, onNodeLongPress = null, onLink = null;

  const BOOK_NAMES = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
    '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
    'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
    'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
    'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
    'Zephaniah','Haggai','Zechariah','Malachi',
    'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
    'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
    '1 John','2 John','3 John','Jude','Revelation'
  ];

  const CHAPTER_COUNTS = {
    'Genesis':50,'Exodus':40,'Leviticus':27,'Numbers':36,'Deuteronomy':34,
    'Joshua':24,'Judges':21,'Ruth':4,'1 Samuel':31,'2 Samuel':24,
    '1 Kings':22,'2 Kings':25,'1 Chronicles':29,'2 Chronicles':36,
    'Ezra':10,'Nehemiah':13,'Esther':10,'Job':42,'Psalms':150,'Proverbs':31,
    'Ecclesiastes':12,'Song of Solomon':8,'Isaiah':66,'Jeremiah':52,
    'Lamentations':5,'Ezekiel':48,'Daniel':12,'Hosea':14,'Joel':3,'Amos':9,
    'Obadiah':1,'Jonah':4,'Micah':7,'Nahum':3,'Habakkuk':3,'Zephaniah':3,
    'Haggai':2,'Zechariah':14,'Malachi':4,
    'Matthew':28,'Mark':16,'Luke':24,'John':21,'Acts':28,'Romans':16,
    '1 Corinthians':16,'2 Corinthians':13,'Galatians':6,'Ephesians':6,
    'Philippians':4,'Colossians':4,'1 Thessalonians':5,'2 Thessalonians':3,
    '1 Timothy':6,'2 Timothy':4,'Titus':3,'Philemon':1,'Hebrews':13,
    'James':5,'1 Peter':5,'2 Peter':3,'1 John':5,'2 John':1,'3 John':1,
    'Jude':1,'Revelation':22
  };

  function init(canvasEl, opts = {}) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onNodeClick = opts.onNodeClick || null;
    onNodeHover = opts.onNodeHover || null;
    onEdgeHover = opts.onEdgeHover || null;
    onNodeLongPress = opts.onNodeLongPress || null;
    onLink = opts.onLink || null;
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    buildChapterNodes();
    startRender();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    width = rect.width;
    height = rect.height;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function buildChapterNodes() {
    nodes = [];
    let index = 0;
    const totalChapters = 1189;
    for (const book of BOOK_NAMES) {
      const count = CHAPTER_COUNTS[book];
      for (let ch = 1; ch <= count; ch++) {
        const angle = (index / totalChapters) * Math.PI * 2 * 4;
        const radius = 150 + index * 0.8;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        nodes.push({
          id: `${book}_${ch}`, type: 'chapter', label: `${book} ${ch}`,
          book, chapter: ch, x, y, fx: x, fy: y, radius: 4, color: '#4b5563', active: false
        });
        index++;
      }
    }
  }

  function updateDynamicNodes(notes) {
    const savedPositions = loadPositions();
    nodes = nodes.filter(n => n.type === 'chapter');
    edges = [];

    const activeChapters = Store.getChaptersWithNotes();
    nodes.forEach(n => {
      if (n.type === 'chapter') {
        n.active = activeChapters.has(n.id);
        n.color = n.active ? '#1e3a5f' : '#4b5563';
      }
    });

    const placedPositions = [];
    const seenEdges = new Set();

    for (const note of notes) {
      const nodeId = `note_${note.id}`;
      let nx, ny;
      if (savedPositions[nodeId]) {
        nx = savedPositions[nodeId].x;
        ny = savedPositions[nodeId].y;
      } else {
        let cx = 0, cy = 0, count = 0;
        for (const chKey of note.chapters) {
          const chNode = nodes.find(n => n.id === chKey);
          if (chNode) { cx += chNode.x; cy += chNode.y; count++; }
        }
        if (count > 0) { cx /= count; cy /= count; }
        else { cx = Math.random() * 400 - 200; cy = Math.random() * 400 - 200; }
        const pos = findOpenPosition(cx, cy, 60, placedPositions);
        nx = pos.x; ny = pos.y;
        savedPositions[nodeId] = { x: nx, y: ny };
      }
      placedPositions.push({ x: nx, y: ny });

      const noteNode = {
        id: nodeId, type: 'note', label: note.title, noteId: note.id,
        x: nx, y: ny, radius: 7, color: note.color, active: true
      };
      nodes.push(noteNode);

      // Edges to chapters
      for (const chKey of note.chapters) {
        edges.push({ source: noteNode.id, target: chKey, color: note.color });
      }
      // Edges to linked notes
      for (const lid of note.linkedNotes) {
        const eKey = Math.min(note.id, lid) + '_' + Math.max(note.id, lid);
        if (!seenEdges.has(eKey)) {
          seenEdges.add(eKey);
          edges.push({ source: noteNode.id, target: `note_${lid}`, color: note.color + '99' });
        }
      }
    }

    savePositions(savedPositions);
  }

  function findOpenPosition(cx, cy, minDist, placed) {
    let x = cx + (Math.random() - 0.5) * minDist;
    let y = cy + (Math.random() - 0.5) * minDist;
    for (let attempt = 0; attempt < 20; attempt++) {
      let tooClose = false;
      for (const p of placed) {
        const dx = x - p.x, dy = y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { tooClose = true; break; }
      }
      if (!tooClose) return { x, y };
      const angle = attempt * 0.8;
      const dist = minDist + attempt * 15;
      x = cx + Math.cos(angle) * dist;
      y = cy + Math.sin(angle) * dist;
    }
    return { x, y };
  }

  function loadPositions() {
    try { const s = localStorage.getItem('bible-study-positions'); return s ? JSON.parse(s) : {}; }
    catch { return {}; }
  }
  function savePositions(p) { localStorage.setItem('bible-study-positions', JSON.stringify(p)); }
  function saveNodePosition(id, x, y) { const p = loadPositions(); p[id] = { x, y }; savePositions(p); }

  function startRender() { function frame() { draw(); animId = requestAnimationFrame(frame); } frame(); }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2 + camera.x, height / 2 + camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Edges
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) continue;
      const isHov = hoveredEdge && hoveredEdge.edge === e;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = isHov ? '#60a5fa' : (e.color || '#374151');
      ctx.lineWidth = isHov ? 2.5 : 0.8;
      ctx.globalAlpha = isHov ? 1 : 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Nodes
    for (const n of nodes) {
      const isHovered = hoveredNode === n;
      const isSelected = selectedNode === n;
      let r = n.radius;
      if (isHovered || isSelected) r += 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = (n.type === 'chapter' && !n.active) ? 0.6 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isSelected) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (n.type !== 'chapter' || isHovered || isSelected) {
        if (camera.zoom > 0.4 || n.type !== 'chapter') {
          ctx.font = n.type === 'note' ? 'bold 9px Segoe UI' : '8px Segoe UI';
          ctx.fillStyle = n.type === 'chapter' ? '#9ca3af' : n.color;
          ctx.fillText(n.label, n.x + r + 3, n.y + 3);
        }
      }
    }

    // Link drag line
    if (linkDrag) {
      const src = linkDrag.sourceNode;
      const { x: mx, y: my } = screenToWorld(linkDrag.mx, linkDrag.my);
      ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(mx, my);
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - width / 2 - camera.x) / camera.zoom, y: (sy - height / 2 - camera.y) / camera.zoom };
  }

  function findNodeAt(sx, sy) {
    const { x, y } = screenToWorld(sx, sy);
    const sorted = [...nodes].sort((a, b) => {
      if (a.type === 'chapter' && b.type !== 'chapter') return -1;
      if (a.type !== 'chapter' && b.type === 'chapter') return 1;
      return 0;
    }).reverse();
    for (const n of sorted) {
      const dx = n.x - x, dy = n.y - y;
      const hitR = Math.max(n.radius + 3, 6);
      if (dx * dx + dy * dy < hitR * hitR) return n;
    }
    return null;
  }

  function findEdgeAt(sx, sy) {
    const { x, y } = screenToWorld(sx, sy);
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const dot = ((x - s.x) * dx + (y - s.y) * dy) / (len * len);
      const closest = Math.max(0, Math.min(1, dot));
      const px = s.x + closest * dx, py = s.y + closest * dy;
      const dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
      if (dist < 8 / camera.zoom) return { edge: e, source: s, target: t };
    }
    return null;
  }

  function onMouseDown(e) {
    if (e.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const node = findNodeAt(sx, sy);
    if (e.ctrlKey && node) {
      linkDrag = { sourceNode: node, mx: sx, my: sy };
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (node) {
      dragNode = node;
      dragMoved = false;
      const { x, y } = screenToWorld(sx, sy);
      dragOffset = { x: node.x - x, y: node.y - y };
    } else {
      const edgeHit = findEdgeAt(sx, sy);
      if (edgeHit && selectedNode && (edgeHit.source.id === selectedNode.id || edgeHit.target.id === selectedNode.id)) {
        const otherNode = (edgeHit.source.id === selectedNode.id) ? edgeHit.target : edgeHit.source;
        animateTo(otherNode.x, otherNode.y, () => {
          selectedNode = otherNode;
          if (otherNode.type === 'note' && onNodeLongPress) {
            const rect = canvas.getBoundingClientRect();
            const sx = otherNode.x * camera.zoom + camera.x + width / 2;
            const sy = otherNode.y * camera.zoom + camera.y + height / 2;
            onNodeLongPress(otherNode, sx, sy);
          }
        });
        return;
      }
      panStart = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
    }
  }

  function onMouseMove(e) {
    if (e.target !== canvas && !dragNode && !panStart && !linkDrag) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (linkDrag) { linkDrag.mx = sx; linkDrag.my = sy; canvas.style.cursor = 'crosshair'; return; }
    if (dragNode && dragNode.type !== 'chapter') {
      const { x, y } = screenToWorld(sx, sy);
      dragNode.x = x + dragOffset.x; dragNode.y = y + dragOffset.y;
      dragMoved = true;
    } else if (panStart) {
      camera.x = panStart.cx + (e.clientX - panStart.x);
      camera.y = panStart.cy + (e.clientY - panStart.y);
      canvas.style.cursor = 'grabbing';
    } else {
      const node = findNodeAt(sx, sy);
      hoveredNode = node;
      if (node) { hoveredEdge = null; canvas.style.cursor = 'pointer'; }
      else { hoveredEdge = findEdgeAt(sx, sy); canvas.style.cursor = hoveredEdge ? 'pointer' : 'grab'; }
      if (onNodeHover) onNodeHover(node, e.clientX, e.clientY, e.ctrlKey);
      if (onEdgeHover) onEdgeHover(hoveredEdge, selectedNode, e.clientX, e.clientY);
    }
  }

  function onMouseUp(e) {
    if (linkDrag) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const targetNode = findNodeAt(sx, sy);
      if (targetNode && targetNode !== linkDrag.sourceNode) { if (onLink) onLink(linkDrag.sourceNode, targetNode); }
      linkDrag = null; canvas.style.cursor = 'grab'; return;
    }
    if (dragNode) {
      if (dragNode.type !== 'chapter') saveNodePosition(dragNode.id, dragNode.x, dragNode.y);
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = findNodeAt(sx, sy);
      if (node && node === dragNode && !dragMoved) {
        const wasSelected = (selectedNode === node);
        selectedNode = node;
        if (onNodeClick) onNodeClick(node, wasSelected);
      }
      dragNode = null;
    } else if (panStart) {
      const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        selectedNode = null;
        if (onNodeClick) onNodeClick(null);
      }
      canvas.style.cursor = 'grab'; panStart = null;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, camera.zoom * delta));
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - width / 2;
    const my = e.clientY - rect.top - height / 2;
    camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom);
    camera.y = my - (my - camera.y) * (newZoom / camera.zoom);
    camera.zoom = newZoom;
  }

  function animateTo(wx, wy, onDone) {
    const startX = camera.x, startY = camera.y;
    const panelWidth = document.getElementById('detail-panel') && document.getElementById('detail-panel').offsetWidth && document.getElementById('detail-panel').style.display !== 'none' ? document.getElementById('detail-panel').offsetWidth : 0;
    const endX = -wx * camera.zoom - panelWidth / 2, endY = -wy * camera.zoom;
    const duration = 400, t0 = performance.now();
    function tick() {
      const p = Math.min((performance.now() - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      camera.x = startX + (endX - startX) * ease;
      camera.y = startY + (endY - startY) * ease;
      if (p < 1) requestAnimationFrame(tick);
      else if (onDone) onDone();
    }
    tick();
  }

  // --- Touch Support ---
  let touchState = { type: null, startTime: 0, startX: 0, startY: 0, lastDist: 0, node: null, moved: false, longPressTimer: null };

  function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearTimeout(touchState.longPressTimer);
      touchState.type = 'pinch';
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.lastDist = Math.sqrt(dx * dx + dy * dy);
      touchState.startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      touchState.startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      return;
    }
    const pos = getTouchPos(e.touches[0]);
    const node = findNodeAt(pos.x, pos.y);
    touchState.type = 'single';
    touchState.startTime = Date.now();
    touchState.startX = pos.x;
    touchState.startY = pos.y;
    touchState.node = node;
    touchState.moved = false;
    touchState.longPressTimer = setTimeout(() => {
      if (!touchState.moved && touchState.node) {
        if (selectedNode === touchState.node && onNodeLongPress) {
          touchState.type = 'longpress';
          onNodeLongPress(touchState.node, pos.x, pos.y);
        } else {
          touchState.type = 'link';
          linkDrag = { sourceNode: touchState.node, mx: pos.x, my: pos.y };
        }
      }
    }, 500);
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (touchState.type === 'pinch' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchState.lastDist;
      const newZoom = Math.max(0.1, Math.min(5, camera.zoom * scale));
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = canvas.getBoundingClientRect();
      const cx = mx - rect.left - width / 2;
      const cy = my - rect.top - height / 2;
      camera.x = cx - (cx - camera.x) * (newZoom / camera.zoom);
      camera.y = cy - (cy - camera.y) * (newZoom / camera.zoom);
      camera.zoom = newZoom;
      touchState.lastDist = dist;
      return;
    }
    if (e.touches.length !== 1) return;
    const pos = getTouchPos(e.touches[0]);
    const dx = pos.x - touchState.startX;
    const dy = pos.y - touchState.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) touchState.moved = true;
    if (touchState.type === 'link' && linkDrag) {
      linkDrag.mx = pos.x;
      linkDrag.my = pos.y;
      return;
    }
    if (touchState.moved) {
      clearTimeout(touchState.longPressTimer);
      if (touchState.node && touchState.node.type !== 'chapter') {
        const { x, y } = screenToWorld(pos.x, pos.y);
        touchState.node.x = x;
        touchState.node.y = y;
      } else {
        camera.x += dx;
        camera.y += dy;
        touchState.startX = pos.x;
        touchState.startY = pos.y;
      }
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    clearTimeout(touchState.longPressTimer);
    if (touchState.type === 'link' && linkDrag) {
      const pos = e.changedTouches.length > 0 ? getTouchPos(e.changedTouches[0]) : { x: linkDrag.mx, y: linkDrag.my };
      const targetNode = findNodeAt(pos.x, pos.y);
      if (targetNode && targetNode !== linkDrag.sourceNode) {
        if (onLink) onLink(linkDrag.sourceNode, targetNode);
      }
      linkDrag = null;
      touchState.type = null;
      return;
    }
    if (touchState.type === 'single' && !touchState.moved) {
      const node = touchState.node;
      if (node) {
        const wasSelected = (selectedNode === node);
        selectedNode = node;
        if (onNodeClick) onNodeClick(node, wasSelected);
      } else {
        selectedNode = null;
        if (onNodeClick) onNodeClick(null, false);
      }
    }
    if (touchState.node && touchState.node.type !== 'chapter' && touchState.moved) {
      saveNodePosition(touchState.node.id, touchState.node.x, touchState.node.y);
    }
    touchState.type = null;
  }

  function focusOnChapter(chapterKey) {
    const node = nodes.find(n => n.id === chapterKey);
    if (node) animateTo(node.x, node.y, () => { selectedNode = node; });
  }

  function focusOnNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) animateTo(node.x, node.y, () => { selectedNode = node; });
  }

  function getSelectedNode() { return selectedNode; }
  function getCamera() { return camera; }

  return { init, updateDynamicNodes, focusOnChapter, focusOnNode, getSelectedNode, getCamera, resize, nodes: () => nodes };
})();
