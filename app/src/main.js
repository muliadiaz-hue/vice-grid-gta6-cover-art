// Wires the Vice Grid editor: photo tray, layout + grade pickers, caption
// inputs, per-panel captions, undo/redo, drag-to-pan and wheel-to-zoom on the
// selected panel, and one-click PNG export in four post sizes. A `?shot=`
// query instead sets up a fixed scene for a screenshot (./shots.js).
import { drawCover, exportCoverPNG, EXPORT_SIZES } from './cover.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { GRADES, gradeById } from './grades.js';
import { defaultPanels, History } from './panels.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');

const state = {
  photos: [],
  panels: defaultPanels(),
  layout: 'nine',
  grade: 'sunset',
  title: 'Neon Shore',
  subtitle: 'Vice City nights',
  size: 'wide',
  selected: 0,
};

const history = new History();

function snapshot() {
  return JSON.stringify({
    panels: state.panels, layout: state.layout, grade: state.grade,
    title: state.title, subtitle: state.subtitle,
  });
}

function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  syncControls();
  redraw();
}

function commit() {
  history.push(snapshot());
  updateUndoButtons();
}

function redraw() {
  const size = EXPORT_SIZES.find((s) => s.id === state.size) ?? EXPORT_SIZES[2];
  const previewW = 960;
  const previewH = Math.round(previewW * (size.h / size.w));
  canvas.width = previewW;
  canvas.height = previewH;
  drawCover(ctx, state, previewW, previewH);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function updateUndoButtons() {
  document.getElementById('undo').disabled = !history.canUndo;
  document.getElementById('redo').disabled = !history.canRedo;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function renderTray() {
  trayEl.innerHTML = '';
  state.photos.forEach((img, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 96; thumb.height = 72;
    const tctx = thumb.getContext('2d');
    const scale = Math.max(96 / img.naturalWidth, 72 / img.naturalHeight);
    tctx.drawImage(img, (96 - img.naturalWidth * scale) / 2, (72 - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
    thumb.className = 'thumb';
    thumb.title = `Photo ${i + 1} — click to assign to the selected panel`;
    thumb.addEventListener('click', () => {
      commit();
      state.panels[state.selected].photo = i;
      redraw();
      setStatus(`Photo ${i + 1} assigned to panel ${state.selected + 1}.`);
    });
    trayEl.appendChild(thumb);
  });
  if (!state.photos.length) {
    const hint = document.createElement('p');
    hint.className = 'tray-hint';
    hint.textContent = 'Drop photos here or use Add photos — two samples are preloaded below.';
    trayEl.appendChild(hint);
  }
}

async function addPhotos(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const img = await loadImage(URL.createObjectURL(file));
    state.photos.push(img);
  }
  renderTray();
  redraw();
  setStatus(`${state.photos.length} photo(s) loaded. Click a panel, then a tray photo to assign it.`);
}

function buildPickers() {
  const layoutSel = document.getElementById('layout');
  LAYOUTS.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.id; opt.textContent = l.name;
    layoutSel.appendChild(opt);
  });
  const gradeSel = document.getElementById('grade');
  GRADES.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id; opt.textContent = g.name;
    gradeSel.appendChild(opt);
  });
  const sizeSel = document.getElementById('size');
  EXPORT_SIZES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.label;
    sizeSel.appendChild(opt);
  });
}

function syncControls() {
  document.getElementById('layout').value = state.layout;
  document.getElementById('grade').value = state.grade;
  document.getElementById('size').value = state.size;
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('panel-caption').value = state.panels[state.selected]?.caption ?? '';
  document.getElementById('panel-label').textContent = `Panel ${state.selected + 1}`;
  updateUndoButtons();
}

