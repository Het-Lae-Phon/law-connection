#!/usr/bin/env python3
"""Generate data/act-sections-data.js for the legal word tree.

Reads the law-connection sqlite database (DocumentText of the PDPA act and its
royal decrees) and emits per-มาตรา nodes plus an instrument-type listing of all
sub-regulations linked to Act 299.

Usage:
    python3 scripts/build-sections.py \
        [--db /path/to/dev.db] \
        [--decree2566-text /path/to/ocr.txt] \
        [--out data/act-sections-data.js]

The 2566 royal decree has no text in the database; pass OCR output for it
(e.g. from thai-law-portal's scripts/ocr Vision tool) to include its มาตรา.
"""

import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ACT_ID = 299
PDPA_ENTRY_ID = 246539      # พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (full text)
DECREE_2563_ENTRY_ID = 278248

TH_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
TH_MONTHS_ABBR = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

# OCR page-header noise (ratchakitcha page furniture)
HEADER_RE = re.compile(r"^(เล่ม\s*[๐-๙0-9]+|หน้า\s*[๐-๙0-9]*|ราชกิจจานุเบกษา|"
                       r"[๐-๙0-9]+\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|"
                       r"กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*[๐-๙0-9]+)\s*$")

# a line opening a มาตรา; tolerates OCR quirks seen in the corpus:
#   "มาตรา ึ๗๑ ..." (stray sara ue), "มาตรา๕ ..." (no space), "มาติรา ๓ ...",
#   "มาตรา ๑ด ..." (๑๑ with second ๑ read as ด),
#   "หมวด ๕๑ ..." / "หมวด ๙๖ ..." (มาตรา misread as หมวด — real chapter
#   numbers in these documents never exceed ๗)
SECTION_RE = re.compile(r"^(?:มาตรา|มาตรำ|มาติรา)\s*ึ?\s*([๐-๙0-9]+[ด]?)\s*(.*)$")
MISREAD_RE = re.compile(r"^หมวด\s*([๐-๙0-9]{2,})\s+(.*)$")
CHAPTER_RE = re.compile(r"^หมวด\s*([๐-๙0-9])\s*(.*)$")
PART_RE = re.compile(r"^ส่วน(?:ที่)?\s*([๐-๙0-9]+)\s*(.*)$")
TRANSITORY_RE = re.compile(r"^บทเฉพาะกาล")
END_RE = re.compile(r"^(ผู้รับสนองพระบรมราชโองการ|หมายเหตุ)")


def th_int(s: str) -> int:
    return int(s.replace("ด", "๑").translate(TH_DIGITS))


def clean_lines(text: str):
    out = []
    pending = None  # lone "มาตรา" line waiting for its number on the next line
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or HEADER_RE.match(line):
            continue
        if pending is not None:
            line = pending + " " + line
            pending = None
        if line in ("มาตรา", "มาตรำ"):
            pending = "มาตรา"
            continue
        out.append(line)
    return out


def parse_sections(text: str):
    """Split a Thai statute text into structural events.

    Yields ('chapter', num, title) / ('part', num, title) /
    ('transitory',) / ('section', num, body) / ('end',)
    """
    events = []
    current = None  # [num, [body lines]]

    def flush():
        nonlocal current
        if current:
            body = re.sub(r"\s+", " ", " ".join(current[1])).strip()
            events.append(("section", current[0], body))
            current = None

    for line in clean_lines(text):
        if END_RE.match(line):
            flush()
            events.append(("end",))
            break
        m = SECTION_RE.match(line) or MISREAD_RE.match(line)
        if m:
            flush()
            current = [th_int(m.group(1)), [m.group(2)]]
            continue
        m = CHAPTER_RE.match(line)
        # a real chapter heading carries a short title with no further
        # หมวด/มาตรา tokens (unlike body lines that happen to wrap onto a
        # line starting with "หมวด ๕ หมวด ๖ ...")
        if m and not re.search(r"หมวด|มาตรา", m.group(2)):
            flush()
            events.append(("chapter", th_int(m.group(1)), m.group(2).strip()))
            continue
        m = PART_RE.match(line)
        if m:
            flush()
            events.append(("part", th_int(m.group(1)), m.group(2).strip()))
            continue
        if TRANSITORY_RE.match(line):
            flush()
            events.append(("transitory",))
            continue
        if current is not None:
            current[1].append(line)
    flush()
    return events


def build_act_structure(text: str):
    """Nested chapters → parts → มาตรา nodes for the PDPA."""
    root = {
        "name": "โครงสร้างพระราชบัญญัติ (มาตรา 1–96)",
        "type": "chapter",
        "detail": "เนื้อหารายมาตราของ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 "
                  "ทั้ง 96 มาตรา จัดตามหมวดและส่วนของกฎหมาย "
                  "(ข้อความสกัดจากต้นฉบับด้วย OCR — โปรดตรวจกับราชกิจจานุเบกษาก่อนอ้างอิง)",
        "children": [],
    }
    general = {"name": "บททั่วไป (มาตรา 1–7)", "type": "chapter", "children": []}
    root["children"].append(general)
    container = general
    chapter = None

    for ev in parse_sections(text):
        kind = ev[0]
        if kind == "chapter":
            chapter = {"name": f"หมวด {ev[1]} {ev[2]}".strip(), "type": "chapter", "children": []}
            root["children"].append(chapter)
            container = chapter
        elif kind == "part":
            part = {"name": f"ส่วนที่ {ev[1]} {ev[2]}".strip(), "type": "chapter", "children": []}
            chapter["children"].append(part)
            container = part
        elif kind == "transitory":
            chapter = {"name": "บทเฉพาะกาล (มาตรา 91–96)", "type": "chapter", "children": []}
            root["children"].append(chapter)
            container = chapter
        elif kind == "section":
            num, body = ev[1], ev[2]
            container["children"].append({
                "name": f"มาตรา {num}",
                "type": "provision",
                "detail": body,
            })
        elif kind == "end":
            break

    # annotate มาตรา ranges on chapter labels that don't carry them yet
    for ch in root["children"]:
        nums = [int(n["name"].split()[1]) for n in _walk_provisions(ch)]
        if nums and "มาตรา" not in ch["name"]:
            ch["name"] += f" (มาตรา {min(nums)}–{max(nums)})"
    return root


