// Small dependency-free color helpers for turning one extracted "brand
// color" into a usable pair (a primary, and a readable foreground for text
// placed on top of it) plus a slightly adjusted secondary/accent shade.

export function normalizeColor(value: string): string | null {
  const hex = value.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const raw = hex[1]!;
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return `#${full.toLowerCase()}`;
  }
  const rgb = value.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Number(n));
    return rgbToHex(r!, g!, b!);
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeColor(hex) ?? "#000000";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return [r, g, b];
}

// Relative luminance (WCAG) to decide whether black or white text reads
// better on a given background color.
export function readableForegroundFor(hex: string): "#ffffff" | "#0a0a0a" {
  const [r, g, b] = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * rl! + 0.7152 * gl! + 0.0722 * bl!;
  return luminance > 0.5 ? "#0a0a0a" : "#ffffff";
}

function adjustLightness(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) =>
    amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
  return rgbToHex(mix(r), mix(g), mix(b));
}

// A secondary shade for hover states / subtle accents: darken a light color,
// lighten a dark one, so it stays visibly related but distinct.
export function deriveSecondary(primaryHex: string): string {
  const isLight = readableForegroundFor(primaryHex) === "#0a0a0a";
  return adjustLightness(primaryHex, isLight ? -0.18 : 0.22);
}
