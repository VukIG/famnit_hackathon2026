// Converts a bearing in degrees to a 16-point compass label.
export function compassLabel(degrees) {
  if (degrees === null || degrees === undefined) return '—';
  const points = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(degrees / 22.5) % 16;
  return points[idx];
}
