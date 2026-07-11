import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BackLink } from "@/app/components/back-link";
import { CopyCite } from "@/app/components/copy-cite";
import { TypeGlyph } from "@/app/components/geo-shape";
import {
  sdkSlugFor,
  getManifest,
  getStructure,
  listSections,
  listDefinitions,
  sectionById,
  arabicToThai,
  type ResolvedSection,
  type StructuralNode,
} from "@/lib/thai-law";

/**
 * ตัวบทรายมาตรา — structured section-by-section text of an act, powered by
 * the team's @thai-law/core SDK (Het-Lae-Phon/thai-law): typed section
 * records with point-in-time versions, definitions and cross-references.
 * Supports ?asOf=YYYY-MM-DD to read the law as it stood on a given date.
 */

export const dynamic = "force-dynamic";

const STATUS_TH: Record<string, string> = {
  in_force: "ใช้บังคับอยู่",
  partially_in_force: "ใช้บังคับบางส่วน",
  repealed: "ยกเลิกแล้ว",
  not_yet_in_force: "ยังไม่มีผลใช้บังคับ",
};

function SectionBlock({ r }: { r: ResolvedSection }) {
  const v = r.version;
  const verified = v.source.verification_status === "human_verified";
  return (
    <div id={`ม-${r.record.number}`} className="scroll-mt-24 space-y-1.5">
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
      {v.paragraphs.map((p) => (
        <div key={p.id} className="space-y-1">
          <p className="indent-8 leading-relaxed text-[15px]">{p.text_th}</p>
          {(p.items ?? []).map((it) => (
            <div key={it.id} className="ml-10 space-y-1">
              <p className="leading-relaxed text-[15px]">
                <span className="text-seal-700">{it.num_th}</span> {it.text_th}
              </p>
              {(it.subitems ?? []).map((s) => (
                <p key={s.id} className="ml-8 leading-relaxed text-[15px]">
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
  if (!slug) notFound();

  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf ?? "") ? sp.asOf : undefined;
  const manifest = getManifest(slug);
  const structure = getStructure(slug);
  const sections = listSections(slug, { asOf });
  const byNumber = new Map(sections.map((s) => [s.record.id, s]));
  const definitions = listDefinitions(slug);
  const verifiedCount = sections.filter(
    (s) => s.version.source.verification_status === "human_verified",
  ).length;

  // renderable groups: walk the structure tree, emitting headings + sections
  const renderNode = (node: StructuralNode, depth: number): React.ReactNode => {
    if (node.kind === "section_ref") {
      const rec = node.section ? sectionById(slug, node.section) : undefined;
      const resolved = rec ? byNumber.get(rec.id) : undefined;
      return resolved ? <SectionBlock key={node.id} r={resolved} /> : null;
    }
    const label =
      node.kind === "chapter"
        ? `หมวด ${node.number_th ?? node.number ?? ""}`
        : node.kind === "part"
          ? `ส่วนที่ ${node.number_th ?? node.number ?? ""}`
          : node.kind === "transitional"
            ? "บทเฉพาะกาล"
            : null;
    return (
      <section key={node.id} className={depth > 0 ? "space-y-5" : "space-y-5"}>
        {label && (
          <h2
            className={`text-center font-heading font-bold ${depth === 0 ? "text-lg pt-4" : "text-base pt-2"}`}
          >
            {label}
            {node.title_th && <div className="text-[15px] font-medium">{node.title_th}</div>}
          </h2>
        )}
        {(node.children ?? []).map((c) => renderNode(c, depth + 1))}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-stone-500 flex flex-wrap items-center gap-x-1">
        <BackLink fallbackHref={`/act/${act.id}`} />
        <span className="mx-1">·</span>
        <Link href={`/act/${act.id}`} className="hover:underline">
          {act.shortName}
        </Link>{" "}
        / <span className="text-stone-700">ตัวบทรายมาตรา</span>
      </nav>

      <header className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-seal-700">
          <TypeGlyph type={act.actType} size={14} />
          {act.actType} · {STATUS_TH[manifest.status] ?? manifest.status}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{manifest.title_th}</h1>
        <p className="text-sm text-stone-500">
          โครงสร้างรายมาตราจากชุดข้อมูลเปิด thai-law ({sections.length} มาตรา · ตรวจทานแล้ว{" "}
          {verifiedCount}) —{" "}
          <a
            href={manifest.gazette.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seal-700 underline"
          >
            {manifest.gazette.citation} ↗
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyCite citation={manifest.title_th} />
          {/* point-in-time: read the act as it stood on a date */}
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
        </div>
        {asOf && (
          <p className="rounded border border-seal-300 bg-seal-50 px-3 py-1.5 text-sm text-seal-900">
            แสดงตัวบทตามที่ใช้บังคับ ณ วันที่ <b>{asOf}</b> — มาตราที่ยังไม่มีผลในวันนั้นจะไม่ปรากฏ
          </p>
        )}
      </header>

      {definitions.length > 0 && (
        <details className="rounded-lg border border-dashed border-stone-300 bg-white p-4">
          <summary className="cursor-pointer font-bold text-sm">
            บทนิยาม <span className="font-normal text-stone-400">{definitions.length} คำ</span>
          </summary>
          <dl className="mt-3 space-y-2 text-sm">
            {definitions.map((d) => (
              <div key={d.term_th}>
                <dt className="font-semibold text-seal-800 inline">“{d.term_th}”</dt>{" "}
                <dd className="inline text-stone-700">{d.definition_th}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <article className="rounded-lg border border-stone-200 bg-white px-5 py-8 sm:px-12 sm:py-10 space-y-6">
        {structure.map((n) => renderNode(n, 0))}
      </article>

      <p className="text-[11px] text-stone-400">
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
      </p>
    </div>
  );
}
