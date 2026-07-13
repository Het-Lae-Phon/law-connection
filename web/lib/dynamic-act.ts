/**
 * Dynamic SDK bridge — the structured reader for EVERY act, not just the
 * thai-law-curated ones: acts whose primary entry carries a DocumentText get
 * their text machine-parsed into @thai-law/core SectionRecord shape at
 * request time, so the same reader (มาตรา/วรรค anchors, provenance chips)
 * works across the whole registry. Records are marked "machine_parsed" —
 * unreviewed, clearly labelled — versus the curated bundles' richer data
 * (amendment versions, definitions, point-in-time).
 *
 * Parsing reuses lib/typeset.ts (the gazette-facsimile block splitter): its
 * para/heading/sign/note blocks map cleanly onto sections, วรรค, structure
 * headings and the document tail.
 */
import { prisma } from "@/lib/db";
import { typesetLegalText } from "@/lib/typeset";
import { buildCitation, originalSource } from "@/lib/cite";
import type { SectionRecord, StructuralNode, ResolvedSection } from "@/vendor/thai-law-core/src/types";
import { resolveSection } from "@/vendor/thai-law-core/src/resolve";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const arabic = (s: string) => s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));

// "มาตรา ๓", "มาตรา ๒๒/๑" and the ordinal series "มาตรา ๓ ทวิ/ตรี/..."
const SECTION_START =
  /^มาตรา\s*([๐-๙0-9]+(?:\/[๐-๙0-9]+)?)(?:\s+(ทวิ|ตรี|จัตวา|เบญจ|สัตต|อัฏฐ|นว|ทศ|เอกาทศ|ทวาทศ|เตรส|จตุทศ|ปัณรส|โสฬส|สัตตรส|อัฏฐารส))?(?=\s|$)/;
const HEADING_KIND: [RegExp, StructuralNode["kind"]][] = [
  [/^บทเฉพาะกาล/, "transitional"],
  [/^(ภาค|ลักษณะ|หมวด|บรรพ)\s*[๐-๙0-9]/, "chapter"],
  [/^ส่วนที่\s*[๐-๙0-9]/, "part"],
];

// numbered/lettered subitems — "(๑) ...", "(ก) ..." — are part of the SAME
// วรรค they follow (อนุมาตรา), never a new วรรค of their own
const ITEM_RE = /^\(\s*([๐-๙0-9]+(?:\/[๐-๙0-9]+)?|[ก-ฮ])\s*\)\s*/;

export interface DynamicAct {
  entryId: number;
  title: string;
  status: string; // our Act.status: active | repealed
  citation: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  preambleLines: string[];
  tailLines: string[];
  noteLines: string[];
  structure: StructuralNode[];
  sections: ResolvedSection[];
  byId: Map<string, SectionRecord>;
}

/** Parse a plain-text act into SDK-shaped records. Returns null when the text
 *  doesn't look like sectioned legislation (fewer than 3 มาตรา).
 *
 *  A code's copy often contains TWO instruments back-to-back (พ.ร.บ.ให้ใช้ฯ
 *  มาตรา ๑–๖, then the code itself restarting at มาตรา ๑), so blocks are first
 *  split into instrument segments wherever the section numbering restarts at
 *  ๑; the segment with the most sections becomes the anchored body and the
 *  others flatten into front/back matter. */
