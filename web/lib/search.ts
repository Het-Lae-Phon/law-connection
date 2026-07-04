import { prisma } from "@/lib/db";

/**
 * Thai legal search: normalize the query, expand common lawyer shorthand,
 * split into keywords matched with AND, then rank candidates by relevance
 * (exact/prefix title hits, keyword position, legal weight of the entry).
 * Works on SQLite `contains` today and ports unchanged to Postgres.
 */

// whole-token shorthand → canonical form
const TOKEN_ALIASES: [RegExp, string][] = [
  [/^พ\.?ร\.?บ\.?$/, "พระราชบัญญัติ"],
  [/^พ\.?ร\.?ก\.?$/, "พระราชกำหนด"],
  [/^พ\.?ร\.?ฎ\.?$/, "พระราชกฤษฎีกา"],
  [/^ป\.?พ\.?พ\.?$/, "แพ่งและพาณิชย์"],
  [/^ป\.?อาญา$/, "ประมวลกฎหมายอาญา"],
  [/^มอก\.?$/, "มาตรฐานผลิตภัณฑ์อุตสาหกรรม"],
  [/^รธน\.?$/, "รัฐธรรมนูญ"],
  [/^pdpa$/i, "คุ้มครองข้อมูลส่วนบุคคล"],
  [/^กสทช\.?$/, "กสทช"],
  [/^กลต\.?$|^ก\.ล\.ต\.?$/, "ก.ล.ต"],
];

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function normalizeQuery(q: string): string {
  return q
    .replace(/ํา/g, "ำ")
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(q: string): string[] {
  const tokens = normalizeQuery(q)
    .split(" ")
    .map((t) => {
      for (const [re, canon] of TOKEN_ALIASES) if (re.test(t)) return canon;
      return t;
    })
    .filter((t) => t.length >= 2);
  return tokens.slice(0, 6);
}

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

interface Scorable {
  title: string;
  category: string;
  isPrimary: boolean;
  actId: number | null;
  publishedAt: Date | null;
}

export function scoreEntry(e: Scorable, tokens: string[], compactQuery: string): number {
  const t = compact(e.title);
  let s = 0;
  if (t === compactQuery) s += 120;
  else if (t.startsWith(compactQuery)) s += 60;
  for (const tok of tokens) {
    const ct = compact(tok);
    const idx = t.indexOf(ct);
    if (idx < 0) continue;
    s += 10;
    if (idx < 40) s += 12; // keyword near the start = about the law itself
  }
  // legal weight: actual legislation over administrative/court notices
  if (e.category === "ก") s += 15;
  else if (e.category === "ข") s += 5;
  if (e.isPrimary) s += 12;
  if (e.actId) s += 5;
  // mild recency boost so current law surfaces above decades-old notices
  const year = e.publishedAt?.getUTCFullYear() ?? 0;
  const now = new Date().getUTCFullYear();
  if (year >= now - 5) s += 6;
  else if (year >= now - 15) s += 3;
  // shorter titles that still match everything are usually the law itself
  if (t.length <= compactQuery.length + 45) s += 6;
  return s;
}

const CANDIDATE_CAP = 600;

export async function searchEntries(query: string, instrumentType: string | null) {
  const tokens = tokenize(query);
  if (!tokens.length && !instrumentType) return { tokens, total: 0, capped: false, entries: [] };

  const where = {
    AND: [
      ...tokens.map((t) => ({ title: { contains: t } })),
      ...(instrumentType ? [{ instrumentType }] : []),
    ],
  };
  const candidates = await prisma.gazetteEntry.findMany({
    where,
    include: { act: true },
    orderBy: { publishedAt: { sort: "desc" as const, nulls: "last" as const } },
    take: CANDIDATE_CAP,
  });
  const compactQuery = compact(tokens.join(""));
  const scored = candidates
    .map((e) => ({ e, s: scoreEntry(e, tokens, compactQuery) }))
    .sort((a, b) => b.s - a.s || (b.e.publishedAt?.getTime() ?? 0) - (a.e.publishedAt?.getTime() ?? 0))
    .map(({ e }) => e);
  return { tokens, total: scored.length, capped: candidates.length >= CANDIDATE_CAP, entries: scored };
}

// Full ranked act search (optionally narrowed to an actType). Returns the
// whole scored list so callers can paginate.
export async function searchActsRanked(query: string, actType: string | null = null) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const acts = await prisma.act.findMany({
    where: {
      AND: [
        ...tokens.map((t) => ({ fullName: { contains: t } })),
        ...(actType ? [{ actType }] : []),
      ],
    },
    include: { _count: { select: { entries: true } } },
    orderBy: { entries: { _count: "desc" } },
    take: 300,
  });
  const cq = compact(tokens.join(""));
  return acts
    .map((a) => {
      const n = compact(a.fullName);
      let s = a._count.entries;
      if (compact(a.shortName) === cq || n === cq) s += 100000;
      else if (n.startsWith(cq) || compact(a.shortName).startsWith(cq)) s += 50000;
      return { a, s };
    })
    .sort((x, y) => y.s - x.s)
    .map(({ a }) => a);
}

export async function searchActs(query: string, take = 5) {
  return (await searchActsRanked(query)).slice(0, take);
}
