"use client";

import { useRouter } from "next/navigation";

export function BackLink({ fallbackHref, label = "← ย้อนกลับ" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        // same-origin referrer + real history to go back to (e.g. filtered search
        // results) — otherwise router.back() would just leave the site
        const hasLocalHistory =
          window.history.length > 1 &&
          document.referrer &&
          new URL(document.referrer).origin === window.location.origin;
        if (hasLocalHistory) router.back();
        else router.push(fallbackHref);
      }}
      className="hover:underline"
    >
      {label}
    </button>
  );
}
