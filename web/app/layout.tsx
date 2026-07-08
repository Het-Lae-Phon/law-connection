import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono, Noto_Serif_Thai } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

const serifThai = Noto_Serif_Thai({
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
      className={`${plexThai.variable} ${serifThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-plex-thai)] bg-[#fafaf8] text-stone-900">
        {/* hairline metallic strip — the obi band of the printed edition */}
        <div className="label-metal h-1.5" aria-hidden />
        <header className="bg-white border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="label-metal text-white px-2.5 py-1 font-[family-name:var(--font-serif-thai)] font-semibold text-lg leading-none [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
                สารบาญ
              </span>
              <span className="font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.25em] text-stone-400 uppercase group-hover:text-stone-600">
                Sarabaan · Thai Law Index
              </span>
            </Link>
            <nav className="flex gap-5 text-sm text-stone-500">
              <Link href="/" className="hover:text-stone-900">
                หน้าแรก
              </Link>
              <Link href="/acts" className="hover:text-stone-900">
                กฎหมายแม่บท
              </Link>
              <Link href="/search" className="hover:text-stone-900">
                ค้นหา
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
