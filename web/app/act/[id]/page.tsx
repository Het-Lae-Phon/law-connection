import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { confirmLink, disputeLink, addComment, suggestEntry, suggestSource } from "@/lib/actions";
import { EntryActions } from "@/app/components/entry-actions";
import { CopyCite } from "@/app/components/copy-cite";
import { VerifyBadge } from "@/app/components/verify-badge";
import { BackLink } from "@/app/components/back-link";
import { buildCitation, originalSource } from "@/lib/cite";
import { GROUP_ORDER, GROUP_LABELS } from "@/lib/instrument-labels";
import { SectionTree } from "@/app/components/section-tree";
import { VersionTimeline } from "@/app/components/version-timeline";
import { CodeTimeline, codeTimelineFor } from "@/app/components/code-timeline";
import { BookIndex, codeBooksFor } from "@/app/components/book-index";
import { TypeGlyph } from "@/app/components/geo-shape";
import { BasisChips } from "@/app/components/basis-chips";
import { sdkSlugFor } from "@/lib/thai-law";

// Thai government domains get an "official" badge on source links
function isGovDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".go.th") || host.endsWith(".or.th");
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

const ORIGIN_LABELS: Record<string, string> = {
  krisdika: "ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา",
  pdpc: "เว็บไซต์ สคส. (PDPC)",
};

const PER_GROUP = 25;
const PER_PAGE = 100;

