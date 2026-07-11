import Link from "next/link";
import codeBooks from "@/data/code-books.json";
import { GeoShape, CodeEmblem } from "./geo-shape";

/**
 * The บรรพ index of a code, rendered in the สารบาญ geometric language: the code
 * emblem (triangle ตราช่าง) over each บรรพ drawn as an N-sided shape. Each shape
 * links into the full-text reader at that book's opening มาตรา.
 */

interface Book {
  book: number;
  topic: string;
  startSection: number;
  endSection: number;
}
interface CodeBooks {
  division: string; // "บรรพ"
  books: Book[];
}

const BOOKS = codeBooks as Record<string, CodeBooks>;

export function codeBooksFor(shortName: string): CodeBooks | null {
  return BOOKS[shortName] ?? null;
}

export function BookIndex({
  shortName,
  emblemName,
  docId,
}: {
  shortName: string;
  emblemName: string;
  docId?: number;
}) {
  const data = codeBooksFor(shortName);
  if (!data) return null;

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-6 sm:p-8">
      <p className="cat-code mb-6">โครงสร้าง&nbsp;{data.division}&nbsp;·&nbsp;GEOMETRIC&nbsp;INDEX</p>

      <div className="flex flex-col items-center gap-1">
        <CodeEmblem name={emblemName} size={172} />
        <span className="font-heading text-sm text-stone-500">ว่าด้วย</span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
        {data.books.map((b) => {
          // keep content inside each shape's widest band: ▽ is wide at the top,
          // ⬠ house is wide low, others read fine centred
          const zone =
            b.book === 3
              ? "justify-start pt-[25%] px-[4%]" // ▽ widest at top → text starts at the base
              : b.book === 2
                ? "px-[26%]"
                : b.book === 5
                  ? "justify-center pt-[10%] px-[16%]"
                  : "px-[18%]";
          // narrow shapes need a smaller topic; the inverted triangle is tightest
          const topicSize =
            b.book === 3 ? "text-sm" : b.book === 2 ? "text-base" : "text-lg sm:text-xl";
          const inner = (
            <GeoShape
              sides={b.book}
              size={190}
              contentClassName={zone}
              className="mx-auto transition-transform group-hover:scale-[1.03]"
            >
              <span className={`font-heading font-bold leading-tight ${topicSize}`}>{b.topic}</span>
              <span className="mt-1 font-[family-name:var(--font-mono)] text-[10px] tracking-wide opacity-90">
                ม.{b.startSection}–{b.endSection}
              </span>
              <span className="mt-1.5 font-heading text-sm italic">
                {data.division} {b.book}
              </span>
            </GeoShape>
          );
          return docId ? (
            <Link key={b.book} href={`/doc/${docId}#ม-${b.startSection}`} className="group block">
              {inner}
            </Link>
          ) : (
            <div key={b.book} className="group">{inner}</div>
          );
        })}
      </div>
    </section>
  );
}
