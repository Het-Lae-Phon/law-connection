import { formatThaiDate } from "@/lib/format";

export interface CitableEntry {
  title: string;
  publishedAt: Date | null;
  volume: number;
  issue: string;
  category: string;
  page: number;
  pdfUrl: string;
}

// Thai legal citation: ชื่อเต็ม, ราชกิจจานุเบกษา เล่ม X ตอนที่ Y ก หน้า Z (วันที่), URL
export function buildCitation(e: CitableEntry): string {
  const parts = [e.title];
  if (e.volume > 0) {
    let gaz = `ราชกิจจานุเบกษา เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category} หน้า ${e.page}`;
    if (e.publishedAt) gaz += ` (${formatThaiDate(e.publishedAt)})`;
    parts.push(gaz);
  } else if (e.publishedAt) {
    parts.push(formatThaiDate(e.publishedAt));
  }
  if (e.pdfUrl.startsWith("http")) parts.push(e.pdfUrl);
  return parts.join(", ");
}

export interface OriginalSource {
  label: string; // where the link goes, named for the user
  url: string;
}

// The authoritative destination for an entry, when a working public link exists.
export function originalSource(e: { pdfUrl: string; origin: string }): OriginalSource | null {
  if (!e.pdfUrl.startsWith("http")) return null;
  try {
    const host = new URL(e.pdfUrl).hostname;
    if (host.includes("ratchakitcha")) return { label: "ราชกิจจานุเบกษา", url: e.pdfUrl };
    if (host.includes("pdpc")) return { label: "เว็บไซต์ สคส.", url: e.pdfUrl };
    return { label: "เอกสารต้นทาง", url: e.pdfUrl };
  } catch {
    return null;
  }
}
