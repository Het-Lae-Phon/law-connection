/** Types mirroring schemas/*.schema.json. Keep in sync with the schemas. */

export interface Subitem {
  id: string;
  num_th: string;
  text_th: string;
}

export interface Item {
  id: string;
  num_th: string;
  text_th: string;
  subitems?: Subitem[];
}

export interface Paragraph {
  id: string;
  text_th: string;
  items?: Item[];
}

export interface Source {
  gazette_url?: string;
  gazette_citation: string;
  checksum_sha256?: string;
  verification_status: "machine_parsed" | "human_verified";
  verified_by?: string[];
  verified_at?: string;
}

export interface ProvisionVersion {
  version: number;
  valid_from: string;
  valid_to: string | null;
  enforced_from?: string;
  amended_by?: string | null;
  paragraphs: Paragraph[];
  source: Source;
}

export interface Reference {
  target: string;
  kind?: "internal" | "external";
  citation_th: string;
  context?: string;
  extraction?: "machine" | "human";
}

export interface Annotation {
  id: string;
  kind?: "footnote" | "editorial_note";
  anchor?: string;
  text_th: string;
  text_en?: string;
}

export interface SectionRecord {
  id: string;
  type: "section";
  number: string;
  number_th: string;
  citation_th: string;
  parent: string;
  versions: ProvisionVersion[];
  references?: Reference[];
  tags?: string[];
  annotations?: Annotation[];
  translations?: Record<string, { status: "unofficial" | "official"; paragraphs?: unknown[] }>;
}

export interface StructuralNode {
  id: string;
  kind: "front_matter" | "chapter" | "part" | "transitional" | "section_ref";
  number?: string;
  number_th?: string;
  title_th?: string;
  title_en?: string;
  children?: StructuralNode[];
  section?: string;
}

export interface ActEvent {
  date: string;
  kind:
    | "gazetted"
    | "effective"
    | "effective_in_part"
    | "enforcement_postponed"
    | "amended"
    | "repealed";
  instrument?: string;
  affects?: string[];
  note_th: string;
  note_en?: string;
}

export interface Definition {
  term_th: string;
  term_en?: string;
  defined_in: string;
  definition_th?: string;
}

export interface Penalty {
  penalty_section: string;
  kind?: "criminal" | "administrative" | "civil";
  sanctions: string[];
}

export interface ActManifest {
  id: string;
  type: "act" | "code" | "royal-decree" | "ministerial-regulation" | "notification";
  slug: string;
  title_th: string;
  title_en?: string;
  short_title?: string;
  era_year_be?: number;
  status: "in_force" | "partially_in_force" | "repealed" | "not_yet_in_force";
  signed_date?: string;
  gazette: { citation: string; published_date: string; url?: string };
  preamble?: { text_th?: string[]; remark_th?: string; countersignature_th?: string };
  structure: StructuralNode[];
  events: ActEvent[];
  definitions: Definition[];
  penalties?: Penalty[];
}

/** A section resolved to a single point-in-time version. */
export interface ResolvedSection {
  record: SectionRecord;
  version: ProvisionVersion;
  /** Plain text of the resolved version, reading order. */
  text_th: string;
}

export interface CitationTarget {
  section: ResolvedSection;
  /** วรรค number (1-based) when the citation names one. */
  paragraph?: Paragraph;
  /** (๑)-style item when the citation names one. */
  item?: Item;
}