def _walk_provisions(node):
    for c in node.get("children", []):
        if c.get("type") == "provision":
            yield c
        else:
            yield from _walk_provisions(c)


def build_decree_sections(text: str):
    nodes = []
    for ev in parse_sections(text):
        if ev[0] == "section":
            nodes.append({
                "name": f"มาตรา {ev[1]}",
                "type": "provision",
                "detail": ev[2],
            })
        elif ev[0] == "end":
            break
    return nodes


def th_date(ms):
    if not ms:
        return None
    d = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return f"{d.day} {TH_MONTHS_ABBR[d.month]} {d.year + 543}"


def entry_links(pdf_url: str):
    if pdf_url.startswith("thailaw:"):
        return [{"label": f"ดูในระบบ ({pdf_url})",
                 "url": f"http://localhost:3000/doc/{pdf_url.split(':', 1)[1]}"}]
    if pdf_url.startswith("http"):
        host = "ราชกิจจานุเบกษา" if "ratchakitcha" in pdf_url else "เว็บไซต์ สคส. (PDPC)"
        return [{"label": f"PDF {host}", "url": pdf_url}]
    return []


def build_by_type(db: sqlite3.Connection):
    rows = db.execute(
        "SELECT title, instrumentType, publishedAt, volume, issue, page, pdfUrl "
        "FROM GazetteEntry WHERE actId = ? AND isPrimary = 0 "
        "ORDER BY instrumentType, publishedAt", (ACT_ID,)).fetchall()
    groups = {}
    for title, itype, published, volume, issue, page, pdf_url in rows:
        detail = title
        cite = []
        if volume:
            cite.append(f"ราชกิจจานุเบกษา เล่ม {volume} ตอนที่ {issue} หน้า {page}")
        if published:
            cite.append(th_date(published))
        if cite:
            detail += " · " + " · ".join(cite)
        groups.setdefault(itype or "อื่น ๆ", []).append({
            "name": (title[:88] + "…") if len(title) > 90 else title,
            "type": "subreg",
            "detail": detail,
            "links": entry_links(pdf_url),
        })
    branch = {
        "name": "กฎหมายลำดับรองตามประเภท",
        "type": "theme",
        "detail": "กฎหมายลำดับรองทุกฉบับที่เชื่อมโยงกับ พ.ร.บ. ในระบบ จัดกลุ่มตามประเภทของกฎหมาย "
                  "(มุมมองเดียวกับหน้า /act/299 ของระบบ — รายการเดียวกับที่กระจายอยู่ในกิ่งหัวข้อ)",
        "children": [],
    }
    for itype in ["พระราชกฤษฎีกา", "ประกาศ", "ระเบียบ"]:
        if itype in groups:
            branch["children"].append({
                "name": f"{itype} ({len(groups[itype])} ฉบับ)",
                "type": "decree" if itype == "พระราชกฤษฎีกา" else "subreg",
                "children": groups.pop(itype),
            })
    for itype, items in groups.items():
        branch["children"].append({"name": f"{itype} ({len(items)} ฉบับ)",
                                   "type": "subreg", "children": items})
    return branch


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="/Users/baipoh/thai-law-portal/web/prisma/dev.db")
    ap.add_argument("--decree2566-text", default=None,
                    help="OCR text of the 2566 royal decree (not in the database)")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent
                                         / "data" / "act-sections-data.js"))
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    act_text = db.execute("SELECT text FROM DocumentText WHERE entryId = ?",
                          (PDPA_ENTRY_ID,)).fetchone()[0]
    decree63_text = db.execute("SELECT text FROM DocumentText WHERE entryId = ?",
                               (DECREE_2563_ENTRY_ID,)).fetchone()[0]

    payload = {
        "actStructure": build_act_structure(act_text),
        "decreeSections": {
            "decree-2563": build_decree_sections(decree63_text),
        },
        "byType": build_by_type(db),
    }
    if args.decree2566_text:
        text_2566 = Path(args.decree2566_text).read_text()
        payload["decreeSections"]["decree-2566"] = build_decree_sections(text_2566)

    n_act = len(list(_walk_provisions(payload["actStructure"])))
    out = Path(args.out)
    out.write_text(
        "// generated by scripts/build-sections.py — do not edit by hand\n"
        "// source: law-connection DocumentText (Act 299) + Vision OCR of gazette PDFs\n"
        "window.ACT_SECTIONS = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n")
    counts = {k: len(v) for k, v in payload["decreeSections"].items()}
    print(f"act มาตรา: {n_act}, decrees: {counts}, "
          f"types: {[c['name'] for c in payload['byType']['children']]} → {out}")


if __name__ == "__main__":
    main()
