import "server-only";
import { normalizeColor, deriveSecondary } from "./color";

export type ExtractedBranding = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function toAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const { signal, cancel } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TendorraBrandBot/1.0)" },
    });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes > MAX_HTML_BYTES) break;
    }
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    cancel();
  }
}

function extractIconHref(html: string): string | null {
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const candidates: { rel: string; href: string }[] = [];

  for (const tag of linkTags) {
    const relMatch = tag.match(/\brel=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    candidates.push({ rel: relMatch[1]!.toLowerCase(), href: hrefMatch[1]! });
  }

  // Prefer higher-resolution icons over a plain favicon.
  const priority = ["apple-touch-icon", "icon", "shortcut icon", "mask-icon"];
  for (const rel of priority) {
    const match = candidates.find((c) => c.rel.includes(rel));
    if (match) return match.href;
  }

  const ogImage = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImage) return ogImage[1]!;

  return null;
}

function extractThemeColor(html: string): string | null {
  const match = html.match(/<meta\b[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i);
  return match ? normalizeColor(match[1]!) : null;
}

async function averageColorOfImage(imageUrl: string): Promise<string | null> {
  try {
    const { signal, cancel } = withTimeout(FETCH_TIMEOUT_MS);
    const res = await fetch(imageUrl, { signal, headers: { "User-Agent": "Mozilla/5.0" } });
    cancel();
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    const { Jimp } = await import("jimp");
    const image = await Jimp.read(buffer);
    // Downscale to 1x1: a cheap way to get an average color without a full
    // histogram/clustering pass.
    image.resize({ w: 1, h: 1 });
    const { r, g, b } = intToRgb(image.getPixelColor(0, 0));
    return normalizeColor(`rgb(${r}, ${g}, ${b})`);
  } catch {
    return null;
  }
}

function intToRgb(value: number): { r: number; g: number; b: number } {
  return {
    r: (value >>> 24) & 0xff,
    g: (value >>> 16) & 0xff,
    b: (value >>> 8) & 0xff,
  };
}

function googleFaviconFallback(siteUrl: string): string {
  const host = new URL(siteUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

// Best-effort branding extraction: never throws. A website that can't be
// reached or parsed just yields nulls, and the caller falls back to
// defaults rather than blocking signup.
export async function extractBranding(websiteInput: string): Promise<ExtractedBranding> {
  const siteUrl = websiteInput.match(/^https?:\/\//i) ? websiteInput : `https://${websiteInput}`;

  let normalizedSiteUrl: string;
  try {
    normalizedSiteUrl = new URL(siteUrl).toString();
  } catch {
    return { logoUrl: null, primaryColor: null, secondaryColor: null };
  }

  const fetched = await fetchHtml(normalizedSiteUrl);
  const html = fetched?.html ?? "";
  const baseUrl = fetched?.finalUrl ?? normalizedSiteUrl;

  const iconHref = html ? extractIconHref(html) : null;
  const logoUrl = (iconHref && toAbsoluteUrl(iconHref, baseUrl)) || googleFaviconFallback(normalizedSiteUrl);

  let primaryColor = html ? extractThemeColor(html) : null;
  if (!primaryColor && logoUrl) {
    primaryColor = await averageColorOfImage(logoUrl);
  }

  const secondaryColor = primaryColor ? deriveSecondary(primaryColor) : null;

  return { logoUrl, primaryColor, secondaryColor };
}
