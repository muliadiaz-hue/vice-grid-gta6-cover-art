// Per-panel photo state: which photo a panel shows, its zoom and pan, and
// its optional mini-caption. Plus a small undo/redo history over the whole
// editor state, so every change can be stepped back and forward.

export function defaultPanels() {
  return Array.from({ length: 8 }, (_, i) => ({
    photo: i % 2,
    zoom: 1,
    dx: 0,
    dy: 0,
    caption: '',
  }));
}

// Cover-fit draw of one photo into a rect, honouring zoom (1 = fit) and
// pan offsets expressed as fractions of the rect size.
export function drawPhotoCover(ctx, img, rect, panel) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel?.zoom ?? 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = rect.x + rect.w / 2 + (panel?.dx ?? 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (panel?.dy ?? 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

// Draws a photo when none is loaded yet: a painted placeholder so the cover
// still reads as a cover (gradient sky + sun disc + palm silhouette).
export function drawPlaceholder(ctx, rect, grade, seed) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.6, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.18;
  ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w * 0.5, rect.y + rect.h * 0.42, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Palm silhouette, drawn from a seeded wobble so every panel differs.
  ctx.strokeStyle = 'rgba(20, 8, 30, 0.85)';
  ctx.lineWidth = Math.max(2, rect.w * 0.012);
  ctx.lineCap = 'round';
  const bx = rect.x + rect.w * (0.2 + (seed % 5) * 0.12);
  const by = rect.y + rect.h;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + rect.w * 0.04, by - rect.h * 0.45, bx + rect.w * 0.12, by - rect.h * 0.55);
  ctx.stroke();
  for (let f = 0; f < 5; f++) {
    const a = -Math.PI * (0.15 + f * 0.16);
    const tx = bx + rect.w * 0.12 + Math.cos(a) * rect.w * 0.22;
    const ty = by - rect.h * 0.55 + Math.sin(a) * rect.h * 0.16;
    ctx.beginPath();
    ctx.moveTo(bx + rect.w * 0.12, by - rect.h * 0.55);
    ctx.quadraticCurveTo(
      bx + rect.w * 0.12 + Math.cos(a) * rect.w * 0.12,
      by - rect.h * 0.55 + Math.sin(a) * rect.h * 0.08 - rect.h * 0.06,
      tx, ty,
    );
    ctx.stroke();
  }
}

// A bounded undo/redo stack over JSON snapshots of the editor state.
export class History {
  constructor(limit = 60) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  push(snapshot) {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(current) {
    if (!this.past.length) return null;
    this.future.push(current);
    return this.past.pop();
  }

  redo(current) {
    if (!this.future.length) return null;
    this.past.push(current);
    return this.future.pop();
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
