import type { SectionRecord, StructuralNode } from "@/vendor/thai-law-core/src/types";

/**
 * สารบัญ (table of contents) for the full-text reader — the right-hand rail:
 * the act's structure (บรรพ/ลักษณะ/หมวด/ส่วนที่) as collapsible groups, each
 * listing its มาตรา as anchor links. Pure server-rendered <details>, no JS.
 */

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const thai = (s: string) => s.replace(/[0-9]/g, (d) => THAI_DIGITS[Number(d)]);

export function SectionToc({
  structure,
  byId,
  has,
}: {
  structure: StructuralNode[];
  byId: (id: string) => SectionRecord | undefined;
  /** whether a record id resolved to a rendered section */
  has: (id: string) => boolean;
}) {
  const sectionLink = (rec: SectionRecord) => (
    <li key={rec.id}>
      <a
        href={`#ม-${rec.number}`}
        className="block truncate rounded px-1.5 py-0.5 text-[13px] text-stone-600 hover:bg-seal-50 hover:text-seal-800"
      >
        มาตรา {thai(rec.number)}
      </a>
    </li>
  );

  const renderNode = (node: StructuralNode, depth: number): React.ReactNode => {
    if (node.kind === "section_ref") {
      const rec = node.section ? byId(node.section) : undefined;
      return rec && has(rec.id) ? sectionLink(rec) : null;
    }
    const label =
      node.title_th ??
      (node.kind === "transitional"
        ? "บทเฉพาะกาล"
        : node.kind === "chapter"
          ? `หมวด ${node.number_th ?? node.number ?? ""}`
          : node.kind === "part"
            ? `ส่วนที่ ${node.number_th ?? node.number ?? ""}`
            : null);
    const children = (node.children ?? [])
      .map((c) => renderNode(c, depth + 1))
      .filter(Boolean);
    if (children.length === 0) return null;
    if (!label) return children;
    return (
      <li key={node.id}>
        <details open={depth === 0 && structure.length <= 12}>
          <summary className="cursor-pointer list-none rounded px-1.5 py-0.5 text-[13px] font-semibold text-stone-800 hover:bg-stone-100 [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block w-3 text-stone-400">▸</span>
            {label}
          </summary>
          <ul className="ml-3 border-l border-dashed border-stone-200 pl-2">{children}</ul>
        </details>
      </li>
    );
  };

  return (
    <ul className="space-y-0.5">
      {structure.map((n) => renderNode(n, 0))}
    </ul>
  );
}
