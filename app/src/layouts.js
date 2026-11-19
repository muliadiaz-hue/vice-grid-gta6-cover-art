// The six layout geometries of Vice Grid. Every layout is a pure function of
// the canvas size: it returns { panels, title, kind } where panels is a list of
// { x, y, w, h, photo, rotate, frame } rects (coordinates in canvas pixels),
// title is the rect the title block occupies (or null when the title floats),
// and kind names the family so drawCover can add layout-specific dressing
// (polaroid frames, the diagonal band, the film strip).

export const LAYOUTS = [
  { id: 'nine', name: 'Nine-Panel Classic' },
  { id: 'hero', name: 'Hero + Three' },
  { id: 'bleed', name: 'Full-Bleed Hero' },
  { id: 'tilted', name: 'Tilted Snapshots' },
  { id: 'diptych', name: 'Diptych Split' },
  { id: 'strip', name: 'Strip Comic' },
];

const GAP = 10;

function inset(rect, pad) {
  return { x: rect.x + pad, y: rect.y + pad, w: rect.w - pad * 2, h: rect.h - pad * 2 };
}

function grid3x3(w, h, gap) {
  const cw = (w - gap * 4) / 3;
  const ch = (h - gap * 4) / 3;
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
    }
  }
  return cells;
}

export function layoutGeometry(layoutId, w, h) {
  switch (layoutId) {
    case 'nine': {
      const cells = grid3x3(w, h, GAP);
      const title = cells[4];
      const panels = cells.filter((_, i) => i !== 4).map((r, i) => ({ ...r, photo: i, rotate: 0, frame: 'ink' }));
      return { panels, title, kind: 'nine' };
    }
    case 'hero': {
      // Asymmetric split: hero 62% on the left, three stacked panels on the
      // right 38%, separated by a diagonal divider the renderer draws.
      const split = w * 0.62;
      const hero = { x: GAP, y: GAP, w: split - GAP * 1.5, h: h - GAP * 2, photo: 0, rotate: 0, frame: 'ink' };
      const stackW = w - split - GAP * 1.5;
      const sh = (h - GAP * 4) / 3;
      const stack = [0, 1, 2].map((i) => ({
        x: split + GAP * 0.5, y: GAP + i * (sh + GAP), w: stackW, h: sh,
        photo: i + 1, rotate: 0, frame: 'ink',
      }));
      const title = { x: GAP, y: h - GAP - h * 0.20, w: split - GAP * 1.5, h: h * 0.20 };
      return { panels: [hero, ...stack], title, kind: 'hero' };
    }
    case 'bleed': {
      const stripH = h * 0.16;
      const sw = (w - GAP * 4) / 3;
      const minis = [0, 1, 2].map((i) => ({
        x: GAP + i * (sw + GAP), y: GAP, w: sw, h: stripH - GAP,
        photo: i + 1, rotate: 0, frame: 'ink',
      }));
      const hero = { x: GAP, y: stripH, w: w - GAP * 2, h: h - stripH - GAP * 2, photo: 0, rotate: 0, frame: 'none' };
      const title = { x: GAP, y: h - GAP - h * 0.18, w: w - GAP * 2, h: h * 0.18 };
      return { panels: [hero, ...minis], title, kind: 'bleed' };
    }
    case 'tilted': {
      // Polaroid cards scattered over a painted sky: two large, two small,
      // each with its own tilt. The title rides in the clear top band.
      const cards = [
        { x: w * 0.06, y: h * 0.24, w: w * 0.44, h: h * 0.44, photo: 0, rotate: -0.07, frame: 'polaroid' },
        { x: w * 0.52, y: h * 0.20, w: w * 0.42, h: h * 0.38, photo: 1, rotate: 0.05, frame: 'polaroid' },
        { x: w * 0.10, y: h * 0.68, w: w * 0.36, h: h * 0.26, photo: 2, rotate: 0.04, frame: 'polaroid' },
        { x: w * 0.56, y: h * 0.62, w: w * 0.36, h: h * 0.30, photo: 3, rotate: -0.05, frame: 'polaroid' },
      ];
      const title = { x: w * 0.05, y: h * 0.03, w: w * 0.9, h: h * 0.16 };
      return { panels: cards, title, kind: 'tilted' };
    }
    case 'diptych': {
      // Two tall panels split by a diagonal neon band carrying the caption.
      const mid = w / 2;
      const left = { x: GAP, y: GAP, w: mid - GAP * 1.5, h: h - GAP * 2, photo: 0, rotate: 0, frame: 'ink' };
      const right = { x: mid + GAP * 0.5, y: GAP, w: w - mid - GAP * 1.5, h: h - GAP * 2, photo: 1, rotate: 0, frame: 'ink' };
      const title = { x: w * 0.12, y: h * 0.42, w: w * 0.76, h: h * 0.16 };
      return { panels: [left, right], title, kind: 'diptych' };
    }
    case 'strip':
    default: {
      // Four horizontal bands, each a scene; the caption sits in a burst
      // badge overlapping the second band.
      const bh = (h - GAP * 5) / 4;
      const bands = [0, 1, 2, 3].map((i) => ({
        x: GAP, y: GAP + i * (bh + GAP), w: w - GAP * 2, h: bh,
        photo: i, rotate: 0, frame: 'ink',
      }));
      const title = { x: w * 0.55, y: GAP + bh * 0.6, w: w * 0.38, h: bh * 0.9 };
      return { panels: bands, title, kind: 'strip' };
    }
  }
}

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export { inset };
