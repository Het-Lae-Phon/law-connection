import Link from "next/link";
import codeBooks from "@/data/code-books.json";

/**
 * The บรรพ (Book) index of a code — e.g. ประมวลกฎหมายแพ่งและพาณิชย์'s 6 บรรพ.
 * Each book links into the full-text reader at its opening มาตรา.
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
  docId,
}: {
  shortName: string;
  docId?: number;
}) {
  const data = codeBooksFor(shortName);
  if (!data) return null;

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-6 sm:p-8">
      <p className="cat-code mb-6">โครงสร้าง&nbsp;{data.division}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.books.map((b) => {
          const inner = (
            <div className="flex h-full flex-col gap-1 border border-dashed border-stone-300 p-4 transition-colors group-hover:border-seal-400 group-hover:bg-seal-50/30">
              <span className="cat-code">
                {data.division} {b.book}
              </span>
              <span className="font-heading text-lg font-bold leading-snug">{b.topic}</span>
              <span className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-stone-400">
                ม.{b.startSection}–{b.endSection}
              </span>
            </div>
          );
          return docId ? (
            <Link key={b.book} href={`/doc/${docId}#ม-${b.startSection}`} className="group block">
              {inner}
            </Link>
          ) : (
            <div key={b.book} className="group">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
