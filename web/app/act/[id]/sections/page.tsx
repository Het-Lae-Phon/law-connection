import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Sarabun } from "next/font/google";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { CopyCite } from "@/app/components/copy-cite";
import {
  sdkSlugFor,
  getManifest,
  getStructure,
  listSections,
  listDefinitions,
  sectionById,
  arabicToThai,
  type Definition,
  type ResolvedSection,
  type SectionRecord,
  type StructuralNode,
} from "@/lib/thai-law";
import { getDynamicAct } from "@/lib/dynamic-act";
import { SectionNav, type ChapterLink } from "@/app/components/section-nav";
import { SectionToc } from "@/app/components/section-toc";

/**
 * ตัวบทฉบับเต็ม (โครงสร้างรายมาตรา) — THE reader for the whole registry:
 *
 * - curated acts (thai-law bundles, e.g. PDPA) read with full richness:
 *   amendment versions, ?asOf point-in-time, บทนิยาม, verification status
 * - every other act whose primary entry has a DocumentText is machine-parsed
 *   into the same SDK record shape at request time (lib/dynamic-act.ts) —
 *   same anchors (ม-4, ม-4-ว-3), same layout, clearly marked "ยังไม่ตรวจทาน"
 *
 * Acts with neither fall back to /doc, keeping one reader everywhere.
 */

// the Royal Gazette is typeset in TH Sarabun — same treatment as /doc
const sarabun = Sarabun({
  weight: ["400", "700"],
  subsets: ["thai", "latin"],
});

export const dynamic = "force-dynamic";

const STATUS_TH: Record<string, string> = {
  in_force: "ใช้บังคับอยู่",
  partially_in_force: "ใช้บังคับบางส่วน",
  repealed: "ยกเลิกแล้ว",
  not_yet_in_force: "ยังไม่มีผลใช้บังคับ",
  active: "ใช้บังคับอยู่",
};

const WAK_TH: Record<number, string> = {
  1: "หนึ่ง", 2: "สอง", 3: "สาม", 4: "สี่", 5: "ห้า", 6: "หก",
  7: "เจ็ด", 8: "แปด", 9: "เก้า", 10: "สิบ", 11: "สิบเอ็ด", 12: "สิบสอง",
};

