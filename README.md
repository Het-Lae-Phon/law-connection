# กฎหมายเชื่อมโยง — Thai Law Portal

ต้นแบบ (prototype) ฐานข้อมูลกฎหมายไทยที่**เชื่อมโยงกฎหมายลำดับรอง** (กฎกระทรวง ประกาศ ระเบียบ ข้อบังคับ ฯลฯ) เข้ากับกฎหมายแม่บทโดยอัตโนมัติ — แก้ pain point ของระบบค้นหากฎหมายปัจจุบัน (เช่น ocs.go.th) ที่แสดงเฉพาะตัวพระราชบัญญัติแต่ไม่แสดงอนุบัญญัติที่ออกตามความในกฎหมายนั้น

A prototype Thai legal database that automatically links subordinate legislation to its parent act, built from Royal Gazette (ราชกิจจานุเบกษา) open data.

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

## Data sources

- [Royal Gazette open dataset](https://data.go.th/dataset/dataset_02_04) — Office of the Secretary to the Cabinet, monthly JSON, June 2566 onward (title, volume, issue, section, page, PDF link)
- PDFs served from [ratchakitcha.soc.go.th](https://ratchakitcha.soc.go.th)

## Known limitations / roadmap

- **Coverage starts June 2566** — the open dataset's beginning. Historical backfill would need scraping Ratchakitcha's search (Excel export) or a data request to the Cabinet Secretariat.
- **One parent act per entry** — some instruments are issued under multiple acts; schema should move to many-to-many.
- **No repeal/amendment state tracking** — "(ฉบับที่ n)" amendments are flagged, but ยกเลิก (repeal) chains aren't resolved into an "in force" status yet.
- **~5% of PDFs fail both text extraction and OCR** (image quality); a production pipeline would retry with higher DPI or a cloud OCR.
- **Search is substring-based** — fine at this scale; Meilisearch/Typesense would give proper Thai tokenization and typo tolerance.
- **Court decisions (คำพิพากษา/คำวินิจฉัย) are not linked** — different citation structure.

## Attribution

Prototype demo. Links are machine-generated — always verify against the original gazette PDF before legal use.
