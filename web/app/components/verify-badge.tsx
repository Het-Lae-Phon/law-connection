const SOURCE_LABELS: Record<string, string> = {
  pdf: "จากเนื้อหา PDF",
  title: "จากชื่อเรื่อง",
  text: "จากเนื้อหากฎหมาย",
  regulator: "จากเว็บไซต์หน่วยงานกำกับดูแล",
};

export function VerifyBadge({ status, source }: { status: string; source: string | null }) {
  if (status === "verified")
    return (
      <span className="inline-block rounded bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
        ✓ ยืนยันโดยชุมชนแล้ว
      </span>
    );
  if (status === "disputed")
    return (
      <span className="inline-block rounded bg-red-100 text-red-800 text-xs px-1.5 py-0.5">
        ⚠ มีข้อโต้แย้ง — รอตรวจสอบ
      </span>
    );
  const how = (source && SOURCE_LABELS[source]) || "";
  return (
    <span
      className="inline-block rounded bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5"
      title="สร้างโดยระบบ ยังไม่ได้รับการยืนยันโดยผู้เชี่ยวชาญ"
    >
      ⚙ เชื่อมโยงอัตโนมัติ{how && ` (${how})`}
    </span>
  );
}
