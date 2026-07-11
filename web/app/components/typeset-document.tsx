import { Sarabun } from "next/font/google";
import { typesetLegalText, type Block } from "@/lib/typeset";

// The Royal Gazette is typeset in TH Sarabun — use its Google-hosted sibling
// so the reference copy reads like the printed original.
const sarabun = Sarabun({
  weight: ["400", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
});

function DocBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "title":
      return (
        <div className="text-center font-bold text-[1.35em] leading-relaxed pb-3">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          <div className="mx-auto mt-4 w-40 border-b border-stone-800" />
        </div>
      );
    case "meta":
      return (
        <div className="text-center text-[1.1em] leading-loose">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "heading":
      return (
        <div className="text-center font-bold pt-4 leading-loose">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "sign":
      return (
        <div className="text-center leading-loose pt-2">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "note":
      return (
        <div className="text-sm text-stone-400 leading-relaxed">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    default:
      return <p className="text-justify indent-12 leading-loose m-0">{block.lines.join(" ")}</p>;
  }
}

export function TypesetDocument({ text }: { text: string }) {
  const blocks = typesetLegalText(text);
  const bodyBlocks = blocks.filter((b) => b.kind !== "note");
  const noteBlocks = blocks.filter((b) => b.kind === "note");

  return (
    <div className="space-y-3">
      <p className="text-sm text-seal-800">
        ⚠️ ข้อความด้านล่างเป็น<b>สำเนาเพื่อความสะดวกในการอ้างอิง</b> (แปลงจากต้นฉบับด้วยเครื่อง
        อาจมีคลาดเคลื่อน) — การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับเป็นสำคัญ
      </p>
      <article
        className={`${sarabun.className} rounded-lg border border-stone-200 bg-white px-6 py-10 sm:px-16 sm:py-14 text-[17px] text-stone-900 space-y-4`}
      >
        {bodyBlocks.map((b, i) => (
          <DocBlock key={i} block={b} />
        ))}
        {noteBlocks.length > 0 && (
          <div className="mt-10 border-t border-stone-200 pt-4 space-y-2">
            {noteBlocks.map((b, i) => (
              <DocBlock key={i} block={b} />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