export function parseDynamicSections(
  text: string,
  opts: { actId: number; validFrom: string; citation: string; lineLevel?: boolean },
): Pick<DynamicAct, "preambleLines" | "tailLines" | "noteLines" | "structure" | "sections" | "byId"> | null {
  const blocks = typesetLegalText(text);

  type B = (typeof blocks)[number] & { joined: string; secNo: string | null };
  const prepared: B[] = blocks
    .map((b) => {
      const joined = b.kind === "para" ? b.lines.join(" ").trim() : b.lines.join("\n").trim();
      const m = b.kind === "para" ? joined.match(SECTION_START) : null;
      const secNo = m ? arabic(m[1]) + (m[2] ? ` ${m[2]}` : "") : null;
      return { ...b, joined, secNo };
    })
    .filter((b) => b.joined);

  // segment boundaries: numbering restarts at ๑ after ≥2 sections
  const segments: B[][] = [[]];
  let sectionsInSegment = 0;
  for (const b of prepared) {
    if (b.secNo && /^1(\s|$)/.test(b.secNo) && sectionsInSegment >= 2) {
      segments.push([]);
      sectionsInSegment = 0;
    }
    if (b.secNo) sectionsInSegment++;
    segments[segments.length - 1].push(b);
  }
  const countSecs = (seg: B[]) => seg.filter((b) => b.secNo).length;
  const mainIdx = segments.reduce((best, seg, i) => (countSecs(seg) > countSecs(segments[best]) ? i : best), 0);

  const preambleLines: string[] = [];
  const tailLines: string[] = [];
  const noteLines: string[] = [];
  const structure: StructuralNode[] = [];
  const records: SectionRecord[] = [];
  const seenNumbers = new Set<string>();

  let current: SectionRecord | null = null;
  let headingHost: StructuralNode | null = null; // open chapter/part node

  // route a chunk of text into the current section: (๑)/(ก) chunks become
  // items/subitems of the last วรรค (อนุมาตรา are NOT วรรค); anything else
  // starts a new วรรค
  const appendChunk = (rec: SectionRecord, chunk: string) => {
    const paras = rec.versions[0].paragraphs;
    const m = chunk.match(ITEM_RE);
    if (m && paras.length > 0) {
      const last = paras[paras.length - 1];
      const items = (last.items ??= []);
      const body = chunk.slice(m[0].length).trim();
      if (/^[ก-ฮ]$/.test(m[1]) && items.length > 0) {
        const li = items[items.length - 1];
        (li.subitems ??= []).push({ id: m[1], num_th: `(${m[1]})`, text_th: body });
      } else {
        items.push({ id: arabic(m[1]), num_th: `(${m[1]})`, text_th: body, subitems: [] });
      }
    } else {
      paras.push({ id: `p${paras.length + 1}`, text_th: chunk });
    }
  };
  // OCS copies put each real block element on its own line, so lines can be
  // split into วรรค/items safely; Krisdika texts hard-wrap mid-sentence, so
  // there only whole blank-line blocks are split (handled by the caller)
  const appendBlock = (rec: SectionRecord, b: { joined: string; lines: string[] }) => {
    if (opts.lineLevel) {
      for (const line of b.lines) {
        const t = line.replace(/\s+/g, " ").trim();
        if (t) appendChunk(rec, t);
      }
    } else {
      appendChunk(rec, b.joined);
    }
  };

  const pushRef = (rec: SectionRecord) => {
    const ref: StructuralNode = { id: `${rec.id}#ref`, kind: "section_ref", section: rec.id };
    (headingHost ? (headingHost.children ??= []) : structure).push(ref);
  };

  segments.forEach((seg, segIdx) => {
    const isMain = segIdx === mainIdx;
    for (const b of seg) {
      if (b.kind === "note") {
        noteLines.push(...b.lines);
        continue;
      }
      // non-main instruments read as front/back matter around the body
      if (!isMain) {
        (segIdx < mainIdx ? preambleLines : tailLines).push(
          ...(b.kind === "para" ? [b.joined] : b.lines),
        );
        continue;
      }
      if (b.kind === "sign") {
        tailLines.push(...b.lines);
        continue;
      }
      if (b.kind === "heading") {
        const head = b.joined.replace(/\n/g, " ");
        const kind = HEADING_KIND.find(([re]) => re.test(head))?.[1];
        if (kind) {
          current = null;
          headingHost = {
            id: `dyn/${opts.actId}/h${structure.length}-${records.length}`,
            kind,
            title_th: head,
            children: [],
          };
          structure.push(headingHost);
        } else if (current) {
          // schedules/fee tables etc. — keep with the last section
          appendChunk(current, head);
        } else {
          preambleLines.push(head);
        }
        continue;
      }

      if (b.secNo) {
        // duplicate numbers within the body can't anchor twice — fold into text
        if (seenNumbers.has(b.secNo)) {
          current?.versions[0].paragraphs.push({
            id: `p${current.versions[0].paragraphs.length + 1}`,
            text_th: b.joined,
          });
          continue;
        }
        seenNumbers.add(b.secNo);
        const rec: SectionRecord = {
          id: `dyn/${opts.actId}/section-${b.secNo.replace(/\s/g, "-")}`,
          type: "section",
          number: b.secNo,
          number_th: b.secNo,
          citation_th: `มาตรา ${b.secNo}`,
          parent: headingHost?.id ?? "",
          versions: [
            {
              version: 1,
              valid_from: opts.validFrom,
              valid_to: null,
              paragraphs: [],
              source: { gazette_citation: opts.citation, verification_status: "machine_parsed" },
            },
          ],
        };
        appendBlock(rec, b);
        if (rec.versions[0].paragraphs.length === 0)
          rec.versions[0].paragraphs.push({ id: "p1", text_th: b.joined });
        records.push(rec);
        pushRef(rec);
        current = rec;
      } else if (records.length === 0) {
        preambleLines.push(...(b.kind === "para" ? [b.joined] : b.lines));
      } else if (current) {
        // a following วรรค — or (๑)/(ก) อนุมาตรา of the last วรรค
        appendBlock(current, b);
      }
    }
  });

  if (records.length < 3) return null;
  const today = new Date().toISOString().slice(0, 10);
  const sections = records
    .map((r) => resolveSection(r, today))
    .filter((r): r is ResolvedSection => !!r);
  return {
    preambleLines,
    tailLines,
    noteLines,
    structure,
    sections,
    byId: new Map(records.map((r) => [r.id, r])),
  };
}

/** Load + parse the structured text of any act, or null when it has none. */
export async function getDynamicAct(actId: number): Promise<DynamicAct | null> {
  const act = await prisma.act.findUnique({
    where: { id: actId },
    select: { id: true, fullName: true, status: true },
  });
  if (!act) return null;
  const entry = await prisma.gazetteEntry.findFirst({
    where: { actId, isPrimary: true, documentText: { isNot: null } },
    orderBy: { id: "desc" },
    include: { documentText: true },
  });
  if (!entry?.documentText) return null;

  const validFrom = entry.publishedAt?.toISOString().slice(0, 10) ?? "1900-01-01";
  const parsed = parseDynamicSections(entry.documentText.text, {
    actId,
    validFrom,
    citation: buildCitation(entry),
    // OCS copies: one real block element per line → line-level วรรค/item split
    lineLevel: entry.origin === "ocs",
  });
  if (!parsed) return null;

  const src = originalSource(entry);
  return {
    entryId: entry.id,
    title: act.fullName,
    status: act.status,
    citation: buildCitation(entry),
    sourceUrl: src?.url ?? null,
    sourceLabel: src?.label ?? null,
    ...parsed,
  };
}