export default async function ActPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; page?: string; view?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actId = parseInt(id, 10);
  if (isNaN(actId)) notFound();

  // single-group drilldown view (?type=ประกาศ) — paginated
  const filterType = (sp.type ?? "").trim() || null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  // ?view=tree — word-tree branched by authorising section (มาตรา)
  const treeView = sp.view === "tree";

  const act = await prisma.act.findUnique({
    where: { id: actId },
    include: {
      repealedBy: { select: { id: true, fullName: true } },
      contributions: {
        where: { type: "comment", status: { not: "rejected" } },
        orderBy: { createdAt: "desc" },
      },
      sources: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!act) notFound();

  const [typeCounts, subCount, verifiedCount, primaryEntry, primaries, textEntry] = await Promise.all([
    prisma.gazetteEntry.groupBy({
      by: ["instrumentType"],
      where: { actId },
      _count: true,
    }),
    prisma.gazetteEntry.count({ where: { actId, isPrimary: false } }),
    prisma.gazetteEntry.count({ where: { actId, verifyStatus: "verified" } }),
    prisma.gazetteEntry.findFirst({
      where: { actId, isPrimary: true, isAmendment: false, volume: { gt: 0 } },
      orderBy: { publishedAt: "asc" },
    }),
    prisma.gazetteEntry.findMany({
      where: { actId, isPrimary: true },
      orderBy: { publishedAt: { sort: "asc", nulls: "last" } },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        volume: true,
        issue: true,
        category: true,
        page: true,
        isAmendment: true,
      },
    }),
    // full text readable on-site (e.g. ประมวลกฎหมาย imported from OCS)
    prisma.gazetteEntry.findFirst({
      where: { actId, isPrimary: true, documentText: { isNot: null } },
      orderBy: { id: "desc" },
      select: { id: true },
    }),
  ]);
  const countByType = new Map(typeCounts.map((t) => [t.instrumentType ?? "อื่น ๆ", t._count]));
  // structured section texts via the thai-law SDK — chips deep-link into them
  const sectionsHref = sdkSlugFor(act) ? `/act/${act.id}/sections` : undefined;

  const orderedKeys = filterType
    ? [filterType]
    : [
        ...GROUP_ORDER.filter((k) => countByType.has(k)),
        ...[...countByType.keys()].filter((k) => !GROUP_ORDER.includes(k)),
      ];

  // fetch entries per group (limited), or one paginated group in drilldown mode
  const groups = new Map<string, Awaited<ReturnType<typeof prisma.gazetteEntry.findMany>>>();
  if (!treeView) {
    for (const key of orderedKeys) {
      const list = await prisma.gazetteEntry.findMany({
        where: { actId, instrumentType: key === "อื่น ๆ" ? null : key },
        orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
        take: filterType ? PER_PAGE : PER_GROUP,
        skip: filterType ? (page - 1) * PER_PAGE : 0,
      });
      if (list.length) groups.set(key, list);
    }
  }

  // tree view: all non-primary entries, branched by section in the component
  const treeEntries = treeView
    ? await prisma.gazetteEntry.findMany({
        where: { actId, isPrimary: false },
        orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
        select: {
          id: true,
          title: true,
          instrumentType: true,
          legalBasis: true,
          publishedAt: true,
          volume: true,
          issue: true,
          category: true,
          page: true,
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <nav className="text-sm text-stone-500 flex flex-wrap items-center gap-x-1">
        <BackLink fallbackHref="/acts" />
        <span className="mx-1">·</span>
        <Link href="/acts" className="hover:underline">
          กฎหมายแม่บท
        </Link>{" "}
        / <span className="text-stone-700">{act.shortName}</span>
      </nav>

      <header className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-seal-700">
          <TypeGlyph type={act.actType} size={14} />
          {act.actType}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{act.fullName}</h1>
        {act.status === "repealed" && (
          <div className="rounded border border-seal-300 bg-seal-50 px-3 py-2 text-sm text-seal-900">
            <b>ยกเลิกแล้ว</b>
            {act.repealedBy && (
              <>
                {" — โดย "}
                <Link href={`/act/${act.repealedBy.id}`} className="font-medium underline hover:text-seal-700">
                  {act.repealedBy.fullName}
                </Link>
              </>
            )}
            {" · ข้อมูลคงไว้เพื่อการอ้างอิงย้อนหลัง"}
          </div>
        )}
        <p className="text-stone-500 text-sm">
          กฎหมายลำดับรองและฉบับที่เกี่ยวข้องในระบบ {subCount.toLocaleString("th-TH")} ฉบับ
          {verifiedCount > 0 && ` · ยืนยันโดยชุมชนแล้ว ${verifiedCount.toLocaleString("th-TH")} ฉบับ`}{" "}
          (จากราชกิจจานุเบกษาและห้องสมุดกฎหมายกฤษฎีกา)
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <CopyCite citation={primaryEntry ? buildCitation(primaryEntry) : act.fullName} />
          {textEntry && (
            <Link
              href={`/doc/${textEntry.id}`}
              className="rounded bg-seal-700 text-white px-3 py-1.5 text-sm hover:bg-seal-800"
            >
              อ่านตัวบทฉบับเต็ม
            </Link>
          )}
          {sdkSlugFor(act) && (
            <Link
              href={`/act/${act.id}/sections`}
              className="rounded border border-seal-700 text-seal-800 px-3 py-1.5 text-sm hover:bg-seal-50"
            >
              ตัวบทรายมาตรา
            </Link>
          )}
          {primaryEntry &&
            (() => {
              const source = originalSource(primaryEntry);
              return (
                source && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm hover:bg-stone-700"
                  >
                    ต้นฉบับ · {source.label} ↗
                  </a>
                )
              );
            })()}
        </div>
      </header>

      <section className="rounded-lg border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="font-bold">
          แหล่งอ้างอิงทางการ{" "}
          <span className="text-sm font-normal text-stone-400">
            {act.sources.length.toLocaleString("th-TH")} แหล่ง
          </span>
        </h2>
        {act.sources.length === 0 && (
          <p className="text-sm text-stone-500">
            ยังไม่มีแหล่งอ้างอิง — ช่วยเพิ่มลิงก์ฉบับเต็ม/ฉบับปรับปรุงจากแหล่งทางการ เช่น
            สำนักงานคณะกรรมการกฤษฎีกา (krisdika.go.th), ระบบกลางทางกฎหมาย (law.go.th)
            เพื่อให้ผู้อื่นตรวจสอบความถูกต้องได้ง่ายขึ้น
          </p>
        )}
        {act.sources.length > 0 && (
          <ul className="space-y-2">
            {act.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-seal-800 hover:underline"
                >
                  {s.title} ↗
                </a>
                {isGovDomain(s.url) && (
                  <span className="rounded bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                    เว็บไซต์หน่วยงานรัฐ
                  </span>
                )}
                {s.publisher && <span className="text-stone-500">{s.publisher}</span>}
                <span className="text-xs text-stone-400">
                  เพิ่มโดย {s.contributor || "ไม่ระบุชื่อ"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-seal-700 hover:underline">
            + เสนอแหล่งอ้างอิง
          </summary>
          <form action={suggestSource} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="actId" value={act.id} />
            <input
              name="title"
              required
              placeholder="ชื่อแหล่ง เช่น ฉบับปรับปรุงล่าสุด (กฤษฎีกา) *"
              className="rounded border border-stone-300 p-2 text-sm"
            />
            <input
              name="url"
              type="url"
              required
              placeholder="https://... *"
              className="rounded border border-stone-300 p-2 text-sm"
            />
            <input
              name="publisher"
              placeholder="หน่วยงานผู้เผยแพร่ (ไม่บังคับ)"
              className="rounded border border-stone-300 p-2 text-sm"
            />
            <input
              name="contributor"
              placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
              className="rounded border border-stone-300 p-2 text-sm"
            />
            <button className="rounded bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-700 justify-self-start">
              ส่งเข้าคิวตรวจสอบ
            </button>
          </form>
        </details>
      </section>

      {/* geometric บรรพ index (สารบาญ visual language) for codes that have one */}
      {act.actType === "ประมวลกฎหมาย" && codeBooksFor(act.shortName) && (
        <BookIndex shortName={act.shortName} emblemName={act.fullName} docId={textEntry?.id} />
      )}

      {/* codes get the official OCS amendment history; other acts use the
          timeline derived from the gazette editions we hold */}
      {(() => {
        const codeTl = act.actType === "ประมวลกฎหมาย" ? codeTimelineFor(act.shortName) : null;
        return codeTl ? (
          <CodeTimeline data={codeTl} />
        ) : (
          <VersionTimeline
            primaries={primaries}
            repealedBy={act.status === "repealed" ? act.repealedBy : null}
          />
        );
      })()}

      {/* view toggle: type-grouped list ↔ word-tree by authorising section */}
      {subCount > 0 && (
        <div className="inline-flex rounded-lg border border-stone-300 bg-white p-1 text-sm">
          <Link
            href={`/act/${act.id}`}
            className={`rounded px-4 py-1.5 ${!treeView ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            รายการตามประเภท
          </Link>
          <Link
            href={`/act/${act.id}?view=tree`}
            className={`rounded px-4 py-1.5 ${treeView ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            ต้นไม้ตามมาตรา
          </Link>
        </div>
      )}

      {treeView && (
        <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 sm:p-8 overflow-x-auto">
          <p className="cat-code mb-4">AUTHORITY&nbsp;TREE&nbsp;·&nbsp;โครงสร้างสายอำนาจตามมาตรา</p>
          <SectionTree
            actName={act.fullName}
            actType={act.actType}
            entries={treeEntries}
            sectionsHref={sectionsHref}
          />
        </section>
      )}

      {!treeView && groups.size === 0 && (
        <p className="text-stone-500">
          ยังไม่มีประกาศที่เชื่อมโยงกับกฎหมายฉบับนี้ในช่วงข้อมูลที่มี
        </p>
      )}

      {!treeView && !filterType && groups.size > 1 && (
        <nav className="sticky top-0 z-10 -mx-4 border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur">
          <ul className="flex flex-wrap gap-2 text-sm">
            {orderedKeys.filter((k) => groups.has(k)).map((key) => (
              <li key={key}>
                <a
                  href={`#group-${key}`}
                  className="inline-block rounded-full border border-stone-300 bg-white px-3 py-1 text-stone-700 hover:border-seal-300 hover:text-seal-800"
                >
                  {GROUP_LABELS[key] ?? key}{" "}
                  <span className="text-stone-400">({(countByType.get(key) ?? 0).toLocaleString("th-TH")})</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {filterType && (
        <p className="text-sm">
          <Link href={`/act/${act.id}`} className="text-seal-700 hover:underline">
            ← กลับไปหน้ารวมทุกประเภท
          </Link>
        </p>
      )}

      {orderedKeys.filter((k) => groups.has(k)).map((key) => {
        const list = groups.get(key)!;
        const total = countByType.get(key) ?? list.length;
        const shownAll = filterType ? false : total <= PER_GROUP;
        return (
          <section key={key} id={`group-${key}`} className="scroll-mt-16">
            <h2 className="text-lg font-bold mb-3 flex items-baseline gap-2">
              <TypeGlyph type={key} size={13} className="self-center" />
              {GROUP_LABELS[key] ?? key}
              <span className="text-sm font-normal text-stone-400">
                {total.toLocaleString("th-TH")} ฉบับ
                {!shownAll && !filterType && ` · แสดง ${list.length} รายการล่าสุด`}
                {filterType && ` · หน้า ${page}/${Math.max(1, Math.ceil(total / PER_PAGE))}`}
              </span>
              {!shownAll && !filterType && (
                <Link
                  href={`/act/${act.id}?type=${encodeURIComponent(key)}`}
                  className="text-sm font-normal text-seal-700 hover:underline"
                >
                  ดูทั้งหมด →
                </Link>
              )}
            </h2>
            <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {list.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="font-medium leading-snug">
                        <Link href={`/entry/${e.id}`} className="hover:text-seal-700 hover:underline">
                          {e.title}
                        </Link>
                        {e.isAmendment && (
                          <span className="ml-2 inline-block rounded bg-seal-100 text-seal-800 text-xs px-1.5 py-0.5 align-middle">
                            ฉบับแก้ไข
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-stone-500">
                        {formatThaiDate(e.publishedAt)}
                        {e.volume > 0 && ` · เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category}${e.page > 0 ? ` หน้า ${e.page}` : ""}`}
                        {ORIGIN_LABELS[e.origin] && ` · ${ORIGIN_LABELS[e.origin]}`}
                      </div>
                      {e.legalBasis && (
                        <div>
                          <BasisChips legalBasis={e.legalBasis} sectionsHref={sectionsHref} />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <VerifyBadge status={e.verifyStatus} source={e.linkSource} />
                        <details className="text-xs">
                          <summary className="cursor-pointer text-stone-400 hover:text-stone-600 list-none">
                            ตรวจสอบความถูกต้อง
                          </summary>
                          <div className="mt-2 flex flex-wrap items-start gap-3">
                            {e.verifyStatus !== "verified" && (
                              <form action={confirmLink}>
                                <input type="hidden" name="entryId" value={e.id} />
                                <button className="text-xs text-green-700 hover:underline" title="ยืนยันว่าการเชื่อมโยงนี้ถูกต้อง">
                                  ✓ ยืนยันว่าถูกต้อง
                                </button>
                              </form>
                            )}
                            <details className="text-xs">
                              <summary className="cursor-pointer text-red-700 hover:underline list-none">
                                ⚠ แจ้งว่าไม่ถูกต้อง
                              </summary>
                              <form
                                action={disputeLink}
                                className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3 w-72"
                              >
                                <input type="hidden" name="entryId" value={e.id} />
                                <textarea
                                  name="reason"
                                  required
                                  placeholder="เหตุผล เช่น ออกตามกฎหมายฉบับอื่น..."
                                  className="w-full rounded border border-stone-300 p-2 text-sm"
                                  rows={2}
                                />
                                <input
                                  name="correctAct"
                                  placeholder="กฎหมายแม่บทที่ถูกต้อง (ถ้าทราบ)"
                                  className="w-full rounded border border-stone-300 p-2 text-sm"
                                />
                                <input
                                  name="contributor"
                                  placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
                                  className="w-full rounded border border-stone-300 p-2 text-sm"
                                />
                                <button className="rounded bg-red-700 text-white px-3 py-1.5">
                                  ส่งข้อโต้แย้ง
                                </button>
                              </form>
                            </details>
                          </div>
                        </details>
                      </div>
                    </div>
                    <EntryActions entry={e} />
                  </div>
                </li>
              ))}
            </ul>
            {filterType && (
              <div className="flex gap-2 justify-center text-sm mt-4">
                {page > 1 && (
                  <Link
                    href={`/act/${act.id}?type=${encodeURIComponent(key)}&page=${page - 1}`}
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100"
                  >
                    ← ก่อนหน้า
                  </Link>
                )}
                {page * PER_PAGE < total && (
                  <Link
                    href={`/act/${act.id}?type=${encodeURIComponent(key)}&page=${page + 1}`}
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100"
                  >
                    ถัดไป →
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 space-y-3">
        <h2 className="font-bold">พบกฎหมายลำดับรองที่ขาดหายไป?</h2>
        <p className="text-sm text-stone-500">
          แจ้งกฎกระทรวง ประกาศ หรือระเบียบที่ออกตามกฎหมายฉบับนี้แต่ไม่ปรากฏในรายการ
          ข้อเสนอจะเข้าคิวตรวจสอบก่อนแสดงผล
        </p>
        <form action={suggestEntry} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="actId" value={act.id} />
          <input
            name="title"
            required
            placeholder="ชื่อเต็มของกฎหมายลำดับรอง *"
            className="rounded border border-stone-300 p-2 text-sm sm:col-span-2"
          />
          <input
            name="pdfUrl"
            placeholder="ลิงก์ PDF ราชกิจจานุเบกษา (ถ้ามี)"
            className="rounded border border-stone-300 p-2 text-sm"
          />
          <input name="date" type="date" className="rounded border border-stone-300 p-2 text-sm" />
          <input
            name="contributor"
            placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
            className="rounded border border-stone-300 p-2 text-sm"
          />
          <button className="rounded bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-700">
            ส่งเข้าคิวตรวจสอบ
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          ความเห็น <span className="text-sm font-normal text-stone-400">{act.contributions.length}</span>
        </h2>
        {act.contributions.map((c) => (
          <div key={c.id} className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
            <div className="text-stone-700 whitespace-pre-wrap">{c.comment}</div>
            <div className="text-xs text-stone-400 mt-2">
              {c.contributor || "ไม่ระบุชื่อ"} · {formatThaiDate(c.createdAt)}
            </div>
          </div>
        ))}
        <form action={addComment} className="space-y-2">
          <input type="hidden" name="actId" value={act.id} />
          <textarea
            name="comment"
            required
            placeholder="ข้อสังเกตเกี่ยวกับกฎหมายฉบับนี้ เช่น สถานะการยกเลิก ความเชื่อมโยงที่ควรเพิ่ม..."
            className="w-full rounded border border-stone-300 p-3 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <input
              name="contributor"
              placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
              className="flex-1 rounded border border-stone-300 p-2 text-sm"
            />
            <button className="rounded bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-700">
              แสดงความเห็น
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
