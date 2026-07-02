"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function clean(s: FormDataEntryValue | null, max = 2000): string {
  return String(s ?? "").trim().slice(0, max);
}

// ✓ "link is correct" — takes effect immediately, recorded for audit
export async function confirmLink(formData: FormData) {
  const entryId = parseInt(clean(formData.get("entryId")), 10);
  if (isNaN(entryId)) return;
  const entry = await prisma.gazetteEntry.findUnique({ where: { id: entryId } });
  if (!entry?.actId) return;
  await prisma.$transaction([
    prisma.contribution.create({
      data: {
        type: "confirm_link",
        status: "applied",
        entryId,
        actId: entry.actId,
        contributor: clean(formData.get("contributor"), 120) || null,
        reviewedAt: new Date(),
      },
    }),
    prisma.gazetteEntry.update({
      where: { id: entryId },
      // a dispute outweighs confirmations until a moderator resolves it
      data: entry.verifyStatus === "disputed" ? {} : { verifyStatus: "verified" },
    }),
  ]);
  revalidatePath(`/act/${entry.actId}`);
  revalidatePath(`/entry/${entryId}`);
}

// ⚠ "link is wrong" — flags immediately, queued for moderator resolution
export async function disputeLink(formData: FormData) {
  const entryId = parseInt(clean(formData.get("entryId")), 10);
  const reason = clean(formData.get("reason"));
  if (isNaN(entryId) || !reason) return;
  const entry = await prisma.gazetteEntry.findUnique({ where: { id: entryId } });
  if (!entry) return;
  await prisma.$transaction([
    prisma.contribution.create({
      data: {
        type: "dispute_link",
        status: "pending",
        entryId,
        actId: entry.actId,
        payload: JSON.stringify({ reason, correctAct: clean(formData.get("correctAct"), 300) }),
        contributor: clean(formData.get("contributor"), 120) || null,
      },
    }),
    prisma.gazetteEntry.update({ where: { id: entryId }, data: { verifyStatus: "disputed" } }),
  ]);
  if (entry.actId) revalidatePath(`/act/${entry.actId}`);
  revalidatePath(`/entry/${entryId}`);
  revalidatePath("/community");
}

// Talk-page style comment on an act — visible immediately
export async function addComment(formData: FormData) {
  const actId = parseInt(clean(formData.get("actId")), 10);
  const text = clean(formData.get("comment"));
  if (isNaN(actId) || !text) return;
  await prisma.contribution.create({
    data: {
      type: "comment",
      status: "applied",
      actId,
      comment: text,
      contributor: clean(formData.get("contributor"), 120) || null,
    },
  });
  revalidatePath(`/act/${actId}`);
}

// "this act is missing a sub-regulation" — queued for moderation
export async function suggestEntry(formData: FormData) {
  const actId = parseInt(clean(formData.get("actId")), 10);
  const title = clean(formData.get("title"), 500);
  if (isNaN(actId) || !title) return;
  await prisma.contribution.create({
    data: {
      type: "suggest_entry",
      status: "pending",
      actId,
      payload: JSON.stringify({
        title,
        pdfUrl: clean(formData.get("pdfUrl"), 500),
        date: clean(formData.get("date"), 20),
      }),
      contributor: clean(formData.get("contributor"), 120) || null,
    },
  });
  revalidatePath(`/act/${actId}`);
  revalidatePath("/community");
}

