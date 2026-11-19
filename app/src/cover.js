// drawCover: the single code path that paints every Vice Grid cover, at any
// size. The live preview and the full-resolution export both call it, so what
// you see is what exports. Everything is deterministic: the grain comes from
// a seeded PRNG with a fixed seed, so two runs paint byte-identical pixels.

import { gradeById, paintGradeWash, gradeFilter } from './grades.js';
import { layoutGeometry } from './layouts.js';
import { drawPhotoCover, drawPlaceholder } from './panels.js';

const GRAIN_SEED = 20261119;

// mulberry32 — tiny seeded PRNG, fixed seed, no Math.random anywhere here.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainCache = null;
function grainPattern(ctx, size) {
  if (grainCache && grainCache.size === size) return grainCache.pattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(size, size);
  const rand = mulberry32(GRAIN_SEED);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  grainCache = { size, pattern };
  return pattern;
}

function applyGrain(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx, 128);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function applyVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,24,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

// Outlined block letters: Anton, white-to-gold gradient fill, thick dark
// outline, hard offset shadow. The title never carries a "GTA" wordmark.
function drawTitleBlock(ctx, rect, title, subtitle, grade) {
  const text = (title || 'VICE GRID').trim().toUpperCase().slice(0, 40);
  ctx.save();
  // Sun disc behind the title when there is room for one.
  const discR = Math.min(rect.w, rect.h) * 0.30;
  if (discR > 14) {
    const disc = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    disc.addColorStop(0, '#ffe9a8');
    disc.addColorStop(1, '#ff5e8a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.30, discR, 0, Math.PI * 2);
    ctx.fill();
  }
  const size = fitFont(ctx, text, rect.w * 0.92, rect.h * 0.34, 'Anton, sans-serif');
  const cx = rect.x + rect.w / 2;
  const ty = rect.y + rect.h * 0.62;
  const fill = ctx.createLinearGradient(cx - rect.w / 2, ty - size, cx + rect.w / 2, ty);
  fill.addColorStop(0, '#ff2e88');
  fill.addColorStop(0.5, '#ff8a3d');
  fill.addColorStop(1, '#ffd34d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(20, 4, 40, 0.9)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = Math.max(2, size * 0.05);
  ctx.shadowOffsetY = Math.max(3, size * 0.07);
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.strokeStyle = '#160a2e';
  ctx.lineWidth = Math.max(3, size * 0.14);
  ctx.strokeText(text, cx, ty);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, ty);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  const sub = (subtitle || 'Vice City nights').trim().slice(0, 60);
  if (sub) {
    const subSize = fitFont(ctx, sub, rect.w * 0.85, Math.max(12, rect.h * 0.13), 'Pacifico, cursive');
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#fff3f8';
    ctx.fillText(sub, cx, ty + size * 0.62 + subSize * 0.4);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawPanelCaption(ctx, rect, caption) {
  const text = (caption || '').trim().slice(0, 28);
  if (!text) return;
  ctx.save();
  const size = Math.max(11, Math.min(22, rect.h * 0.085));
  ctx.font = `bold ${size}px Anton, sans-serif`;
  const pad = size * 0.45;
  const tw = ctx.measureText(text.toUpperCase()).width;
  const bx = rect.x + rect.w * 0.04;
  const by = rect.y + rect.h - size * 1.9;
  ctx.fillStyle = 'rgba(10, 4, 24, 0.78)';
  ctx.fillRect(bx - pad * 0.5, by - pad * 0.4, tw + pad, size + pad * 0.9);
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), bx, by + size * 0.55);
  ctx.restore();
}

function drawPolaroidFrame(ctx, rect, rotate) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(rotate);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = rect.w * 0.05;
  ctx.shadowOffsetY = rect.w * 0.02;
  ctx.fillStyle = '#fdf8ef';
  ctx.fillRect(-rect.w * 0.04, -rect.h * 0.04, rect.w * 1.08, rect.h * 1.14);
  ctx.shadowColor = 'transparent';
  // Washi tape on the top corners.
  ctx.fillStyle = 'rgba(255, 214, 90, 0.75)';
  ctx.fillRect(rect.w * 0.08, -rect.h * 0.07, rect.w * 0.22, rect.h * 0.06);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
  ctx.fillRect(rect.w * 0.70, -rect.h * 0.07, rect.w * 0.22, rect.h * 0.06);
  ctx.restore();
}

