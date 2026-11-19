// The five colour grades of Vice Grid. Each grade is a pure description:
// a sky wash (top -> bottom gradient stops), a shadow tint, a highlight tint,
// a contrast lift and an optional accent colour used by the Mono Ink look.
// drawCover applies them with canvas compositing only, so the same code path
// renders the preview and the full-resolution export.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice Sunset',
    sky: ['#ff5e8a', '#ff8a3d', '#ffc44d'],
    shadow: 'rgba(20, 8, 60, 0.38)',
    highlight: 'rgba(255, 190, 90, 0.20)',
    contrast: 1.06,
    saturation: 1.12,
  },
  {
    id: 'neon',
    name: 'Neon Night',
    sky: ['#2a0a5e', '#b3127f', '#00e5ff'],
    shadow: 'rgba(8, 4, 48, 0.55)',
    highlight: 'rgba(0, 229, 255, 0.16)',
    contrast: 1.18,
    saturation: 1.28,
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    sky: ['#ffb347', '#ff8c42', '#ffe9a8'],
    shadow: 'rgba(90, 40, 0, 0.28)',
    highlight: 'rgba(255, 230, 150, 0.28)',
    contrast: 1.03,
    saturation: 1.08,
  },
  {
    id: 'dusk',
    name: 'Teal Dusk',
    sky: ['#0f766e', '#7c3aed', '#ec4899'],
    shadow: 'rgba(4, 40, 44, 0.50)',
    highlight: 'rgba(236, 72, 153, 0.16)',
    contrast: 1.10,
    saturation: 1.20,
  },
  {
    id: 'ink',
    name: 'Mono Ink',
    sky: ['#111111', '#555555', '#eeeeee'],
    shadow: 'rgba(0, 0, 0, 0.45)',
    highlight: 'rgba(255, 255, 255, 0.10)',
    contrast: 1.35,
    saturation: 0,
    accent: '#ff2e88',
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

// Paints the grade's sky wash + shadow/highlight tints over the whole canvas
// region (x, y, w, h). Call after the photos are drawn, before lettering.
export function paintGradeWash(ctx, grade, x, y, w, h) {
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const shade = ctx.createLinearGradient(x, y, x, y + h);
  shade.addColorStop(0, grade.highlight);
  shade.addColorStop(1, grade.shadow);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Returns the CSS filter string the grade implies for a photo draw.
// Mono Ink desaturates; the others nudge contrast/saturation only.
export function gradeFilter(grade) {
  if (grade.saturation === 0) return `grayscale(1) contrast(${grade.contrast})`;
  return `contrast(${grade.contrast}) saturate(${grade.saturation})`;
}
