// Fixed scenes for deterministic screenshots: ?shot=cover shows the exported
// cover alone (full-frame, as the app's own canvas draws it); ?shot=editor
// shows the editor with a sample photo loaded. Query params pick the sample
// photo, layout, grade, caption and export size. window.__shotReady is set
// once the scene has painted, so a headless driver can wait on it.
export async function runShot(shot, query, load) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Neon Shore';
  const subtitle = query.get('subtitle') ?? 'Vice City nights';
  const layout = query.get('layout') ?? 'nine';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? 'wide';
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await load({ photo, caption, subtitle, layout, grade, size });
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
