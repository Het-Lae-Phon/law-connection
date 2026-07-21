import type { Metadata } from "next";
import { Noto_Sans_Thai_Looped, IBM_Plex_Mono, Noto_Serif_Thai } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// body / content — a looped Thai (ตัวกลม) from Google, per the สารบาญ system
const bodyThai = Noto_Sans_Thai_Looped({
  variable: "--font-body-thai",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

// heading fallback until the Adobe "Bree Thai Variable" kit is wired in
// (see --font-heading in globals.css); Bree is not on Google Fonts.
const headingFallback = Noto_Serif_Thai({
  variable: "--font-serif-thai",
  weight: ["500", "600", "700"],
  subsets: ["thai", "latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "สารบาญ Sarabaan — ดัชนีอ้างอิงกฎหมายไทยและกฎหมายลำดับรอง",
  description:
    "สารบาญ: ค้นพระราชบัญญัติและกฎหมายลำดับรอง (กฎกระทรวง ประกาศ ระเบียบ) ที่เชื่อมโยงถึงกัน คัดลอกการอ้างอิงที่ถูกต้อง แล้วไปที่ต้นฉบับ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${bodyThai.variable} ${headingFallback.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* To enable the Bree Thai Variable heading font, add your Adobe Fonts
          web-project kit here:
          <link rel="stylesheet" href="https://use.typekit.net/<KIT_ID>.css" />
          then --font-heading (globals.css) picks it up automatically. */}
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body-thai)] bg-[#fafaf8] text-stone-900">
        {/* hairline metallic strip — the obi band of the printed edition */}
        <div className="label-metal h-1.5" aria-hidden />
        <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              <span className="label-metal text-white px-2.5 py-1 font-[family-name:var(--font-serif-thai)] font-semibold text-lg leading-none [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
                สารบาญ
              </span>
              <span className="hidden sm:inline font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.25em] text-stone-400 uppercase group-hover:text-stone-600">
                Sarabaan
              </span>
            </Link>
            {/* inline header search (kept from the UX redesign) */}
            <form action="/search" className="order-3 relative w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-xs">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                name="q"
                placeholder="ค้นหากฎหมาย..."
                className="w-full rounded-md border border-stone-300 bg-stone-50 pl-8 pr-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-seal-600"
              />
            </form>
            <nav className="flex gap-5 text-sm text-stone-500">
              <Link href="/acts" className="hover:text-stone-900">
                กฎหมายแม่บท
              </Link>
              <Link href="/entries" className="hover:text-stone-900">
                กฎหมายลำดับรอง
              </Link>
              <Link href="/community" className="hover:text-stone-900">
                การตรวจสอบโดยชุมชน
              </Link>
            </nav>
          </div>
        </header>
        <div className="bg-stone-100 border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-4 py-2 text-[13px] text-stone-600 leading-relaxed">
            <span className="font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.2em] uppercase text-stone-400 mr-2">
              Notice
            </span>
            การจัดหมวดหมู่และการเชื่อมโยงในเว็บไซต์นี้<b className="text-stone-800">สร้างโดย AI อัตโนมัติ</b>{" "}
            อาจมีข้อผิดพลาดหรือตกหล่น — โปรดตรวจสอบกับเอกสารต้นฉบับก่อนใช้อ้างอิง หากท่านเป็นนักกฎหมาย{" "}
            <Link href="/community" className="underline font-medium text-seal-700 hover:text-seal-800">
              ช่วยเรายืนยันความถูกต้องได้ที่นี่
            </Link>
          </div>
        </div>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-stone-500 space-y-2">
            <p className="font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.25em] uppercase text-stone-400">
              สารบาญ · Sarabaan — Thai Law Reference Index
            </p>
            <p>
              ข้อมูลจาก{" "}
              <a href="https://ratchakitcha.soc.go.th" className="underline">
                ราชกิจจานุเบกษา
              </a>{" "}
              ผ่านชุดข้อมูลเปิดของสำนักเลขาธิการคณะรัฐมนตรี (
              <a href="https://data.go.th/dataset/dataset_02_04" className="underline">
                data.go.th
              </a>
              ) — ต้นแบบสาธิต การเชื่อมโยงสร้างโดย AI อัตโนมัติและอาจผิดพลาด โปรดตรวจสอบกับเอกสารต้นฉบับก่อนใช้อ้างอิง
              ทุกการเชื่อมโยงแสดงที่มา และเปิดให้ชุมชนตรวจสอบแก้ไขได้
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
