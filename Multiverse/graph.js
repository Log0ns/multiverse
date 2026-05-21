// graph.js — Hybrid layout: fixed radial chapters + force-directed notes
const Graph = (() => {
  let canvas, ctx, width, height;
  let nodes = [], edges = [], clusters = [];
  let people = [], caravans = [];
  let bannerHits = [];
  let lastPeopleUpdate = 0;
  let clouds = [];
  let smokeParticles = [];

  // Seasonal trees scattered across the map
  const trees = [];
  for (let i = 0; i < 400; i++) {
    trees.push({
      x: (Math.random() - 0.5) * 2500,
      y: (Math.random() - 0.5) * 2500,
      size: 2 + Math.random() * 3,
      type: Math.random() > 0.3 ? 'deciduous' : 'evergreen'
    });
  }

  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      w: 60 + Math.random() * 80,
      h: 20 + Math.random() * 15,
      speed: 0.05 + Math.random() * 0.08,
      opacity: 0.03 + Math.random() * 0.04
    });
  }
  let hoveredNode = null, hoveredEdge = null, selectedNode = null;
  let dragNode = null, dragOffset = { x: 0, y: 0 }, dragMoved = false;
  let panStart = null;
  let linkDrag = null;
  let camera = { x: 0, y: 0, zoom: 0.8 };
  let animId = null;
  let onNodeClick = null, onNodeHover = null, onEdgeHover = null, onNodeLongPress = null, onBannerHover = null, onLink = null;

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
    onBannerHover = opts.onBannerHover || null;
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
    detectClusters();
    spawnPeople();
    spawnCaravans();
  }

  function detectClusters() {
    const noteNodes = nodes.filter(n => n.type === 'note');
    if (noteNodes.length === 0) { clusters = []; return; }
    const CLUSTER_DIST = 120;
    const visited = new Set();
    clusters = [];
    for (const node of noteNodes) {
      if (visited.has(node.id)) continue;
      const cluster = [];
      const queue = [node];
      visited.add(node.id);
      while (queue.length > 0) {
        const current = queue.shift();
        cluster.push(current);
        for (const other of noteNodes) {
          if (visited.has(other.id)) continue;
          const dx = current.x - other.x, dy = current.y - other.y;
          if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_DIST) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }
  }

  function spawnPeople() {
    people = [];
    const clusteredIds = new Set();
    clusters.forEach(c => c.forEach(n => clusteredIds.add(n.id)));
    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      const cx = c.reduce((s, n) => s + n.x, 0) / c.length;
      const cy = c.reduce((s, n) => s + n.y, 0) / c.length;
      const maxD = Math.max(...c.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2))) + 20;
      // Count memorized verses near this cluster for people count
      let clusterVerseCount = 0;
      const cRad = maxD + 40;
      for (const chNode of nodes) {
        if (chNode.type !== 'chapter') continue;
        const dx = chNode.x - cx, dy = chNode.y - cy;
        if (Math.sqrt(dx * dx + dy * dy) > cRad) continue;
        const ps = chNode.id.split('_');
        const pChNum = ps.pop();
        const pBook = ps.join(' ');
        clusterVerseCount += Store.getMemorizationForChapter(pBook, pChNum).length;
      }
      const count = clusterVerseCount;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * maxD * 0.8;
        people.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          cx, cy, maxD,
          dx: (Math.random() - 0.5) * 0.3,
          dy: (Math.random() - 0.5) * 0.3,
          timer: Math.random() * 200
        });
      }
    }
    // Farmers near lone notes close to clusters
    const loneNotes = nodes.filter(n => n.type === 'note' && !clusteredIds.has(n.id));
    for (const lone of loneNotes) {
      let near = false;
      for (const cluster of clusters) {
        const ccx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
        const ccy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
        if (Math.sqrt((lone.x - ccx) ** 2 + (lone.y - ccy) ** 2) < 250) { near = true; break; }
      }
      if (near) {
        for (let i = 0; i < 2; i++) {
          people.push({
            x: lone.x + (Math.random() - 0.5) * 25,
            y: lone.y + (Math.random() - 0.5) * 20,
            cx: lone.x, cy: lone.y, maxD: 20,
            dx: (Math.random() - 0.5) * 0.15,
            dy: (Math.random() - 0.5) * 0.15,
            timer: Math.random() * 300
          });
        }
      } else {
        // Oasis dwellers
        for (let i = 0; i < 2; i++) {
          people.push({
            x: lone.x + (Math.random() - 0.5) * 20,
            y: lone.y + (Math.random() - 0.5) * 16,
            cx: lone.x, cy: lone.y, maxD: 16,
            dx: (Math.random() - 0.5) * 0.1,
            dy: (Math.random() - 0.5) * 0.1,
            timer: Math.random() * 400
          });
        }
      }
    }
  }

  let roadPairs = [];

  function spawnCaravans() {
    caravans = [];
    roadPairs = [];
    const drawnPairs = new Set();
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t || s.type !== 'note' || t.type !== 'note') continue;
      let ci = -1, cj = -1;
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].some(n => n.id === s.id)) ci = i;
        if (clusters[i].some(n => n.id === t.id)) cj = i;
      }
      if (ci === -1 || cj === -1 || ci === cj) continue;
      const key = Math.min(ci, cj) + '_' + Math.max(ci, cj);
      if (drawnPairs.has(key)) continue;
      drawnPairs.add(key);
      const c1 = { x: clusters[ci].reduce((s, n) => s + n.x, 0) / clusters[ci].length, y: clusters[ci].reduce((s, n) => s + n.y, 0) / clusters[ci].length };
      const c2 = { x: clusters[cj].reduce((s, n) => s + n.x, 0) / clusters[cj].length, y: clusters[cj].reduce((s, n) => s + n.y, 0) / clusters[cj].length };
      roadPairs.push({ c1, c2, startX: 0, startY: 0, endX: 0, endY: 0 });
    }
  }

  function maybeSpawnCaravan() {
    if (roadPairs.length === 0) return;
    if (caravans.length >= roadPairs.length * 2) return;
    if (Math.random() > 0.005) return;
    const road = roadPairs[Math.floor(Math.random() * roadPairs.length)];
    if (!road.startX && !road.startY) return;
    const forward = Math.random() > 0.5;
    caravans.push({
      sx: forward ? road.startX : road.endX,
      sy: forward ? road.startY : road.endY,
      ex: forward ? road.endX : road.startX,
      ey: forward ? road.endY : road.startY,
      progress: 0,
      speed: 0.0003 + Math.random() * 0.0003,
      size: 2 + Math.floor(Math.random() * 3)
    });
  }

  function updatePeople() {
    for (const p of people) {
      p.timer--;
      if (p.timer <= 0) {
        p.dx = (Math.random() - 0.5) * 0.3;
        p.dy = (Math.random() - 0.5) * 0.3;
        p.timer = 100 + Math.random() * 200;
      }
      p.x += p.dx;
      p.y += p.dy;
      const d = Math.sqrt((p.x - p.cx) ** 2 + (p.y - p.cy) ** 2);
      if (d > p.maxD * 0.85) {
        p.dx = (p.cx - p.x) * 0.01;
        p.dy = (p.cy - p.y) * 0.01;
      }
    }
    maybeSpawnCaravan();
    for (let i = caravans.length - 1; i >= 0; i--) {
      caravans[i].progress += caravans[i].speed;
      if (caravans[i].progress >= 1) { caravans.splice(i, 1); }
    }
  }

  function drawPeople() {
    ctx.fillStyle = '#d4d4d4';
    ctx.globalAlpha = 0.7;
    for (const p of people) {
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Caravans
    for (const c of caravans) {
      const t = c.progress;
      const x = c.sx + (c.ex - c.sx) * t;
      const y = c.sy + (c.ey - c.sy) * t;
      ctx.fillStyle = '#fbbf24';
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < c.size; i++) {
        ctx.fillRect(x - 1 + i * 4, y - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function convexHull(points) {
    if (points.length < 3) return points.slice();
    points = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of points) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  function expandHull(hull, padding) {
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    return hull.map(p => {
      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = (dist + padding) / dist;
      return { x: cx + dx * scale, y: cy + dy * scale };
    });
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

    // Day/night cycle based on real time
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    let dayAlpha = 0;
    if (hour >= 6 && hour < 8) { dayAlpha = (hour - 6) / 2 * 0.12; }
    else if (hour >= 8 && hour < 17) { dayAlpha = 0.12; }
    else if (hour >= 17 && hour < 19) { dayAlpha = (19 - hour) / 2 * 0.12; }
    else if (hour >= 19 || hour < 5) { dayAlpha = -0.08; }
    else if (hour >= 5 && hour < 6) { dayAlpha = (hour - 5) * -0.08; }
    // Apply ambient tint
    if (dayAlpha > 0) {
      ctx.fillStyle = '#fef3c7';
      ctx.globalAlpha = dayAlpha;
      ctx.fillRect(-5000, -5000, 10000, 10000);
      ctx.globalAlpha = 1;
    } else if (dayAlpha < 0) {
      ctx.fillStyle = '#0f172a';
      ctx.globalAlpha = Math.abs(dayAlpha);
      ctx.fillRect(-5000, -5000, 10000, 10000);
      ctx.globalAlpha = 1;
    }

    // Clouds
    for (const cloud of clouds) {
      cloud.x += cloud.speed;
      if (cloud.x > 2000) cloud.x = -2000;
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = hour >= 19 || hour < 5 ? '#1e293b' : '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloud.x - cloud.w * 0.25, cloud.y + 3, cloud.w * 0.3, cloud.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloud.x + cloud.w * 0.25, cloud.y + 2, cloud.w * 0.35, cloud.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Seasonal trees
    const month = new Date().getMonth(); // 0-11
    let leafColor, trunkColor = '#713f12';
    if (month >= 2 && month <= 4) { leafColor = '#22c55e'; } // spring - bright green
    else if (month >= 5 && month <= 7) { leafColor = '#16a34a'; } // summer - deep green
    else if (month >= 8 && month <= 9) { leafColor = '#f59e0b'; } // fall - orange/gold
    else if (month === 10) { leafColor = '#dc2626'; } // late fall - red
    else { leafColor = null; } // winter - bare

    for (const tree of trees) {
      ctx.globalAlpha = 0.6;
      // Trunk
      ctx.strokeStyle = trunkColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y);
      ctx.lineTo(tree.x, tree.y - tree.size * 1.5);
      ctx.stroke();
      if (tree.type === 'evergreen') {
        // Always green pine
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.moveTo(tree.x, tree.y - tree.size * 3);
        ctx.lineTo(tree.x - tree.size, tree.y - tree.size * 0.5);
        ctx.lineTo(tree.x + tree.size, tree.y - tree.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (leafColor) {
        // Deciduous with leaves
        ctx.fillStyle = leafColor;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - tree.size * 2, tree.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Bare branches in winter
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 0.5;
        for (let b = 0; b < 3; b++) {
          const ba = (b * 1.2 + tree.x * 0.01) % (Math.PI * 2);
          ctx.beginPath();
          ctx.moveTo(tree.x, tree.y - tree.size * 1.5);
          ctx.lineTo(tree.x + Math.cos(ba) * tree.size * 1.2, tree.y - tree.size * 2 + Math.sin(ba) * tree.size * 0.5);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    bannerHits = [];

    // Cluster walls
    for (const cluster of clusters) {
      const points = cluster.map(n => ({ x: n.x, y: n.y }));
      if (points.length < 2) continue;
      const hull = points.length >= 3 ? expandHull(convexHull(points), 20 + cluster.length * 3) : null;
      if (hull && hull.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
        ctx.closePath();
        ctx.fillStyle = '#1e3a1e';
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 2.5 + cluster.length * 0.3;
        ctx.setLineDash([8, 4]);
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (points.length === 2) {
        const midX = (points[0].x + points[1].x) / 2;
        const midY = (points[0].y + points[1].y) / 2;
        const rad = Math.sqrt(Math.pow(points[0].x - points[1].x, 2) + Math.pow(points[0].y - points[1].y, 2)) / 2 + 25;
        ctx.beginPath();
        ctx.arc(midX, midY, rad, 0, Math.PI * 2);
        ctx.fillStyle = '#1e3a1e';
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([8, 4]);
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    updatePeople();

    // Smoke particles - spawn from building positions
    if (Math.random() < 0.15 && clusters.length > 0) {
      const ci = Math.floor(Math.random() * clusters.length);
      const c = clusters[ci];
      const cx = c.reduce((s, n) => s + n.x, 0) / c.length;
      const cy = c.reduce((s, n) => s + n.y, 0) / c.length;
      const maxD = Math.max(...c.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2))) + 25;
      const seed = c.length * 7 + Math.round(cx * 0.1);
      const midBuildings = Math.min(c.length * 3, 15);
      const bi = Math.floor(Math.random() * midBuildings);
      const angle = (seed + bi * 1.9 + bi * bi * 0.3) % (Math.PI * 2);
      const distFrac = 0.3 + ((seed * (bi + 2) * 3) % 60) / 100;
      const dist = maxD * distFrac;
      smokeParticles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist - 3,
        life: 1,
        drift: (Math.random() - 0.5) * 0.1
      });
    }
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.y -= 0.2;
      p.x += p.drift;
      p.life -= 0.005;
      if (p.life <= 0) { smokeParticles.splice(i, 1); }
    }

    // Buildings inside clusters + farmland outside
    const clusteredIds = new Set();
    clusters.forEach(c => c.forEach(n => clusteredIds.add(n.id)));

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const cx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
      const cy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
      const seed = cluster.length * 7 + Math.round(cx * 0.1);
      const maxDist = Math.max(...cluster.map(n => Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2))) + 25;

      // Castle at center
      if (cluster.length >= 3) {
        ctx.globalAlpha = 0.85;
        const cs = Math.min(6 + cluster.length * 2, 20);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(cx - cs - 1, cy - cs - 4, cs * 2 + 2, 4);
        ctx.fillStyle = '#78716c';
        const bCount = Math.floor(cs * 2 / 4) + 1;
        for (let i = 0; i < bCount; i++) { ctx.fillRect(cx - cs - 1 + i * 4, cy - cs - 7, 2, 3); }
        // Tower corners
        if (cluster.length >= 4) {
          for (const ox of [-1, 1]) {
            for (const oy of [-1, 1]) {
              ctx.fillStyle = '#78716c';
              ctx.fillRect(cx + ox * (cs + 2) - 3, cy + oy * (cs + 2) - 3, 6, 6);
              ctx.fillStyle = '#57534e';
              ctx.fillRect(cx + ox * (cs + 2) - 3, cy + oy * (cs + 2) - 5, 6, 2);
            }

      // City banner showing memorized verse count (top-left of city bounds)
      // Count memorized verses from any chapter node near this cluster
      const clusterCx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
      const clusterCy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
      const clusterRad = Math.max(...cluster.map(n => Math.sqrt((n.x - clusterCx) ** 2 + (n.y - clusterCy) ** 2))) + 60;
      let bannerCount = 0;
      const countedChapters = new Set();
      for (const chNode of nodes) {
        if (chNode.type !== 'chapter') continue;
        const dx = chNode.x - clusterCx, dy = chNode.y - clusterCy;
        if (Math.sqrt(dx * dx + dy * dy) > clusterRad) continue;
        const parts = chNode.id.split('_');
        const chNum = parts.pop();
        const bookName = parts.join(' ');
        const key = bookName + '_' + chNum;
        if (countedChapters.has(key)) continue;
        countedChapters.add(key);
        const memVerses = Store.getMemorizationForChapter(bookName, chNum);
        bannerCount += memVerses.length;
      }
      if (bannerCount > 0) {
        // Find top-left of cluster
        const minX = Math.min(...cluster.map(n => n.x)) - 30;
        const minY = Math.min(...cluster.map(n => n.y)) - 30;
        const bx = minX, by = minY;
        bannerHits.push({ x: bx, y: by, radius: 10, chapters: [...countedChapters] });
        // Banner color based on count
        let bannerColor;
        if (bannerCount >= 20) bannerColor = '#eab308';
        else if (bannerCount >= 10) bannerColor = '#a855f7';
        else if (bannerCount >= 5) bannerColor = '#3b82f6';
        else bannerColor = '#6b7280';
        // Badge background
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = bannerColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Number
        ctx.fillStyle = bannerColor;
        ctx.font = 'bold 8px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(bannerCount, bx, by + 3);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
          }
        }
        ctx.globalAlpha = 1;

              }

      // Count memorized verses near this cluster for buildings
      const clusterCx2 = cx, clusterCy2 = cy;
      const clusterRad2 = maxDist + 60;
      let cityVerseCount = 0;
      const countedCh2 = new Set();
      for (const chNode of nodes) {
        if (chNode.type !== 'chapter') continue;
        const cdx = chNode.x - clusterCx2, cdy = chNode.y - clusterCy2;
        if (Math.sqrt(cdx * cdx + cdy * cdy) > clusterRad2) continue;
        const cparts = chNode.id.split('_');
        const cchNum = cparts.pop();
        const cbookName = cparts.join(' ');
        const ckey = cbookName + '_' + cchNum;
        if (countedCh2.has(ckey)) continue;
        countedCh2.add(ckey);
        cityVerseCount += Store.getMemorizationForChapter(cbookName, cchNum).length;
      }
      // Medium buildings spread between center and walls (one per memorized verse)
      const midBuildings = cityVerseCount;
      for (let i = 0; i < midBuildings; i++) {
        const angle = (seed + i * 1.9 + i * i * 0.3) % (Math.PI * 2);
        const distFrac = 0.3 + ((seed * (i + 2) * 3) % 60) / 100;
        const dist = maxDist * distFrac;
        const bx = cx + Math.cos(angle) * dist;
        const by = cy + Math.sin(angle) * dist;
        const bw = 4 + ((seed + i * 3) % 4);
        const bh = 4 + ((seed + i * 5) % 3);
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#57534e';
        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(bx - bw / 2 - 0.5, by - bh / 2 - 2, bw + 1, 2);
        ctx.globalAlpha = 1;
      }


    }

    // Farmland around lone notes near clusters
    const loneNotes = nodes.filter(n => n.type === 'note' && !clusteredIds.has(n.id));
    for (const lone of loneNotes) {
      let nearCluster = false;
      for (const cluster of clusters) {
        const ccx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
        const ccy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
        const d = Math.sqrt((lone.x - ccx) ** 2 + (lone.y - ccy) ** 2);
        if (d < 250) { nearCluster = true; break; }
      }
      if (!nearCluster) continue;
      const seed = Math.round(lone.x * 0.3 + lone.y * 0.7);
      // Farm field
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#365314';
      ctx.fillRect(lone.x - 15, lone.y - 12, 30, 24);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#4d7c0f';
      ctx.lineWidth = 0.5;
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.moveTo(lone.x - 15, lone.y - 10 + r * 5);
        ctx.lineTo(lone.x + 15, lone.y - 10 + r * 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Farmhouse hut
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#44403c';
      ctx.fillRect(lone.x - 3, lone.y + 14, 5, 4);
      ctx.fillStyle = '#713f12';
      ctx.fillRect(lone.x - 3.5, lone.y + 12, 6, 2);
      ctx.globalAlpha = 1;
    }

    // Draw smoke
    for (const p of smokeParticles) {
      ctx.globalAlpha = p.life * 0.4;
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1 + (1 - p.life) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Oasis settlements for isolated notes
    const loneNotesAll = nodes.filter(n => n.type === 'note' && !clusteredIds.has(n.id));
    for (const lone of loneNotesAll) {
      let nearCluster = false;
      for (const cluster of clusters) {
        const ccx = cluster.reduce((s, n) => s + n.x, 0) / cluster.length;
        const ccy = cluster.reduce((s, n) => s + n.y, 0) / cluster.length;
        if (Math.sqrt((lone.x - ccx) ** 2 + (lone.y - ccy) ** 2) < 250) { nearCluster = true; break; }
      }
      if (nearCluster) continue;
      // Oasis - water pool
      ctx.beginPath();
      ctx.ellipse(lone.x, lone.y + 5, 12, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#164e63';
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
      // Palm trees
      const seed = Math.round(lone.x * 0.2 + lone.y * 0.3);
      for (let i = 0; i < 3; i++) {
        const angle = (seed + i * 2.2) % (Math.PI * 2);
        const tx = lone.x + Math.cos(angle) * 14;
        const ty = lone.y + Math.sin(angle) * 10;
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx, ty - 8);
        ctx.stroke();
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(tx, ty - 9, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Huts around oasis
      for (let i = 0; i < 2 + (seed % 2); i++) {
        const angle = (seed * 2 + i * 1.8 + 0.5) % (Math.PI * 2);
        const hx = lone.x + Math.cos(angle) * 18;
        const hy = lone.y + Math.sin(angle) * 14;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(hx - 2.5, hy - 2, 5, 4);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(hx - 3, hy - 3.5, 6, 1.5);
        ctx.globalAlpha = 1;
      }
    }

    drawPeople();

    // Edges
    function getNodeCluster(node) {
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].some(n => n.id === node.id)) return i;
      }
      return -1;
    }
    function clusterCenter(ci) {
      const c = clusters[ci];
      return { x: c.reduce((s, n) => s + n.x, 0) / c.length, y: c.reduce((s, n) => s + n.y, 0) / c.length };
    }
    function clusterHullPoints(ci) {
      const c = clusters[ci];
      const points = c.map(n => ({ x: n.x, y: n.y }));
      if (points.length < 3) return null;
      return expandHull(convexHull(points), 20 + c.length * 3);
    }
    function lineHullIntersect(px, py, dx, dy, hull) {
      if (!hull || hull.length < 3) return null;
      let best = null, bestT = Infinity;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        const ex = b.x - a.x, ey = b.y - a.y;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 0.001) continue;
        const t = ((a.x - px) * ey - (a.y - py) * ex) / denom;
        const u = ((a.x - px) * dy - (a.y - py) * dx) / denom;
        if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
          bestT = t;
          best = { x: px + dx * t, y: py + dy * t };
        }
      }
      return best;
    }

    // Draw roads between connected clusters (one road per cluster pair)
    const drawnRoads = new Set();
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) continue;
      if (s.type !== 'note' || t.type !== 'note') continue;
      const ci = getNodeCluster(s), cj = getNodeCluster(t);
      if (ci === -1 || cj === -1 || ci === cj) continue;
      const roadKey = Math.min(ci, cj) + '_' + Math.max(ci, cj);
      if (drawnRoads.has(roadKey)) continue;
      drawnRoads.add(roadKey);
      const c1 = clusterCenter(ci), c2 = clusterCenter(cj);
      const dx = c2.x - c1.x, dy = c2.y - c1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) continue;
      const hull1 = clusterHullPoints(ci), hull2 = clusterHullPoints(cj);
      const start = lineHullIntersect(c1.x, c1.y, dx, dy, hull1) || { x: c1.x, y: c1.y };
      const end = lineHullIntersect(c2.x, c2.y, -dx, -dy, hull2) || { x: c2.x, y: c2.y };
      const startX = start.x, startY = start.y;
      const endX = end.x, endY = end.y;
      // Store endpoints for caravans
      const rp = roadPairs.find(r => (Math.abs(r.c1.x - c1.x) < 1 && Math.abs(r.c1.y - c1.y) < 1) || (Math.abs(r.c1.x - c2.x) < 1 && Math.abs(r.c1.y - c2.y) < 1));
      if (rp) { rp.startX = startX; rp.startY = startY; rp.endX = endX; rp.endY = endY; }
      // Draw road straight
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // City gates at road endpoints
      const gateDx = endX - startX, gateDy = endY - startY;
      const gateLen = Math.sqrt(gateDx * gateDx + gateDy * gateDy);
      if (gateLen > 0) {
        const gnx = gateDy / gateLen, gny = -gateDx / gateLen;
        // Gate at start (first city)
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#57534e';
        ctx.fillRect(startX + gnx * 6 - 3, startY + gny * 6 - 4, 6, 10);
        ctx.fillRect(startX - gnx * 6 - 3, startY - gny * 6 - 4, 6, 10);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(startX + gnx * 6 - 3, startY + gny * 6 - 6, 6, 2);
        ctx.fillRect(startX - gnx * 6 - 3, startY - gny * 6 - 6, 6, 2);
        // Gate arch
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX + gnx * 6, startY + gny * 6 - 4);
        ctx.lineTo(startX - gnx * 6, startY - gny * 6 - 4);
        ctx.stroke();
        // Gate at end (second city)
        ctx.fillStyle = '#57534e';
        ctx.fillRect(endX + gnx * 6 - 3, endY + gny * 6 - 4, 6, 10);
        ctx.fillRect(endX - gnx * 6 - 3, endY - gny * 6 - 4, 6, 10);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(endX + gnx * 6 - 3, endY + gny * 6 - 6, 6, 2);
        ctx.fillRect(endX - gnx * 6 - 3, endY - gny * 6 - 6, 6, 2);
        ctx.beginPath();
        ctx.moveTo(endX + gnx * 6, endY + gny * 6 - 4);
        ctx.lineTo(endX - gnx * 6, endY - gny * 6 - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Regular edges
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) continue;
      const isHov = hoveredEdge && hoveredEdge.edge === e;
      const ci = getNodeCluster(s), cj = getNodeCluster(t);
      const isRoad = s.type === 'note' && t.type === 'note' && ci !== -1 && cj !== -1 && ci !== cj;
      if (isRoad && !isHov) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      if (isHov) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = e.color || '#374151';
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.5;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Nodes
    for (const n of nodes) {
      const isHovered = hoveredNode === n;
      const isSelected = selectedNode === n;
      let r = n.radius;
      if (isHovered || isSelected) r += 2;
      if (n.type === 'note') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = (n.type === 'chapter' && !n.active) ? 0.6 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isSelected) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
      if (n.type !== 'chapter' || isHovered || isSelected) {
        if (camera.zoom > 0.4 || n.type !== 'chapter') {
          ctx.font = n.type === 'note' ? 'bold 9px Segoe UI' : '8px Segoe UI';
          ctx.fillStyle = n.type === 'chapter' ? '#9ca3af' : n.color;
          ctx.fillText(n.label, n.x + r + 3, n.y + 3);
        }
      }
      // Shield for chapters with all verses being memorized or fully memorized
      if (n.type === 'chapter' && n.active) {
        const chKey = n.id;
        const parts = chKey.split('_');
        const chNum = parts.pop();
        const bookName = parts.join(' ');
        const bookData = typeof BIBLE_DATA !== 'undefined' ? BIBLE_DATA[bookName] : null;
        if (bookData && bookData[chNum]) {
          const totalVerses = bookData[chNum].length;
          const memVerses = Store.getMemorizationForChapter(bookName, chNum);
          const memorized = memVerses.filter(m => m.level >= 4).length;
          const allInProgress = memVerses.length === totalVerses && totalVerses > 0;
          const allMemorized = memorized === totalVerses && totalVerses > 0;
          if (allInProgress || allMemorized) {
            const sx = n.x, sy = n.y - r - 8;
            const shieldColor = allMemorized ? '#eab308' : '#3b82f6';
            const strokeColor = allMemorized ? '#a16207' : '#1e40af';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(sx, sy - 6);
            ctx.lineTo(sx + 5, sy - 4);
            ctx.lineTo(sx + 5, sy + 2);
            ctx.quadraticCurveTo(sx, sy + 7, sx, sy + 7);
            ctx.quadraticCurveTo(sx, sy + 7, sx - 5, sy + 2);
            ctx.lineTo(sx - 5, sy - 4);
            ctx.closePath();
            ctx.fillStyle = shieldColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Cross on shield
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx, sy - 4);
            ctx.lineTo(sx, sy + 5);
            ctx.moveTo(sx - 3, sy - 1);
            ctx.lineTo(sx + 3, sy - 1);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
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
      if (!node && !hoveredEdge) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        for (const bh of bannerHits) {
          const dx = wx - bh.x, dy = wy - bh.y;
          if (dx * dx + dy * dy < bh.radius * bh.radius * 4) {
            if (onBannerHover) onBannerHover(bh, e.clientX, e.clientY);
            return;
          }
        }
        if (onBannerHover) onBannerHover(null);
      }
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
      detectClusters();
      spawnPeople();
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
    if (e.target.closest('#note-preview-popup') || e.target.closest('.note-preview')) return;
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
      detectClusters();
      spawnPeople();
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

  return { init, updateDynamicNodes, focusOnChapter, focusOnNode, getSelectedNode, getCamera, resize, nodes: () => nodes, clusters: () => clusters };
})();
