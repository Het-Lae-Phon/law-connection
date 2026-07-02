# Contributing / การมีส่วนร่วม

โครงการนี้เปิดกว้างแบบวิกิพีเดีย: การเชื่อมโยงกฎหมายลำดับรองสร้างโดยระบบอัตโนมัติ
และอาศัยชุมชนนักกฎหมายช่วยตรวจสอบให้ถูกต้อง

## Ways to contribute

**Through the website (no coding needed)**
- ✓ ยืนยันการเชื่อมโยงที่ถูกต้อง (confirm a machine-generated link) — takes effect immediately, recorded in the audit log
- ⚠ โต้แย้งการเชื่อมโยงที่ผิด (dispute a wrong link) — flags it immediately, queued for moderator resolution
- แจ้งกฎหมายลำดับรอง/กฎหมายแม่บทที่ขาด (report missing laws) — queued for review
- แสดงความเห็นบนหน้ากฎหมาย (talk-page style comments)

Every contribution is stored in the `Contribution` table with type, payload,
contributor, timestamps, and review status — nothing is silently overwritten.

**Through code**
- Improve the linking heuristics in `web/scripts/ingest.ts` / `web/scripts/enrich.ts`
- Historical backfill (pre-June 2566 gazette data)
- The roadmap items in README.md

## Prototype caveats (read before deploying publicly)

- **No authentication yet.** The moderation queue at `/community` is open to
  everyone. Before public deployment this needs accounts and a reviewer role —
  ideally with verified-lawyer status (e.g. Lawyers Council / บัตรทนายความ) for
  verification actions to carry weight.
- **No rate limiting / spam protection** on the contribution forms.
- Re-running `scripts/ingest.ts` refuses to wipe data once contributions exist
  (`--force` to override — you will lose community links).

## Licensing

- Code: MIT (see LICENSE)
- Gazette source data: Thai government public information (data.go.th / ราชกิจจานุเบกษา)
- Community-contributed links, verifications, and comments: CC BY-SA 4.0
