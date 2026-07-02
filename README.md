# กฎหมายเชื่อมโยง — Thai Law Portal

ต้นแบบ (prototype) ฐานข้อมูลกฎหมายไทยที่**เชื่อมโยงกฎหมายลำดับรอง** (กฎกระทรวง ประกาศ ระเบียบ ข้อบังคับ ฯลฯ) เข้ากับกฎหมายแม่บทโดยอัตโนมัติ — แก้ pain point ของระบบค้นหากฎหมายปัจจุบัน (เช่น ocs.go.th) ที่แสดงเฉพาะตัวพระราชบัญญัติแต่ไม่แสดงอนุบัญญัติที่ออกตามความในกฎหมายนั้น

A prototype Thai legal database that automatically links subordinate legislation to its parent act, built from Royal Gazette (ราชกิจจานุเบกษา) open data.

## Product scope — two purposes only

1. **Reference the relevant law** — find an act and every instrument issued under it, and copy a
   correct legal citation (ชื่อเต็ม + ราชกิจจานุเบกษา เล่ม/ตอน/หน้า/วันที่).
2. **Guide to the original source** — every entry leads to its authoritative original: the gazette
   PDF, the regulator's page, or (when no public link exists) the formal gazette citation plus
   where to look. Our stored copies are convenience fallbacks, always clearly labeled as such.

Features are judged against these two purposes; anything else is out of scope.

## How it works

```
data.go.th Royal Gazette API (monthly JSON, ~4.5k entries/month)
        │  scripts: download → data/raw/*.json
        ▼
ingest.ts   — parse, dedupe, classify instrument type from title,
              link sub-regulations whose titles cite the parent act
              ("...ออกตามความในพระราชบัญญัติ X พ.ศ. YYYY")
        ▼
enrich.ts   — for section ก instruments with no link: download the PDF,
              read the preamble ("อาศัยอำนาจตามความใน...แห่งพระราชบัญญัติ X"),
              falling back to Apple Vision OCR (ocr.swift) because most
              gazette PDFs have broken embedded font encodings
        ▼
SQLite (Prisma) → Next.js UI: act pages with grouped sub-regulation
                  trees, Thai full-title search, PDF links
```

Key finding: the act registry doesn't need to be curated — it **emerges from the citations themselves**. Every sub-regulation names its parent act; parsing ~1,500 section ก documents yielded 300+ acts automatically.

## Running it

```bash
cd web
npm install
npx prisma migrate dev            # creates SQLite db

# download gazette data (see manifest in data/raw or re-fetch from
# https://data.go.th/dataset/dataset_02_04)
npx tsx scripts/ingest.ts         # ~130k entries, title-based linking
swiftc -O scripts/ocr.swift -o scripts/ocr   # macOS only
npx tsx scripts/enrich.ts         # PDF/OCR preamble linking (~30 min)

npm run dev
```

The Prisma schema is Postgres-compatible — change `provider` in `web/prisma/schema.prisma` and set `DATABASE_URL` to deploy.

## Community verification (Wikipedia model)

Machine links are a starting point, not the truth. Every link carries a
provenance badge (⚙ auto from title / auto from PDF preamble, ✓ community-verified,
⚠ disputed) and the site accepts contributions without an account:

- confirm / dispute any link (immediate effect, fully audited)
- report missing sub-regulations on an act's page
- report missing acts and leave talk-page comments
- `/community` — public moderation queue and decision history

See CONTRIBUTING.md — including the auth caveats to fix before public deployment.

## Data sources

- [Royal Gazette open dataset](https://data.go.th/dataset/dataset_02_04) — Office of the Secretary to the Cabinet, monthly JSON, June 2566 onward (title, volume, issue, section, page, PDF link)
- PDFs served from [ratchakitcha.soc.go.th](https://ratchakitcha.soc.go.th)
- [PyThaiNLP thailaw-v1.0](https://huggingface.co/datasets/pythainlp/thailaw-v1.0) — full text of ~52k documents
  from the Krisdika/OCS law library (public domain under the Thai Copyright Act), including regulator
  instruments (SEC, ministries) going back decades. Because it is full text, parent-act citations are
  extracted directly from preambles — no OCR needed. Import via
  `scripts/process-thailaw.py` → `scripts/import-thailaw.ts` (dedupes against gazette entries by
  normalized title; entries carry `origin: "krisdika"`). The dataset has no per-document URLs, so
  the full text itself is stored (`scripts/backfill-doctext.py` → `DocumentText` table, ~800MB in
  SQLite) and served at `/doc/[id]` — entries without an external link show an
  "อ่านฉบับเต็ม" button instead of a PDF link. External deep links to OCS/Krisdika were attempted
  and rolled back twice: the old `krisdika.go.th/librarian` scheme is dead, and the current
  searchlaw.ocs.go.th app encrypts its route parameters (plain document-id links fail with
  PDL_CIPHER_EXCEPTION). Revisit when OCS provides a public API or shareable permalinks.

## Known limitations / roadmap

- **Gazette feed starts June 2566**; historical coverage comes from the Krisdika library import (thailaw),
  which reaches back decades but is a snapshot — a production pipeline should also ingest the
  [Open Law Data Thailand](https://www.openlawdatathailand.org/) archive (1.3M gazette docs from 2428 on Hugging Face)
  and law.go.th (currently behind CloudFront bot protection; needs an official API request).
- **One parent act per entry** — some instruments are issued under multiple acts; schema should move to many-to-many.
- **No repeal/amendment state tracking** — "(ฉบับที่ n)" amendments are flagged, but ยกเลิก (repeal) chains aren't resolved into an "in force" status yet.
- **~5% of PDFs fail both text extraction and OCR** (image quality); a production pipeline would retry with higher DPI or a cloud OCR.
- **Search is substring-based** — fine at this scale; Meilisearch/Typesense would give proper Thai tokenization and typo tolerance.
- **Court decisions (คำพิพากษา/คำวินิจฉัย) are not linked** — different citation structure.

## Disclaimer / คำชี้แจง

**การเชื่อมโยงและการจัดหมวดหมู่ทั้งหมดสร้างโดย AI อัตโนมัติ** อาจมีข้อผิดพลาดหรือตกหล่น
โปรดตรวจสอบกับเอกสารต้นฉบับในราชกิจจานุเบกษาก่อนใช้อ้างอิงทางกฎหมายเสมอ —
และหากท่านเป็นนักกฎหมาย โปรดช่วยยืนยันความถูกต้องผ่านหน้า "การตรวจสอบโดยชุมชน"

All links and classifications are **AI-generated** and may contain errors. Always
verify against the original gazette PDF before legal use — and if you're a lawyer,
please help verify through the community review page. A site-wide banner communicates
this to every visitor, and each link shows its provenance badge until human-verified.
