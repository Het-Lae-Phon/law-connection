"use client";

import { useState } from "react";

export function CopyCite({ citation, small }: { citation: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        let ok = false;
        try {
          await navigator.clipboard.writeText(citation);
          ok = true;
        } catch {
          // permission denied / non-secure context — legacy path
          const ta = document.createElement("textarea");
          ta.value = citation;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            ok = document.execCommand("copy");
          } finally {
            ta.remove();
          }
        }
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          window.prompt("คัดลอกการอ้างอิง:", citation);
        }
      }}
      className={
        small
          ? "text-xs text-slate-500 hover:text-slate-800 hover:underline"
          : "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
      }
      title={citation}
    >
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอกการอ้างอิง"}
    </button>
  );
}
