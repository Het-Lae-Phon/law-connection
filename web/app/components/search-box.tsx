"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ActHit {
  id: number;
  fullName: string;
  count: number;
}
interface EntryHit {
  id: number;
  title: string;
  url: string;
  actName: string | null;
}

/**
 * Search input with live suggestions (debounced). Submitting still performs a
 * normal GET to /search, so it works without JavaScript too.
 */
export function SearchBox({
  initialQuery = "",
  type = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [acts, setActs] = useState<ActHit[]>([]);
  const [entries, setEntries] = useState<EntryHit[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setActs([]);
      setEntries([]);
      setOpen(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (seq.current !== mySeq) return; // stale response
        setActs(data.acts ?? []);
        setEntries(data.entries ?? []);
        setOpen((data.acts?.length ?? 0) + (data.entries?.length ?? 0) > 0);
      } catch {
        /* suggestions are best-effort */
      } finally {
        if (seq.current === mySeq) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative flex-1">
      <form action="/search" className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => (acts.length + entries.length > 0) && setOpen(true)}
            placeholder="เช่น คุ้มครองข้อมูลส่วนบุคคล, พรบ คอมพิวเตอร์, ภาษี ที่ดิน..."
            autoFocus={autoFocus}
            autoComplete="off"
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-seal-500"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -transtone-y-1/2 text-xs text-stone-400">
              กำลังค้น…
            </span>
          )}
        </div>
        {type && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="rounded-lg bg-stone-900 text-white px-6 py-2.5 hover:bg-stone-700">
          ค้นหา
        </button>
      </form>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg text-left overflow-hidden">
          {acts.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-400">
                กฎหมายแม่บท
              </div>
              {acts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => router.push(`/act/${a.id}`)}
                  className="block w-full text-left px-3 py-2 hover:bg-seal-50"
                >
                  <span className="font-medium">{a.fullName}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {a.count.toLocaleString("th-TH")} ฉบับ
                  </span>
                </button>
              ))}
            </div>
          )}
          {entries.length > 0 && (
            <div className="border-t border-stone-100">
              <div className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-400">
                เอกสารที่เกี่ยวข้อง
              </div>
              {entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onMouseDown={() => router.push(e.url)}
                  className="block w-full text-left px-3 py-2 hover:bg-seal-50"
                >
                  <div className="text-sm leading-snug line-clamp-2">{e.title}</div>
                  {e.actName && (
                    <div className="text-xs text-seal-700">↳ {e.actName}</div>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onMouseDown={() => router.push(`/search?q=${encodeURIComponent(q)}${type ? `&type=${encodeURIComponent(type)}` : ""}`)}
            className="block w-full text-left px-3 py-2 border-t border-stone-100 text-sm text-stone-600 hover:bg-stone-50"
          >
            ดูผลการค้นหาทั้งหมดสำหรับ “{q}” →
          </button>
        </div>
      )}
    </div>
  );
}
