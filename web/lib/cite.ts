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
    let gaz = `ราชกิจจานุเบกษา เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category}`;
    if (e.page > 0) gaz += ` หน้า ${e.page}`; // some older citations omit the page
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
// pdfUrl is the ingest-time link; sourceUrl is a later-attached official link
// (e.g. resolved through the Royal Gazette Web Service).
export function originalSource(e: {
  pdfUrl: string;
  sourceUrl?: string | null;
  origin: string;
}): OriginalSource | null {
  const url = e.pdfUrl.startsWith("http")
    ? e.pdfUrl
    : e.sourceUrl?.startsWith("http")
      ? e.sourceUrl
      : null;
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (host.includes("ratchakitcha") || host.includes("soc.go.th"))
      return { label: "ราชกิจจานุเบกษา", url };
    if (host.includes("pdpc")) return { label: "เว็บไซต์ สคส.", url };
    if (host.endsWith("ocs.go.th")) return { label: "ระบบค้นหากฎหมาย สคก.", url };
    if (host.endsWith("fourcorners.law")) return { label: "FourCorners", url };
    return { label: "เอกสารต้นทาง", url };
  } catch {
    return null;
  }
}
