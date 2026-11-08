import { invoke } from "@tauri-apps/api/core";
import mammoth from "mammoth";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
} from "docx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TailoredResume } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
  const b64 = await invoke<string>("read_file_base64", { path });
  return base64ToBytes(b64);
}

export async function writeFileBytes(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  await invoke("write_file_base64", { path, dataBase64: bytesToBase64(bytes) });
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n");
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({
    arrayBuffer: bytes.slice().buffer,
  });
  return result.value;
}

export async function extractResumeText(
  filename: string,
  bytes: Uint8Array,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdf(bytes);
  if (lower.endsWith(".docx")) return extractDocx(bytes);
  if (lower.endsWith(".doc")) {
    throw new Error(
      "Формат .doc не поддерживается. Сохраните файл как .docx или PDF.",
    );
  }
  return new TextDecoder().decode(bytes);
}

function para(
  text: string,
  opts?: {
    heading?: IParagraphOptions["heading"];
    bold?: boolean;
    center?: boolean;
  },
): Paragraph {
  return new Paragraph({
    heading: opts?.heading,
    children: [new TextRun({ text, bold: opts?.bold ?? !!opts?.heading })],
  });
}

export async function buildResumeDocx(r: TailoredResume): Promise<Uint8Array> {
  // Export the same full text shown in the preview, including contact details.
  const children = r.markdown.split(/\r?\n/).map((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const text = (heading ? heading[2] : line).replace(/\*\*|__/g, "").replace(/^\s*[-*]\s+/, "• ");
    return para(text, heading ? { heading: heading[1].length === 1 ? HeadingLevel.TITLE : HeadingLevel.HEADING_1 } : undefined);
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
