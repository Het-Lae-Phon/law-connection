import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "กฎหมายเชื่อมโยง — ฐานข้อมูลกฎหมายไทยพร้อมกฎหมายลำดับรอง",
  description:
    "ค้นหาพระราชบัญญัติและกฎหมายลำดับรอง (กฎกระทรวง ประกาศ ระเบียบ) ที่เชื่อมโยงถึงกัน จากข้อมูลราชกิจจานุเบกษา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-noto-thai)] bg-slate-50 text-slate-900">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-baseline justify-between gap-4 flex-wrap">
            <Link href="/" className="text-xl font-bold tracking-tight">
              กฎหมาย<span className="text-amber-400">เชื่อมโยง</span>
            </Link>
            <nav className="flex gap-5 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">
                หน้าแรก
              </Link>
              <Link href="/acts" className="hover:text-white">
                กฎหมายแม่บททั้งหมด
              </Link>
              <Link href="/search" className="hover:text-white">
                ค้นหา
              </Link>
              <Link href="/community" className="hover:text-white">
                การตรวจสอบโดยชุมชน
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500 space-y-1">
            <p>
              ข้อมูลจาก{" "}
              <a href="https://ratchakitcha.soc.go.th" className="underline">
                ราชกิจจานุเบกษา
              </a>{" "}
              ผ่านชุดข้อมูลเปิดของสำนักเลขาธิการคณะรัฐมนตรี (
              <a href="https://data.go.th/dataset/dataset_02_04" className="underline">
                data.go.th
              </a>
              ) — ต้นแบบสาธิต การเชื่อมโยงกฎหมายลำดับรองสร้างขึ้นอัตโนมัติ โปรดตรวจสอบกับเอกสารต้นฉบับก่อนใช้อ้างอิง
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
