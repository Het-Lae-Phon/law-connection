import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { moderate, suggestAct } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  confirm_link: "ยืนยันการเชื่อมโยง",
  dispute_link: "โต้แย้งการเชื่อมโยง",
  comment: "ความเห็น",
  suggest_entry: "แจ้งกฎหมายลำดับรองที่ขาด",
  suggest_act: "แจ้งกฎหมายแม่บทที่ขาด",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจสอบ",
  applied: "มีผลแล้ว",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่รับ",
};

function Payload({ payload }: { payload: string | null }) {
  if (!payload) return null;
  let data: Record<string, string>;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  const labels: Record<string, string> = {
    reason: "เหตุผล",
    correctAct: "กฎหมายที่ถูกต้อง",
    title: "ชื่อเรื่อง",
    pdfUrl: "ลิงก์ PDF",
    date: "วันที่",
    fullName: "ชื่อกฎหมาย",
    note: "หมายเหตุ",
  };
  return (
    <dl className="text-sm text-slate-600 space-y-0.5">
      {Object.entries(data)
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt className="inline font-medium">{labels[k] ?? k}: </dt>
            <dd className="inline break-all">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export default async function CommunityPage() {
  const [pending, recent, stats] = await Promise.all([
    prisma.contribution.findMany({
      where: { status: "pending" },
      include: { act: true, entry: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contribution.findMany({
      where: { status: { not: "pending" } },
      include: { act: true, entry: true },
      orderBy: { reviewedAt: "desc" },
      take: 20,
    }),
    prisma.contribution.groupBy({ by: ["type"], _count: true }),
  ]);

  // For suggested entries whose PDF URL already exists in the gazette data,
  // surface the existing record so the moderator can spot mismatched URLs
  // before approving (approval would attach the link to that record).
  const suggestedUrls = pending
    .filter((c) => c.type === "suggest_entry" && c.payload)
    .map((c) => {
      try {
        return (JSON.parse(c.payload!) as { pdfUrl?: string }).pdfUrl ?? "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const existingByUrl = new Map(
    (
      await prisma.gazetteEntry.findMany({
        where: { pdfUrl: { in: suggestedUrls } },
        select: { pdfUrl: true, title: true },
      })
    ).map((e) => [e.pdfUrl, e.title])
  );
  const existingFor = (c: (typeof pending)[number]): string | null => {
    if (c.type !== "suggest_entry" || !c.payload) return null;
    try {
      const url = (JSON.parse(c.payload) as { pdfUrl?: string }).pdfUrl;
      return url ? (existingByUrl.get(url) ?? null) : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">การตรวจสอบโดยชุมชน</h1>
        <p className="text-slate-600 text-sm max-w-3xl">
          การเชื่อมโยงกฎหมายลำดับรองในระบบนี้สร้างขึ้นอัตโนมัติ ชุมชนนักกฎหมายช่วยกันยืนยัน โต้แย้ง
          และเติมข้อมูลที่ขาด ทุกการเปลี่ยนแปลงถูกบันทึกไว้ตรวจสอบย้อนหลังได้
          (หน้านี้เป็นต้นแบบ — ระบบจริงต้องมีบัญชีผู้ใช้และสิทธิ์ผู้ตรวจ)
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          {stats.map((s) => (
            <span key={s.type}>
              <b className="text-slate-900">{s._count.toLocaleString("th-TH")}</b>{" "}
              {TYPE_LABELS[s.type] ?? s.type}
            </span>
          ))}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          คิวรอตรวจสอบ{" "}
          <span className="text-sm font-normal text-slate-400">{pending.length} รายการ</span>
        </h2>
        {pending.length === 0 && <p className="text-slate-500 text-sm">ไม่มีรายการค้าง</p>}
        {pending.map((c) => (
          <div key={c.id} className="rounded-lg border border-amber-300 bg-white p-4 space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5">
                {TYPE_LABELS[c.type] ?? c.type}
              </span>
              <span className="text-xs text-slate-400">
                #{c.id} · {c.contributor || "ไม่ระบุชื่อ"} · {formatThaiDate(c.createdAt)}
              </span>
            </div>
            {c.entry && (
              <div className="text-sm">
                <span className="text-slate-500">รายการ: </span>
                {c.entry.title}
              </div>
            )}
            {c.act && (
              <div className="text-sm">
                <span className="text-slate-500">กฎหมายแม่บท: </span>
                <Link href={`/act/${c.act.id}`} className="text-amber-700 hover:underline">
                  {c.act.fullName}
                </Link>
              </div>
            )}
            <Payload payload={c.payload} />
            {existingFor(c) && (
              <div className="rounded border border-orange-200 bg-orange-50 p-2 text-sm text-orange-900">
                ⚠ ลิงก์ PDF นี้มีอยู่ในระบบแล้วในชื่อ: <b>{existingFor(c)}</b> —
                หากชื่อไม่ตรงกับที่แจ้ง โปรดตรวจสอบก่อนอนุมัติ (การอนุมัติจะเชื่อมรายการเดิมเข้ากับกฎหมายแม่บท)
              </div>
            )}
            {c.comment && <div className="text-sm text-slate-700">{c.comment}</div>}
            <div className="flex gap-2 pt-1">
              <form action={moderate}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="decision" value="approve" />
                <button className="rounded bg-green-700 text-white px-3 py-1.5 text-sm hover:bg-green-800">
                  อนุมัติ
                </button>
              </form>
              <form action={moderate}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="decision" value="reject" />
                <button className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                  ไม่รับ
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 space-y-3">
        <h2 className="font-bold">แจ้งกฎหมายแม่บทที่ยังไม่มีในทะเบียน</h2>
        <form action={suggestAct} className="grid gap-2 sm:grid-cols-2">
          <input
            name="fullName"
            required
            placeholder="เช่น พระราชบัญญัติ... พ.ศ. 25xx *"
            className="rounded border border-slate-300 p-2 text-sm sm:col-span-2"
          />
          <input
            name="note"
            placeholder="หมายเหตุ (ไม่บังคับ)"
            className="rounded border border-slate-300 p-2 text-sm"
          />
          <input
            name="contributor"
            placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
            className="rounded border border-slate-300 p-2 text-sm"
          />
          <button className="rounded bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-700 sm:col-span-2 justify-self-start">
            ส่งเข้าคิวตรวจสอบ
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">ประวัติการตัดสินล่าสุด</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
          {recent.map((c) => (
            <li key={c.id} className="p-3 flex flex-wrap items-baseline gap-2">
              <span
                className={`rounded text-xs px-1.5 py-0.5 ${
                  c.status === "rejected"
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {STATUS_LABELS[c.status]}
              </span>
              <span>{TYPE_LABELS[c.type] ?? c.type}</span>
              {c.entry && <span className="text-slate-500 truncate max-w-md">{c.entry.title}</span>}
              {c.act && !c.entry && <span className="text-slate-500 truncate max-w-md">{c.act.fullName}</span>}
              <span className="text-xs text-slate-400 ml-auto">
                #{c.id} · {c.reviewedAt ? formatThaiDate(c.reviewedAt) : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