// "here is an authoritative reference for this act" — queued for moderation
export async function suggestSource(formData: FormData) {
  const actId = parseInt(clean(formData.get("actId")), 10);
  const title = clean(formData.get("title"), 300);
  const url = clean(formData.get("url"), 500);
  if (isNaN(actId) || !title || !/^https?:\/\//i.test(url)) return;
  await prisma.contribution.create({
    data: {
      type: "suggest_source",
      status: "pending",
      actId,
      payload: JSON.stringify({
        title,
        url,
        publisher: clean(formData.get("publisher"), 200),
      }),
      contributor: clean(formData.get("contributor"), 120) || null,
    },
  });
  revalidatePath(`/act/${actId}`);
  revalidatePath("/community");
}

// "an act is missing from the registry" — queued for moderation
export async function suggestAct(formData: FormData) {
  const fullName = clean(formData.get("fullName"), 300);
  if (!fullName) return;
  await prisma.contribution.create({
    data: {
      type: "suggest_act",
      status: "pending",
      payload: JSON.stringify({ fullName, note: clean(formData.get("note")) }),
      contributor: clean(formData.get("contributor"), 120) || null,
    },
  });
  revalidatePath("/community");
}

const INSTRUMENT_PREFIXES = [
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "กฎ",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "ข้อกำหนด",
  "คำสั่ง",
];

// Moderator decision. Prototype has no auth — see README before deploying.
export async function moderate(formData: FormData) {
  const id = parseInt(clean(formData.get("id")), 10);
  const decision = clean(formData.get("decision"), 10); // approve | reject
  if (isNaN(id) || !["approve", "reject"].includes(decision)) return;
  const c = await prisma.contribution.findUnique({ where: { id } });
  if (!c || c.status !== "pending") return;

  if (decision === "reject") {
    await prisma.contribution.update({
      where: { id },
      data: { status: "rejected", reviewedAt: new Date() },
    });
    // a rejected dispute restores the machine link status
    if (c.type === "dispute_link" && c.entryId) {
      await prisma.gazetteEntry.update({
        where: { id: c.entryId },
        data: { verifyStatus: "machine" },
      });
    }
  } else {
    if (c.type === "dispute_link" && c.entryId) {
      // approved dispute = link was wrong: detach it
      await prisma.gazetteEntry.update({
        where: { id: c.entryId },
        data: { actId: null, linkSource: null, verifyStatus: "machine" },
      });
    } else if (c.type === "suggest_entry" && c.actId && c.payload) {
      const p = JSON.parse(c.payload) as { title: string; pdfUrl?: string; date?: string };
      const instrumentType =
        INSTRUMENT_PREFIXES.find((t) => p.title.startsWith(t)) ?? null;
      const publishedAt = p.date && !isNaN(Date.parse(p.date)) ? new Date(p.date) : new Date();
      const data = {
        title: p.title,
        publishedAt,
        volume: 0,
        issue: "",
        category: "ชุมชน",
        page: 0,
        instrumentType,
        actId: c.actId,
        linkSource: "community",
        verifyStatus: "verified",
      };
      if (p.pdfUrl) {
        await prisma.gazetteEntry.upsert({
          where: { pdfUrl: p.pdfUrl },
          create: { ...data, pdfUrl: p.pdfUrl },
          // entry already in gazette data — just attach the link
          update: { actId: c.actId, linkSource: "community", verifyStatus: "verified" },
        });
      } else {
        await prisma.gazetteEntry.create({
          data: { ...data, pdfUrl: `community:${id}` },
        });
      }
    } else if (c.type === "suggest_source" && c.actId && c.payload) {
      const p = JSON.parse(c.payload) as { title: string; url: string; publisher?: string };
      await prisma.source.upsert({
        where: { actId_url: { actId: c.actId, url: p.url } },
        create: {
          actId: c.actId,
          title: p.title,
          url: p.url,
          publisher: p.publisher || null,
          contributor: c.contributor,
        },
        update: { title: p.title, publisher: p.publisher || null },
      });
    } else if (c.type === "suggest_act" && c.payload) {
      const p = JSON.parse(c.payload) as { fullName: string };
      const m = p.fullName.match(
        /^(พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด|ประมวลกฎหมาย|ประมวล|รัฐธรรมนูญ)(.*?)(?:พ\.ศ\.\s*(\d{4}))?$/
      );
      const actType = m?.[1] ?? "พระราชบัญญัติ";
      const shortName = (m?.[2] ?? p.fullName).trim() || p.fullName;
      const year = m?.[3] ? parseInt(m[3], 10) : null;
      await prisma.act.create({
        data: {
          slug: `community-${id}-${shortName}`.replace(/\s+/g, "-"),
          actType,
          shortName,
          year,
          fullName: p.fullName,
        },
      });
    }
    await prisma.contribution.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date() },
    });
  }
  revalidatePath("/community");
  if (c.actId) revalidatePath(`/act/${c.actId}`);
}
