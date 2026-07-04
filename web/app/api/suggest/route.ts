import { NextRequest, NextResponse } from "next/server";
import { searchActs, searchEntries } from "@/lib/search";

export const dynamic = "force-dynamic";

// Live suggestions while typing: matching acts first (the usual target),
// then the most relevant individual documents.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ acts: [], entries: [] });

  const [acts, result] = await Promise.all([
    searchActs(q, 4),
    searchEntries(q, null),
  ]);

  return NextResponse.json({
    acts: acts.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      count: (a as { _count?: { entries: number } })._count?.entries ?? 0,
    })),
    entries: result.entries.slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title,
      // best destination for this suggestion
      url: e.actId ? `/act/${e.actId}` : e.origin === "krisdika" ? `/doc/${e.id}` : `/search?q=${encodeURIComponent(e.title.slice(0, 80))}`,
      actName: e.act?.shortName ?? null,
    })),
  });
}
