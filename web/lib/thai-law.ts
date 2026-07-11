/**
 * Bridge to the team's @thai-law/core SDK (Het-Lae-Phon/thai-law).
 *
 * Uses the SDK's browser-safe layer (vendor/thai-law-core/src/resolve.ts,
 * pure legal logic with no Node built-ins) over act bundles vendored by
 * scripts/sync-thai-law.mjs — recreating the fs-based loader API in a form
 * a bundled Next.js server component can use. thai-law itself is consumed
 * read-only.
 */
import {
  resolveSection,
  resolveCitationWith,
  parseCitation,
  todayISO,
  thaiToArabic,
  arabicToThai,
} from "@/vendor/thai-law-core/src/resolve";
import type {
  ActManifest,
  CitationTarget,
  Definition,
  ResolvedSection,
  SectionRecord,
  StructuralNode,
} from "@/vendor/thai-law-core/src/types";
import pdpa from "@/vendor/thai-law-core/bundle/pdpa-2562.json";

export type {
  ActManifest,
  Definition,
  ResolvedSection,
  SectionRecord,
  StructuralNode,
  CitationTarget,
};
export { parseCitation, thaiToArabic, arabicToThai };

interface ActBundle {
  manifest: ActManifest;
  sections: SectionRecord[];
}

const BUNDLES: ActBundle[] = [pdpa as unknown as ActBundle];

// our Act registry rows ↔ SDK slugs, keyed by shortName so the mapping
// survives the SQLite→Neon id remap
const SHORTNAME_TO_SLUG: Record<string, string> = {
  "คุ้มครองข้อมูลส่วนบุคคล": "pdpa-2562",
};

interface LoadedAct {
  manifest: ActManifest;
  sections: Map<string, SectionRecord>; // keyed by arabic number ("24", "22/1")
  byId: Map<string, SectionRecord>;
}

const acts = new Map<string, LoadedAct>();
for (const b of BUNDLES) {
  acts.set(b.manifest.slug, {
    manifest: b.manifest,
    sections: new Map(b.sections.map((s) => [s.number, s])),
    byId: new Map(b.sections.map((s) => [s.id, s])),
  });
}

/** SDK slug for one of our Act rows, or null when the act isn't in thai-law yet. */
export function sdkSlugFor(act: { shortName: string; actType: string }): string | null {
  const slug = SHORTNAME_TO_SLUG[act.shortName];
  return slug && acts.has(slug) ? slug : null;
}

export function getManifest(slug: string): ActManifest {
  return mustLoad(slug).manifest;
}

function mustLoad(slug: string): LoadedAct {
  const a = acts.get(slug);
  if (!a) throw new Error(`thai-law bundle missing for "${slug}"`);
  return a;
}

export interface QueryOptions {
  /** ISO date: resolve the text as it stood on this date. Default: today. */
  asOf?: string;
}

export function getSection(
  slug: string,
  number: number | string,
  opts: QueryOptions = {},
): ResolvedSection | undefined {
  const rec = mustLoad(slug).sections.get(thaiToArabic(String(number)));
  if (!rec) return undefined;
  return resolveSection(rec, opts.asOf ?? todayISO());
}

export function listSections(slug: string, opts: QueryOptions = {}): ResolvedSection[] {
  const act = mustLoad(slug);
  const numbers = [...act.sections.keys()].sort((a, b) => {
    const [am, as = 0] = a.split("/").map(Number);
    const [bm, bs = 0] = b.split("/").map(Number);
    return am - bm || as - bs;
  });
  const out: ResolvedSection[] = [];
  for (const n of numbers) {
    const r = getSection(slug, n, opts);
    if (r) out.push(r);
  }
  return out;
}

export function getStructure(slug: string): StructuralNode[] {
  return mustLoad(slug).manifest.structure;
}

export function sectionById(slug: string, id: string): SectionRecord | undefined {
  return mustLoad(slug).byId.get(id);
}

export function listDefinitions(slug: string): Definition[] {
  return mustLoad(slug).manifest.definitions;
}

/** Sections whose extracted references point at the given section. */
export function getReferencesTo(slug: string, number: number | string): SectionRecord[] {
  const act = mustLoad(slug);
  const target = act.sections.get(thaiToArabic(String(number)))?.id;
  if (!target) return [];
  return [...act.sections.values()].filter((s) =>
    (s.references ?? []).some((r) => (r.kind ?? "internal") === "internal" && r.target === target),
  );
}

/** Resolve "มาตรา ๒๔ (๒)" / "มาตรา 19 วรรคห้า" against an act. */
export function resolveCitation(
  slug: string,
  citation: string,
  opts: QueryOptions = {},
): CitationTarget | undefined {
  const act = mustLoad(slug);
  return resolveCitationWith(
    (num) => act.sections.get(num),
    citation,
    opts.asOf ?? todayISO(),
  );
}
