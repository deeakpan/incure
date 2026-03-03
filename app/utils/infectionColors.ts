/**
 * Maps infection percentage (0-100) to RGBA color
 * 0%: very subtle dark green tint
 * 1-20%: soft yellow-orange glow
 * 21-50%: bright orange
 * 51-80%: deep red
 * 81-100%: pulsing crimson with glow
 */
export function getInfectionColor(pct: number): [number, number, number, number] {
  if (pct === 0) {
    return [3, 10, 7, 255]; // Healthy: very dark green
  }
  
  if (pct <= 20) {
    // Soft yellow-orange glow
    const factor = pct / 20;
    const r = Math.floor(120 + factor * 100);
    const g = Math.floor(80 + factor * 40);
    const a = Math.floor(40 + factor * 40);
    return [r, g, 0, a];
  }
  
  if (pct <= 50) {
    // Bright orange
    const factor = (pct - 20) / 30;
    const r = Math.floor(220 + factor * 35);
    const g = Math.floor(120 - factor * 20);
    const a = Math.floor(80 + factor * 40);
    return [r, g, 0, a];
  }
  
  if (pct <= 80) {
    // Deep red
    const factor = (pct - 50) / 30;
    const r = Math.floor(255);
    const g = Math.floor(100 - factor * 70);
    const a = Math.floor(120 + factor * 60);
    return [r, g, 0, a];
  }
  
  // 81-100%: Pulsing crimson
  const factor = (pct - 80) / 20;
  const r = Math.floor(255);
  const g = Math.floor(30 - factor * 20);
  const b = Math.floor(30 - factor * 20);
  const a = Math.floor(180 + factor * 75);
  return [r, g, b, a];
}
