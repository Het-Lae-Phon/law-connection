import Link from "next/link";
import { notFound } from "next/navigation";
import { Sarabun } from "next/font/google";
import { prisma } from "@/lib/db";
import { BackLink } from "@/app/components/back-link";
import { CopyCite } from "@/app/components/copy-cite";
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
 * ตัวบทฉบับเต็ม (โครงสร้างรายมาตรา) — THE reader for SDK-covered acts: the
 * complete text from the royal preamble down, typeset like the gazette
 * (Sarabun), but built from @thai-law/core structured records — so every
 * มาตรา and every วรรค is an addressable anchor with provenance chips, and
 * ?asOf=YYYY-MM-DD reads the law as it stood on a date.
 */

// the Royal Gazette is typeset in TH Sarabun — same treatment as the entry reader
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
};

const WAK_TH: Record<number, string> = {
  1: "หนึ่ง", 2: "สอง", 3: "สาม", 4: "สี่", 5: "ห้า", 6: "หก",
  7: "เจ็ด", 8: "แปด", 9: "เก้า", 10: "สิบ", 11: "สิบเอ็ด", 12: "สิบสอง",
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
      {v.paragraphs.map((p, i) => (
        // วรรค are cited by position, so each carries its ordinal and a stable
        // anchor (ม-<n>-ว-<i>) — pinpoint citation targets, not just sections
        <div key={p.id} id={`ม-${r.record.number}-ว-${i + 1}`} className="group/wak relative space-y-1 scroll-mt-24">
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
      <section key={node.id} className="space-y-5">
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
        <Link href="/acts" className="hover:underline">
          กฎหมายแม่บท
        </Link>{" "}
        /{" "}
        <Link href={`/act/${act.id}`} className="hover:underline">
          {act.shortName}
        </Link>{" "}
        / <span className="text-stone-700">ตัวบทฉบับเต็ม</span>
      </nav>

      <header className="space-y-2">
        <div className="text-sm font-medium text-seal-700">
          {act.actType} · {STATUS_TH[manifest.status] ?? manifest.status}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{manifest.title_th}</h1>
        <p className="text-sm text-stone-500">
          ตัวบทฉบับเต็ม โครงสร้างรายมาตราจากชุดข้อมูลเปิด thai-law ({sections.length} มาตรา ·
          ตรวจทานแล้ว {verifiedCount}) —{" "}
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

      <article
        className={`${sarabun.className} rounded-lg border border-stone-200 bg-white px-5 py-10 sm:px-14 sm:py-14 text-[17px] text-stone-900 space-y-6`}
      >
        {/* the royal preamble — the document opens exactly like the gazette */}
        {manifest.preamble?.text_th && (
          <div className="space-y-3 pb-2">
            {manifest.preamble.text_th.map((line, i) =>
              i === 0 ? (
                <div key={i} className="text-center font-bold text-[1.3em] leading-relaxed">
                  {line}
                  <div className="mx-auto mt-3 w-40 border-b border-stone-800" />
                </div>
              ) : /^(ให้ไว้|พระบาทสมเด็จ|สมเด็จพระ)/.test(line) && line.length < 90 ? (
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
        {structure.map((n) => renderNode(n, 0))}
        {manifest.preamble?.countersignature_th && (
          <div className="pt-4 text-center leading-loose whitespace-pre-line">
            {manifest.preamble.countersignature_th}
          </div>
        )}
        {manifest.preamble?.remark_th && (
          <p className="border-t border-stone-200 pt-4 text-[0.85em] leading-relaxed text-stone-500">
            {manifest.preamble.remark_th}
          </p>
        )}
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