function bindControls() {
  document.getElementById('layout').addEventListener('change', (e) => { commit(); state.layout = e.target.value; redraw(); });
  document.getElementById('grade').addEventListener('change', (e) => { commit(); state.grade = e.target.value; redraw(); });
  document.getElementById('size').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });
  document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  document.getElementById('panel-caption').addEventListener('input', (e) => {
    state.panels[state.selected].caption = e.target.value;
    redraw();
  });
  document.getElementById('undo').addEventListener('click', () => {
    const prev = history.undo(snapshot());
    if (prev) restore(prev);
  });
  document.getElementById('redo').addEventListener('click', () => {
    const next = history.redo(snapshot());
    if (next) restore(next);
  });
  document.getElementById('add-photos').addEventListener('change', (e) => addPhotos(e.target.files));
  document.getElementById('sample-boulevard').addEventListener('click', async () => {
    const img = await loadImage('samples/boulevard.jpg');
    state.photos.push(img); renderTray(); redraw();
  });
  document.getElementById('sample-pier').addEventListener('click', async () => {
    const img = await loadImage('samples/pier.jpg');
    state.photos.push(img); renderTray(); redraw();
  });
  document.getElementById('export').addEventListener('click', async () => {
    const { blob, name } = await exportCoverPNG(state, state.size);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setStatus(`Saved ${name} — ${blob.size.toLocaleString()} bytes.`);
  });
  document.getElementById('export-all').addEventListener('click', async () => {
    for (const s of EXPORT_SIZES) {
      const { blob, name } = await exportCoverPNG(state, s.id);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
    setStatus('Exported all four sizes.');
  });

  // Panel select + drag-to-pan + wheel-to-zoom on the preview canvas.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    // Pick the panel under the pointer by layout geometry.
    const { panels } = layoutGeometryFor(state.layout, canvas.width, canvas.height);
    const hit = panels.findIndex((p) => px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h);
    if (hit >= 0) {
      state.selected = hit;
      document.getElementById('panel-caption').value = state.panels[hit].caption;
      document.getElementById('panel-label').textContent = `Panel ${hit + 1}`;
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const panel = state.panels[state.selected];
    panel.dx += (e.clientX - lastX) / canvas.width;
    panel.dy += (e.clientY - lastY) / canvas.height;
    lastX = e.clientX; lastY = e.clientY;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selected];
    panel.zoom = Math.min(4, Math.max(0.5, panel.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    redraw();
  }, { passive: false });
}

// Lazy import keeps the module graph small at load time.
let layoutGeometryFor = null;

async function init() {
  ({ layoutGeometry: layoutGeometryFor } = await import('./layouts.js'));
  buildPickers();
  bindControls();
  syncControls();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, async ({ photo, caption, subtitle, layout, grade, size }) => {
      // Load both samples so panels alternate between two photos instead of
      // repeating one image across the whole cover.
      const other = photo === 'pier' ? 'boulevard' : 'pier';
      const [first, second] = await Promise.all([
        loadImage(`samples/${photo}.jpg`),
        loadImage(`samples/${other}.jpg`),
      ]);
      state.photos = [first, second];
      state.title = caption;
      state.subtitle = subtitle;
      state.layout = layoutById(layout).id;
      state.grade = gradeById(grade).id;
      state.size = size;
      syncControls();
      renderTray();
      redraw();
    });
    setStatus(`Scene ready — ${state.layout} layout, ${state.grade} grade.`);
    redraw(); // repaint once the vendored fonts are actually loaded
    if (shot === 'cover') {
      // Full-frame cover: draw at the viewport's own pixels so the shot is
      // crisp at its final size instead of an upscaled 960px preview.
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawCover(ctx, state, canvas.width, canvas.height);
    }
    return;
  }
  // No shot: preload both samples so the editor is demoable with zero uploads.
  const [a, b] = await Promise.all([
    loadImage('samples/boulevard.jpg'),
    loadImage('samples/pier.jpg'),
  ]);
  state.photos = [a, b];
  renderTray();
  redraw();
  setStatus('Ready — pick a layout, type a caption, export your cover.');
}

init();