function SectionBlock({ r }: { r: ResolvedSection }) {
  const v = r.version;
  const verified = v.source.verification_status === "human_verified";
  return (
    <div id={`ม-${r.record.number}`} className="law-anchor scroll-mt-24 space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-heading font-bold text-seal-800">
          มาตรา {arabicToThai(r.record.number)}
        </span>
        <span
          className={`rounded-sm px-1.5 py-px text-[10px] leading-tight ${
            verified ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500"
          }`}
          title={
            verified
              ? `ตรวจทานโดย ${v.source.verified_by?.join(", ") ?? "ชุมชน"}`
              : "แปลงจากต้นฉบับด้วยเครื่อง ยังไม่ผ่านการตรวจทาน"
          }
        >
          {verified ? "ตรวจทานแล้ว" : "ยังไม่ตรวจทาน"}
        </span>
        {v.amended_by && (
          <span className="rounded-sm bg-seal-50 px-1.5 py-px text-[10px] leading-tight text-seal-800">
            แก้ไขเพิ่มเติมโดย {v.amended_by}
          </span>
        )}
        {v.enforced_from && v.enforced_from !== v.valid_from && (
          <span className="cat-code">มีผลใช้บังคับ {v.enforced_from}</span>
        )}
      </div>
      {v.paragraphs.map((p, i) => (
        // วรรค are cited by position, so each carries its ordinal and a stable
        // anchor (ม-<n>-ว-<i>) — pinpoint citation targets, not just sections
        <div key={p.id} id={`ม-${r.record.number}-ว-${i + 1}`} className="law-anchor group/wak relative space-y-1 scroll-mt-24">
          {v.paragraphs.length > 1 && (
            <a
              href={`#ม-${r.record.number}-ว-${i + 1}`}
              className="absolute -left-12 top-0.5 hidden w-10 text-right cat-code hover:text-seal-700 sm:block opacity-40 group-hover/wak:opacity-100"
              title={`มาตรา ${arabicToThai(r.record.number)} วรรค${i + 1 === v.paragraphs.length && i > 0 ? "ท้าย" : WAK_TH[i + 1] ?? i + 1}`}
            >
              ว.{i + 1}
            </a>
          )}
          <p className="indent-12 leading-loose text-justify">{p.text_th}</p>
          {(p.items ?? []).map((it) => (
            <div key={it.id} className="ml-10 space-y-1">
              <p className="leading-loose">
                <span className="text-seal-700">{it.num_th}</span> {it.text_th}
              </p>
              {(it.subitems ?? []).map((s) => (
                <p key={s.id} className="ml-8 leading-loose">
                  <span className="text-seal-700">{s.num_th}</span> {s.text_th}
                </p>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// everything the layout needs, whether curated or machine-parsed
interface ReaderData {
  curated: boolean;
  title: string;
  statusLabel: string;
  citation: string;
  citationUrl: string | null;
  preambleLines: string[];
  countersignature?: string;
  remark?: string;
  structure: StructuralNode[];
  sections: ResolvedSection[];
  byId: (id: string) => SectionRecord | undefined;
  definitions: Definition[];
  verifiedCount: number;
}

export default async function ActSectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actId = parseInt(id, 10);
  if (isNaN(actId)) notFound();

  const act = await prisma.act.findUnique({
    where: { id: actId },
    select: { id: true, actType: true, shortName: true, fullName: true },
  });
  if (!act) notFound();

  const slug = sdkSlugFor(act);
  const asOf = slug && /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf ?? "") ? sp.asOf : undefined;

  let data: ReaderData;
  if (slug) {
    const manifest = getManifest(slug);
    const sections = listSections(slug, { asOf });
    data = {
      curated: true,
      title: manifest.title_th,
      statusLabel: STATUS_TH[manifest.status] ?? manifest.status,
      citation: manifest.gazette.citation,
      citationUrl: manifest.gazette.url ?? null,
      preambleLines: manifest.preamble?.text_th ?? [],
      countersignature: manifest.preamble?.countersignature_th,
      remark: manifest.preamble?.remark_th,
      structure: getStructure(slug),
      sections,
      byId: (sid) => sectionById(slug, sid),
      definitions: listDefinitions(slug),
      verifiedCount: sections.filter((s) => s.version.source.verification_status === "human_verified").length,
    };
  } else {
    const dyn = await getDynamicAct(actId);
    // no structured text at all → the flat copy (or nothing) is all we have
    if (!dyn) {
      const textEntry = await prisma.gazetteEntry.findFirst({
        where: { actId, isPrimary: true, documentText: { isNot: null } },
        orderBy: { id: "desc" },
        select: { id: true },
      });
      if (textEntry) redirect(`/entry/${textEntry.id}`); // /doc now redirects here anyway
      notFound();
    }
    data = {
      curated: false,
      title: dyn.title,
      statusLabel: STATUS_TH[dyn.status] ?? dyn.status,
      citation: dyn.citation,
      citationUrl: dyn.sourceUrl,
      preambleLines: dyn.preambleLines,
      countersignature: dyn.tailLines.join("\n") || undefined,
      remark: dyn.noteLines.join(" ") || undefined,
      structure: dyn.structure,
      sections: dyn.sections,
      byId: (sid) => dyn.byId.get(sid),
      definitions: [],
      verifiedCount: 0,
    };
  }

  const byNumber = new Map(data.sections.map((s) => [s.record.id, s]));

  // มาตรา navigation: every section number + one chip per structure heading
  const sectionNumbers = data.sections.map((s) => s.record.number);
  const chapters: ChapterLink[] = [];
  const firstSectionAnchor = (node: StructuralNode): string | null => {
    if (node.kind === "section_ref") {
      const rec = node.section ? data.byId(node.section) : undefined;
      return rec && byNumber.has(rec.id) ? `ม-${rec.number}` : null;
    }
    for (const c of node.children ?? []) {
      const a = firstSectionAnchor(c);
      if (a) return a;
    }
    return null;
  };
  for (const node of data.structure) {
    if (node.kind === "section_ref") continue;
    const anchor = firstSectionAnchor(node);
    const label =
      node.title_th ??
      (node.kind === "transitional" ? "บทเฉพาะกาล" : node.number_th ? `หมวด ${node.number_th}` : null);
    if (anchor && label) chapters.push({ label: label.slice(0, 40), anchor });
  }
  // a code has hundreds of หมวด — keep the chip strip at the top ranks only
  if (chapters.length > 30) {
    const top = chapters.filter((c) => /^(บรรพ|ภาค|ลักษณะ|บทเฉพาะกาล)/.test(c.label));
    if (top.length >= 2) {
      chapters.length = 0;
      chapters.push(...(top.length > 40 ? top.filter((c) => /^(บรรพ|ภาค|บทเฉพาะกาล)/.test(c.label)) : top));
    } else {
      chapters.length = 30;
    }
  }


  // walk the structure tree, emitting headings + sections
  const renderNode = (node: StructuralNode, depth: number): React.ReactNode => {
    if (node.kind === "section_ref") {
      const rec = node.section ? data.byId(node.section) : undefined;
      const resolved = rec ? byNumber.get(rec.id) : undefined;
      return resolved ? <SectionBlock key={node.id} r={resolved} /> : null;
    }
    const label =
      node.number_th || node.number
        ? node.kind === "chapter"
          ? `หมวด ${node.number_th ?? node.number}`
          : node.kind === "part"
            ? `ส่วนที่ ${node.number_th ?? node.number}`
            : node.kind === "transitional"
              ? "บทเฉพาะกาล"
              : null
        : node.kind === "transitional"
          ? "บทเฉพาะกาล"
          : null;
    return (
      <section key={node.id} className="space-y-5">
        {(label || node.title_th) && (
          <h2
            className={`text-center font-heading font-bold ${depth === 0 ? "text-lg pt-4" : "text-base pt-2"}`}
          >
            {label}
            {node.title_th && (
              <div className={label ? "text-[15px] font-medium" : undefined}>{node.title_th}</div>
            )}
          </h2>
        )}
        {(node.children ?? []).map((c) => renderNode(c, depth + 1))}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "กฎหมายแม่บท", href: "/acts" },
          { label: act.shortName, href: `/act/${act.id}` },
          { label: "ตัวบทฉบับเต็ม" },
        ]}
      />

      <header className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-seal-700">
          {act.actType} · {data.statusLabel}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{data.title}</h1>
        <p className="text-sm text-stone-500">
          {data.curated
            ? `ตัวบทฉบับเต็ม โครงสร้างรายมาตราจากชุดข้อมูลเปิด thai-law (${data.sections.length} มาตรา · ตรวจทานแล้ว ${data.verifiedCount})`
            : `ตัวบทฉบับเต็ม โครงสร้างรายมาตราแปลงอัตโนมัติจากสำเนาข้อความ (${data.sections.length} มาตรา)`}{" "}
          {data.citationUrl ? (
            <a
              href={data.citationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-seal-700 underline"
            >
              — {data.citation} ↗
            </a>
          ) : (
            <>— {data.citation}</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyCite citation={data.title} />
          {/* point-in-time reading needs versioned records — curated only */}
          {data.curated && (
            <form className="flex items-center gap-1.5 text-sm" action="">
              <label htmlFor="asOf" className="cat-code">
                ตัวบท ณ วันที่
              </label>
              <input
                id="asOf"
                type="date"
                name="asOf"
                defaultValue={asOf}
                className="rounded border border-stone-300 px-2 py-1 text-sm"
              />
              <button className="rounded bg-stone-900 text-white px-2.5 py-1 text-sm hover:bg-stone-700">
                ดู
              </button>
              {asOf && (
                <Link href={`/act/${act.id}/sections`} className="text-seal-700 hover:underline">
                  ล่าสุด
                </Link>
              )}
            </form>
          )}
        </div>
        {asOf && (
          <p className="rounded border border-seal-300 bg-seal-50 px-3 py-1.5 text-sm text-seal-900">
            แสดงตัวบทตามที่ใช้บังคับ ณ วันที่ <b>{asOf}</b> — มาตราที่ยังไม่มีผลในวันนั้นจะไม่ปรากฏ
          </p>
        )}
        {!data.curated && (
          <p className="rounded border border-stone-300 bg-stone-100 px-3 py-1.5 text-[13px] text-stone-600">
            โครงสร้างรายมาตรานี้<b>แปลงจากสำเนาข้อความด้วยเครื่อง ยังไม่ผ่านการตรวจทาน</b> —
            อาจแบ่งมาตรา/วรรคคลาดเคลื่อน การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับเป็นสำคัญ
          </p>
        )}
      </header>

      <SectionNav numbers={sectionNumbers} chapters={chapters} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-6 lg:items-start">
      <div className="space-y-6 min-w-0">
      {data.definitions.length > 0 && (
        <details className="rounded-lg border border-dashed border-stone-300 bg-white p-4">
          <summary className="cursor-pointer font-bold text-sm">
            บทนิยาม <span className="font-normal text-stone-400">{data.definitions.length} คำ</span>
          </summary>
          <dl className="mt-3 space-y-2 text-sm">
            {data.definitions.map((d) => (
              <div key={d.term_th}>
                <dt className="font-semibold text-seal-800 inline">“{d.term_th}”</dt>{" "}
                <dd className="inline text-stone-700">{d.definition_th}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <article
        className={`${sarabun.className} rounded-lg border border-stone-200 bg-white px-5 py-10 sm:px-14 sm:py-14 text-[17px] text-stone-900 space-y-6`}
      >
        {/* the royal preamble — the document opens exactly like the gazette */}
        {data.preambleLines.length > 0 && (
          <div className="space-y-3 pb-2">
            {data.preambleLines.map((line, i) =>
              i === 0 ? (
                <div key={i} className="text-center font-bold text-[1.3em] leading-relaxed">
                  {line}
                  <div className="mx-auto mt-3 w-40 border-b border-stone-800" />
                </div>
              ) : /^(ให้ไว้|พระบาทสมเด็จ|สมเด็จพระ|ภูมิพล|วชิราลงกรณ)/.test(line) && line.length < 90 ? (
                <div key={i} className="text-center leading-loose">
                  {line}
                </div>
              ) : (
                <p key={i} className="indent-12 leading-loose text-justify">
                  {line}
                </p>
              ),
            )}
          </div>
        )}
        {data.structure.map((n) => renderNode(n, 0))}
        {data.countersignature && (
          <div className="pt-4 text-center leading-loose whitespace-pre-line">
            {data.countersignature}
          </div>
        )}
        {data.remark && (
          <p className="border-t border-stone-200 pt-4 text-[0.85em] leading-relaxed text-stone-500">
            {data.remark}
          </p>
        )}
      </article>

      </div>

      {/* สารบัญ — the right-hand rail, like a book's table of contents */}
      <aside className="hidden lg:block sticky top-14 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-dashed border-stone-300 bg-white p-3 [scrollbar-width:thin]">
        <p className="cat-code mb-2">สารบัญ&nbsp;·&nbsp;CONTENTS</p>
        <SectionToc structure={data.structure} byId={data.byId} has={(id) => byNumber.has(id)} />
      </aside>
      </div>

      {/* mobile: collapsible สารบัญ above the footer */}
      <details className="lg:hidden rounded-lg border border-dashed border-stone-300 bg-white p-3">
        <summary className="cursor-pointer cat-code">สารบัญ&nbsp;·&nbsp;CONTENTS</summary>
        <div className="mt-2 max-h-96 overflow-y-auto">
          <SectionToc structure={data.structure} byId={data.byId} has={(id) => byNumber.has(id)} />
        </div>
      </details>

      <p className="text-[11px] text-stone-400">
        {data.curated ? (
          <>
            ข้อมูลรายมาตราจากโครงการ{" "}
            <a
              href="https://github.com/Het-Lae-Phon/thai-law"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              thai-law
            </a>{" "}
            (Apache-2.0) — มาตราที่ระบุ “ยังไม่ตรวจทาน” แปลงจากต้นฉบับด้วยเครื่องและอาจคลาดเคลื่อน
            การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับราชกิจจานุเบกษาเป็นสำคัญ
          </>
        ) : (
          <>
            โครงสร้างรายมาตราแปลงอัตโนมัติจากสำเนาข้อความในระบบ (รูปแบบข้อมูลตามโครงการ thai-law)
            — อาจคลาดเคลื่อน การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับราชกิจจานุเบกษาเป็นสำคัญ
          </>
        )}
      </p>
    </div>
  );
}