// The diagonal neon band of the Diptych layout, carrying the caption.
function drawDiagonalBand(ctx, w, h, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h * 0.56);
  ctx.lineTo(w, h * 0.42);
  ctx.lineTo(w, h * 0.50);
  ctx.lineTo(0, h * 0.64);
  ctx.closePath();
  const band = ctx.createLinearGradient(0, 0, w, 0);
  band.addColorStop(0, grade.sky[0]);
  band.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = band;
  ctx.fill();
  ctx.strokeStyle = '#160a2e';
  ctx.lineWidth = Math.max(2, h * 0.004);
  ctx.stroke();
  ctx.restore();
}

/** Paints the whole cover onto `ctx` at size w x h from editor `state`. */
export function drawCover(ctx, state, w, h) {
  const grade = gradeById(state.grade);
  const { panels, title, kind } = layoutGeometry(state.layout, w, h);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // Base sky so tilted layouts (cards over open sky) have a world to sit in.
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, grade.sky[0]);
  base.addColorStop(0.55, grade.sky[1]);
  base.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    const slot = state.panels?.[p.photo] ?? { photo: p.photo % 2, zoom: 1, dx: 0, dy: 0, caption: '' };
    const img = state.photos?.[slot.photo] ?? null;
    if (p.frame === 'polaroid') drawPolaroidFrame(ctx, p, p.rotate);
    const inner = p.frame === 'polaroid'
      ? { x: p.x, y: p.y, w: p.w, h: p.h * 0.86 }
      : { x: p.x, y: p.y, w: p.w, h: p.h };
    ctx.save();
    if (p.rotate && p.frame !== 'polaroid') {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rotate);
      ctx.translate(-p.w / 2, -p.h / 2);
    }
    if (img) {
      ctx.filter = gradeFilter(grade);
      drawPhotoCover(ctx, img, inner, slot);
      ctx.filter = 'none';
    } else {
      drawPlaceholder(ctx, inner, grade, i + 1);
    }
    paintGradeWash(ctx, grade, inner.x, inner.y, inner.w, inner.h);
    if (p.frame === 'ink') {
      ctx.strokeStyle = '#160a2e';
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
      ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    }
    drawPanelCaption(ctx, inner, slot.caption);
    ctx.restore();
  }

  if (kind === 'diptych') drawDiagonalBand(ctx, w, h, grade);
  if (kind === 'hero') {
    // Diagonal divider between hero and stack.
    ctx.save();
    ctx.strokeStyle = grade.sky[2];
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(w * 0.62 + 4, 0);
    ctx.lineTo(w * 0.62 - 14, h);
    ctx.stroke();
    ctx.restore();
  }
  if (kind === 'strip') {
    // Burst badge behind the title.
    ctx.save();
    ctx.translate(title.x + title.w / 2, title.y + title.h / 2);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    const spikes = 12;
    for (let s = 0; s < spikes * 2; s++) {
      const a = (s / (spikes * 2)) * Math.PI * 2;
      const r = s % 2 === 0 ? title.w * 0.62 : title.w * 0.48;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.55;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#160a2e';
    ctx.lineWidth = Math.max(2, title.w * 0.008);
    ctx.stroke();
    ctx.restore();
  }

  if (title) drawTitleBlock(ctx, title, state.title, state.subtitle, grade);
  applyVignette(ctx, w, h);
  applyGrain(ctx, w, h);
  ctx.restore();
}

export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080×1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080×1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920×1080', w: 1920, h: 1080 },
  { id: 'story', label: 'Story 1080×1920', w: 1080, h: 1920 },
];

export function exportCoverPNG(state, sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) ?? EXPORT_SIZES[0];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), state, size.w, size.h);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ blob, name: `vice-grid-${size.w}x${size.h}.png` }), 'image/png');
  });
}
