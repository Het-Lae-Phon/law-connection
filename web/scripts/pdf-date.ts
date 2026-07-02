/**
 * Extract the promulgation date ("ประกาศ ณ วันที่ ...", "ให้ไว้ ณ วันที่ ...",
 * "สั่ง ณ วันที่ ...") from a Thai legal PDF, falling back to Vision OCR
 * (scripts/ocr) when the embedded text is garbled. Shared by regulator importers.
 */
import { PDFParse } from "pdf-parse";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileP = promisify(execFile);
const PDF_DIR = path.join(__dirname, "..", "..", "data", "pdfs");
const OCR_BIN = path.join(__dirname, "ocr");
const MAX_PAGES = 8;

const THAI_MONTHS: Record<string, number> = {
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
};

const DATE_RE = new RegExp(
  "(?:ประกาศ|ให้ไว้|สั่ง|ระเบียบ)\\s*ณ\\s*วันที่\\s*([0-9]{1,2})\\s*" +
    `(${Object.keys(THAI_MONTHS).join("|")})\\s*(?:พ\\.ศ\\.\\s*)?([0-9]{4})`
);

function normalize(s: string): string {
  return s
    .replace(/ํา/g, "ำ")
    .replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)))
    .replace(/\s+/g, " ");
}

function thaiRatio(s: string): number {
  const clean = s.replace(/\s+/g, "");
  if (!clean) return 0;
  return (clean.match(/[ก-๛]/g) ?? []).length / clean.length;
}

function parseDate(text: string): Date | null {
  const m = normalize(text).match(DATE_RE);
  if (!m) return null;
  let year = parseInt(m[3], 10);
  if (year > 2400) year -= 543;
  const d = new Date(Date.UTC(year, THAI_MONTHS[m[2]] - 1, parseInt(m[1], 10)));
  return isNaN(d.getTime()) ? null : d;
}

export async function extractPdfDate(pdfUrl: string): Promise<Date | null> {
  if (!/\.pdf$/i.test(pdfUrl)) return null;
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const cached = path.join(PDF_DIR, pdfUrl.split("/").slice(-1)[0].replace(/[^\w.]/g, "_"));
  let buf: Buffer;
  if (fs.existsSync(cached)) {
    buf = fs.readFileSync(cached);
  } else {
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(cached, buf);
  }

  let text = "";
  try {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const res = await parser.getText({ first: MAX_PAGES });
    text = res.text ?? "";
    await parser.destroy();
  } catch {
    text = "";
  }
  if (thaiRatio(text) >= 0.5) {
    const d = parseDate(text);
    if (d) return d;
  }
  // garbled or date not in embedded text — OCR
  try {
    const { stdout } = await execFileP(OCR_BIN, [cached, String(MAX_PAGES)], {
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return parseDate(stdout);
  } catch {
    return null;
  }
}
