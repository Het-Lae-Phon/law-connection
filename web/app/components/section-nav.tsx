"use client";

import { useState } from "react";

/**
 * มาตรา navigation for the full-text reader: a sticky strip with a
 * jump-to-มาตรา box (accepts Thai or Arabic digits, e.g. "๑๑๒", "112",
 * "22/1") and the act's structure headings (ภาค/ลักษณะ/หมวด) as chips that
 * scroll to each division's first section.
 */

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const arabic = (s: string) =>
  s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));

export interface ChapterLink {
  label: string;
  anchor: string; // e.g. "ม-437"
}

export function SectionNav({
  numbers,
  chapters,
}: {
  /** arabic section numbers that exist in the document */
  numbers: string[];
  chapters: ChapterLink[];
}) {
  const [value, setValue] = useState("");
  const [missing, setMissing] = useState(false);

  const jump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = arabic(value.trim().replace(/^มาตรา\s*/, "")).replace(/\s+/g, " ");
    if (!num) return;
    // exact first, then base-number fallback ("3" when "3 ทวิ" was typed away)
    const target = numbers.includes(num)
      ? num
      : numbers.find((n) => n === num.split(" ")[0]);
    if (!target) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const el = document.getElementById(`ม-${target}`);
    if (el) {
      history.replaceState(null, "", `#ม-${target}`);
      el.scrollIntoView({ block: "start" });
    }
  };

  return (
    <nav className="sticky top-0 z-10 -mx-4 border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={jump} className="flex items-center gap-1.5 text-sm">
          <label htmlFor="sec-jump" className="cat-code shrink-0">
            ไปที่มาตรา
          </label>
          <input
            id="sec-jump"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMissing(false);
            }}
            placeholder="เช่น ๑๑๒ หรือ 22/1"
            className={`w-28 rounded border px-2 py-1 text-sm ${missing ? "border-seal-600 bg-seal-50" : "border-stone-300 bg-white"}`}
          />
          <button className="rounded bg-stone-900 px-2.5 py-1 text-sm text-white hover:bg-stone-700">
            ไป
          </button>
          {missing && <span className="text-xs text-seal-700">ไม่พบมาตรานี้</span>}
        </form>
        {chapters.length > 0 && (
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:thin]">
            {chapters.map((c) => (
              <a
                key={c.anchor + c.label}
                href={`#${c.anchor}`}
                className="shrink-0 rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs text-stone-600 hover:border-seal-300 hover:text-seal-800"
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
