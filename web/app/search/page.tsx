import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { EntryActions } from "@/app/components/entry-actions";

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
      <h1 className="text-2xl font-bold">ค้นหา</h1>

      <form className="space-y-3">
        <input type="hidden" name="scope" value={scope} />
        <div className="flex max-w-2xl gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="ค้นหากฎหมายแม่บทหรือกฎหมายลำดับรอง..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="rounded-lg bg-slate-900 text-white px-6 py-2.5 hover:bg-slate-700">
            ค้นหา
          </button>
        </div>
      </form>

      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
        <Link
          href={baseUrl("acts", query, "")}
          className={`rounded px-4 py-1.5 ${scope === "acts" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          กฎหมายแม่บท
        </Link>
        <Link
          href={baseUrl("entries", query, "")}
          className={`rounded px-4 py-1.5 ${scope === "entries" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          กฎหมายลำดับรอง
        </Link>
      </div>

      {scope === "acts" ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={baseUrl("acts", query, "")}
            className={`rounded-full border px-3 py-1 ${!type ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            ทุกประเภท
          </Link>
          {ACT_TYPES.map((t) => (
            <Link
              key={t}
              href={baseUrl("acts", query, t)}
              className={`rounded-full border px-3 py-1 ${type === t ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={baseUrl("entries", query, "")}
            className={`rounded-full border px-3 py-1 ${!type ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            ทุกประเภท
          </Link>
          {ENTRY_TYPE_FILTERS.map((t) => (
            <Link
              key={t}
              href={baseUrl("entries", query, t)}
              className={`rounded-full border px-3 py-1 ${type === t ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
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
      <p className="text-sm text-slate-500">
        พิมพ์คำค้นเพื่อค้นหากฎหมายแม่บท หรือ{" "}
        <Link href="/acts" className="text-amber-700 hover:underline">
          ดูทะเบียนกฎหมายแม่บททั้งหมด →
        </Link>
      </p>
    );
  }

  const where = {
    ...(query ? { fullName: { contains: query } } : {}),
    ...(actType ? { actType } : {}),
  };
  const [total, acts] = await Promise.all([
    prisma.act.count({ where }),
    prisma.act.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { entries: { _count: "desc" } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageUrl = (p: number) => `${baseUrl("acts", query, actType)}&page=${p}`;

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-500">
        พบ {total.toLocaleString("th-TH")} รายการ
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
      </p>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {acts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/act/${a.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-amber-50"
            >
              <span className="font-medium leading-snug">{a.fullName}</span>
              <span className="shrink-0 text-sm text-slate-500">
                {a._count.entries.toLocaleString("th-TH")} ฉบับ
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center text-sm">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
              ถัดไป →
            </Link>
          )}
        </div>
      )}
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
      <p className="text-sm text-slate-500">
        พิมพ์คำค้นเพื่อค้นหากฎหมายลำดับรอง หรือ{" "}
        <Link href="/entries" className="text-amber-700 hover:underline">
          ดูทะเบียนกฎหมายลำดับรองทั้งหมด →
        </Link>
      </p>
    );
  }

  const where = {
    ...(query ? { title: { contains: query } } : {}),
    ...(instrumentType ? { instrumentType } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.gazetteEntry.count({ where }),
    prisma.gazetteEntry.findMany({
      where,
      include: { act: true },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const pageUrl = (p: number) => `${baseUrl("entries", query, instrumentType)}&page=${p}`;

  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-500">
        พบ {total.toLocaleString("th-TH")} รายการ
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
      </p>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {entries.map((e) => (
          <li key={e.id} className="p-4 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div className="font-medium leading-snug">
                <Link href={`/entry/${e.id}`} className="hover:text-amber-700 hover:underline">
                  {e.title}
                </Link>
              </div>
              <EntryActions entry={e} />
            </div>
            <div className="text-sm text-slate-500 flex flex-wrap gap-x-3">
              <span>{formatThaiDate(e.publishedAt)}</span>
              {e.volume > 0 && (
                <span>
                  เล่ม {e.volume} ตอนที่ {e.issue} {e.category}
                </span>
              )}
              {e.origin === "krisdika" && <span>ห้องสมุดกฎหมายกฤษฎีกา</span>}
              {e.origin === "pdpc" && <span>เว็บไซต์ สคส. (PDPC)</span>}
              {e.act && (
                <Link href={`/act/${e.act.id}`} className="text-amber-700 hover:underline">
                  ↳ {e.act.fullName}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center text-sm">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
              ถัดไป →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
