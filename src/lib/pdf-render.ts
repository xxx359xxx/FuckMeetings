import { jsPDF } from "jspdf";
import type { TailoredResume } from "./types";

export type FontPair = { normal: string; bold: string };

const INK: [number, number, number] = [17, 24, 39];
const ACCENT: [number, number, number] = [37, 99, 235];
const RULE: [number, number, number] = [219, 225, 236];

/**
 * Pure PDF renderer: no Tauri/DOM access, so it can be unit-tested in Node.
 * Fonts arrive as base64 TrueType files (see `buildResumePdf` in pdf.ts).
 */
export function renderResumePdf(fonts: FontPair, resume: TailoredResume): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  doc.addFileToVFS("ResumeSans.ttf", fonts.normal);
  doc.addFont("ResumeSans.ttf", "ResumeSans", "normal");
  doc.addFileToVFS("ResumeSans-Bold.ttf", fonts.bold);
  doc.addFont("ResumeSans-Bold.ttf", "ResumeSans", "bold");

  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - margin * 2;
  let y = margin;

  const useFont = (size: number, bold: boolean) => {
    doc.setFont("ResumeSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };

  const useColor = (c: [number, number, number]) =>
    doc.setTextColor(c[0], c[1], c[2]);

  const paragraph = (
    text: string,
    size: number,
    bold = false,
    opts: {
      gapBefore?: number;
      color?: [number, number, number];
      indent?: number;
    } = {},
  ) => {
    const value = text.trim();
    if (!value) return;
    const indent = opts.indent ?? 0;
    const lineHeight = size * 1.4;
    if (opts.gapBefore) y += opts.gapBefore;
    useFont(size, bold);
    useColor(opts.color ?? INK);
    const lines = doc.splitTextToSize(value, width - indent) as string[];
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
  };

  const section = (title: string) => {
    y += 12;
    if (y + 40 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    useFont(10, true);
    useColor(ACCENT);
    doc.text(title.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);
    y += 13;
  };

  for (const line of resume.markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const text = (heading ? heading[2] : line).replace(/\*\*|__/g, "").replace(/^\s*[-*]\s+/, "• ");
    if (heading && heading[1].length > 1) section(text);
    else if (text.trim()) paragraph(text, heading ? 17 : 10.5, !!heading);
    else y += 4;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
