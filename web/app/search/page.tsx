import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { EntryActions } from "@/app/components/entry-actions";
import { SearchBox } from "@/app/components/search-box";
import { searchActsRanked, searchEntries } from "@/lib/search";
import { Breadcrumbs } from "@/app/components/breadcrumbs";

export const dynamic = "force-dynamic";

const ENTRY_TYPE_FILTERS = [
  "พระราชบัญญัติ",
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "คำสั่ง",
];

const ACT_TYPES = [
  "พระราชบัญญัติ",
  "พระราชกำหนด",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "ประมวลกฎหมาย",
  "รัฐธรรมนูญ",
];

const PER_PAGE = 25;

function baseUrl(scope: string, q: string, type: string) {
  return `/search?scope=${scope}&q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const scope = sp.scope === "acts" ? "acts" : "entries";
  const type = (sp.type ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "ค้นหา" }]} backFallback="/" />
      <h1 className="text-2xl font-bold">ค้นหา</h1>

      <div className="max-w-2xl">
        <SearchBox initialQuery={query} scope={scope} autoFocus />
      </div>

      <div className="inline-flex rounded-lg border border-stone-300 bg-white p-1 text-sm">
        <Link
          href={baseUrl("acts", query, "")}
          className={`rounded px-4 py-1.5 ${scope === "acts" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          กฎหมายแม่บท
        </Link>
        <Link
          href={baseUrl("entries", query, "")}
          className={`rounded px-4 py-1.5 ${scope === "entries" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          กฎหมายลำดับรอง
        </Link>
      </div>

      {scope === "acts" ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={baseUrl("acts", query, "")}
            className={`rounded-full border px-3 py-1 ${!type ? "border-seal-500 bg-seal-50 text-seal-800" : "border-stone-300 bg-white hover:bg-stone-50"}`}
          >
            ทุกประเภท
          </Link>
          {ACT_TYPES.map((t) => (
            <Link
              key={t}
              href={baseUrl("acts", query, t)}
              className={`rounded-full border px-3 py-1 ${type === t ? "border-seal-500 bg-seal-50 text-seal-800" : "border-stone-300 bg-white hover:bg-stone-50"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={baseUrl("entries", query, "")}
            className={`rounded-full border px-3 py-1 ${!type ? "border-seal-500 bg-seal-50 text-seal-800" : "border-stone-300 bg-white hover:bg-stone-50"}`}
          >
            ทุกประเภท
          </Link>
          {ENTRY_TYPE_FILTERS.map((t) => (
            <Link
              key={t}
              href={baseUrl("entries", query, t)}
              className={`rounded-full border px-3 py-1 ${type === t ? "border-seal-500 bg-seal-50 text-seal-800" : "border-stone-300 bg-white hover:bg-stone-50"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      {scope === "acts" ? (
        <ActsResults query={query} actType={type} page={page} />
      ) : (
        <EntriesResults query={query} instrumentType={type} page={page} />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  urlFor,
}: {
  page: number;
  totalPages: number;
  urlFor: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex gap-2 justify-center text-sm">
      {page > 1 && (
        <Link href={urlFor(page - 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
          ← ก่อนหน้า
        </Link>
      )}
      {page < totalPages && (
        <Link href={urlFor(page + 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
          ถัดไป →
        </Link>
      )}
    </div>
  );
}

async function ActsResults({
  query,
  actType,
  page,
}: {
  query: string;
  actType: string;
  page: number;
}) {
  if (!query && !actType) {
    return (
      <p className="text-sm text-stone-500">
        พิมพ์คำค้นเพื่อค้นหากฎหมายแม่บท หรือ{" "}
        <Link href="/acts" className="text-seal-700 hover:underline">
          ดูทะเบียนกฎหมายแม่บททั้งหมด →
        </Link>
      </p>
    );
  }

  // with a query: relevance-ranked (multi-keyword AND + shorthand aliases);
  // type-only browsing keeps simple DB pagination
  let total: number;
  let acts: Awaited<ReturnType<typeof searchActsRanked>>;
  let ranked = false;
  if (query) {
    const all = await searchActsRanked(query, actType || null);
    total = all.length;
    acts = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    ranked = true;
  } else {
    const where = { actType };
    [total, acts] = await Promise.all([
      prisma.act.count({ where }),
      prisma.act.findMany({
        where,
        include: { _count: { select: { entries: true } } },
        orderBy: { entries: { _count: "desc" } },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
    ]);
  }
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageUrl = (p: number) => `${baseUrl("acts", query, actType)}&page=${p}`;

  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">
        พบ {total.toLocaleString("th-TH")} รายการ
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        {ranked && " · เรียงตามความเกี่ยวข้อง"}
      </p>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {acts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/act/${a.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-seal-50"
            >
              <span className="font-medium leading-snug">{a.fullName}</span>
              <span className="shrink-0 text-sm text-stone-500">
                {a._count.entries.toLocaleString("th-TH")} ฉบับ
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={totalPages} urlFor={pageUrl} />
    </section>
  );
}

async function EntriesResults({
  query,
  instrumentType,
  page,
}: {
  query: string;
  instrumentType: string;
  page: number;
}) {
  if (!query && !instrumentType) {
    return (
      <p className="text-sm text-stone-500">
        พิมพ์คำค้นเพื่อค้นหากฎหมายลำดับรอง หรือ{" "}
        <Link href="/entries" className="text-seal-700 hover:underline">
          ดูทะเบียนกฎหมายลำดับรองทั้งหมด →
        </Link>
      </p>
    );
  }

  // relevance-ranked (multi-keyword AND + legal-weight scoring)
  const result = await searchEntries(query, instrumentType || null);
  const total = result.total;
  const entries = result.entries.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageUrl = (p: number) => `${baseUrl("entries", query, instrumentType)}&page=${p}`;

  return (
    <section className="space-y-3">
      <p className="text-sm text-stone-500">
        พบ {total.toLocaleString("th-TH")} รายการ
        {result.capped && "ขึ้นไป (แสดงเฉพาะที่เกี่ยวข้องที่สุด)"}
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        {query && " · เรียงตามความเกี่ยวข้อง"}
      </p>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {entries.map((e) => (
          <li key={e.id} className="p-4 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <Link href={`/entry/${e.id}`} className="font-medium leading-snug hover:text-seal-700">
                {e.title}
              </Link>
              <EntryActions entry={e} />
            </div>
            <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
              <span>{formatThaiDate(e.publishedAt)}</span>
              {e.volume > 0 && (
                <span>
                  เล่ม {e.volume} ตอนที่ {e.issue} {e.category}
                </span>
              )}
              {e.origin === "krisdika" && <span>ห้องสมุดกฎหมายกฤษฎีกา</span>}
              {e.origin === "pdpc" && <span>เว็บไซต์ สคส. (PDPC)</span>}
              {e.act && (
                <Link href={`/act/${e.act.id}`} className="text-seal-700 hover:underline">
                  ↳ {e.act.fullName}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={totalPages} urlFor={pageUrl} />
    </section>
  );
}
