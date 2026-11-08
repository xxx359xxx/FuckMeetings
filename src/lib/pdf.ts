import { bytesToBase64, readFileBytes } from "./resume";
import { renderResumePdf, type FontPair } from "./pdf-render";
import type { TailoredResume } from "./types";

/**
 * Cyrillic-capable TrueType fonts taken from the OS at runtime. Bundling a
 * font would bloat the repo and most licenses forbid redistribution, while
 * every Windows/macOS install already ships Arial.
 */
const NORMAL_FONTS = [
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\segoeui.ttf",
  "C:\\Windows\\Fonts\\calibri.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Verdana.ttf",
];

const BOLD_FONTS = [
  "C:\\Windows\\Fonts\\arialbd.ttf",
  "C:\\Windows\\Fonts\\segoeuib.ttf",
  "C:\\Windows\\Fonts\\calibrib.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Verdana Bold.ttf",
];

let cachedFonts: FontPair | null = null;

async function firstReadable(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      const bytes = await readFileBytes(path);
      if (bytes.length > 1000) return bytesToBase64(bytes);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

async function loadFonts(): Promise<FontPair> {
  if (cachedFonts) return cachedFonts;
  const normal = await firstReadable(NORMAL_FONTS);
  if (!normal) {
    throw new Error(
      "Не найден системный шрифт с кириллицей для PDF. Используйте экспорт в DOCX.",
    );
  }
  const bold = (await firstReadable(BOLD_FONTS)) ?? normal;
  cachedFonts = { normal, bold };
  return cachedFonts;
}

/** Builds an A4 PDF with real text (selectable, ATS-parsable) from the resume. */
export async function buildResumePdf(resume: TailoredResume): Promise<Uint8Array> {
  return renderResumePdf(await loadFonts(), resume);
}
