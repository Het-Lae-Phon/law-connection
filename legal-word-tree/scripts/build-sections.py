#!/usr/bin/env python3
"""Generate data/act-sections-data.js for the legal word tree.

Reads the law-connection sqlite database (DocumentText of the PDPA act and its
royal decrees) and emits the act's own structure — หมวด/ส่วน → มาตรา → วรรค →
อนุมาตรา (๑)(๒)… — plus an instrument-type listing of all sub-regulations
linked to Act 299.

Two parse modes:
  * block mode — thailaw texts separate paragraphs with blank lines and join
    wrapped lines with spaces, so each วรรค / item is one block.
  * line mode — Vision-OCR texts (gazette PDFs) are visual lines with no
    paragraph signal, so มาตรา bodies are kept whole (no วรรค split).

Usage:
    python3 scripts/build-sections.py \
        [--db /path/to/dev.db] \
        [--decree2566-text /path/to/ocr.txt] \
        [--out data/act-sections-data.js]
"""

import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ACT_ID = 299
PDPA_ENTRY_ID = 246539      # พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (thailaw text)
DECREE_2563_ENTRY_ID = 278248  # พ.ร.ฎ. 2563 (thailaw text)

TH_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
TH_MONTHS_ABBR = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
TH_ORDINALS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด",
               "เก้า", "สิบ", "สิบเอ็ด", "สิบสอง"]

LABEL_LEN = 32  # max chars of body text shown in a node label

# OCR page-header noise (ratchakitcha page furniture)
HEADER_RE = re.compile(r"^(เล่ม\s*[๐-๙0-9]+|หน้า\s*[๐-๙0-9]*|ราชกิจจานุเบกษา|"
                       r"[๐-๙0-9]+\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|"
                       r"กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*[๐-๙0-9]+)\s*$")

# a block/line opening a มาตรา; tolerates OCR quirks seen in the corpus:
#   "มาตรา ึ๗๑ ..." (stray sara ue), "มาตรา๕ ..." (no space), "มาติรา ๓ ...",
#   "มาตรา ๑ด ..." (๑๑ with second ๑ read as ด),
#   "หมวด ๕๑ ..." / "หมวด ๙๖ ..." (มาตรา misread as หมวด — real chapter
#   numbers in these documents never exceed ๗)
SECTION_RE = re.compile(r"^(?:มาตรา|มาตรำ|มาติรา)\s*ึ?\s*([๐-๙0-9]+[ด]?)\s*(.*)$", re.S)
MISREAD_RE = re.compile(r"^หมวด\s*([๐-๙0-9]{2,})\s+(.*)$", re.S)
CHAPTER_RE = re.compile(r"^หมวด\s*([๐-๙0-9])\s*(.*)$", re.S)
PART_RE = re.compile(r"^ส่วน(?:ที่)?\s*([๐-๙0-9]+)\s*(.*)$", re.S)
ITEM_RE = re.compile(r"^\(([๐-๙0-9]+)\)\s*(.*)$", re.S)
SUBITEM_RE = re.compile(r"^\(([ก-ฮ])\)\s*(.*)$", re.S)
DEFINITION_RE = re.compile(r"^[“\"]\s*([^”\"]+)[”\"]\s*หมายความว่า", re.S)
TRANSITORY_RE = re.compile(r"^บทเฉพาะกาล\s*-?\s*(.*)$", re.S)
END_RE = re.compile(r"^(ผู้รับสนองพระบรมราชโองการ|หมายเหตุ)")


def th_int(s: str) -> int:
    return int(s.replace("ด", "๑").translate(TH_DIGITS))


def ordinal(n: int) -> str:
    return TH_ORDINALS[n] if n < len(TH_ORDINALS) else str(n)


def snippet(text: str, limit: int = LABEL_LEN) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "…"


def blocks_of(text: str):
    """Paragraph blocks of a thailaw text (blank-line separated)."""
    out = []
    for raw in re.split(r"\n\s*\n", text):
        b = re.sub(r"\s+", " ", raw).strip()
        if b and not HEADER_RE.match(b):
            out.append(b)
    return out


def lines_of(text: str):
    """Cleaned visual lines of an OCR text; merges lone 'มาตรา' with the
    number on the following line."""
    out, pending = [], None
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or HEADER_RE.match(line):
            continue
        if pending is not None:
            line = pending + " " + line
            pending = None
        if line in ("มาตรา", "มาตรำ", "มาติรา"):
            pending = "มาตรา"
            continue
        out.append(line)
    return out


def is_chapter(m, body_rest: str) -> bool:
    # a real chapter heading carries a short title with no further
    # หมวด/มาตรา tokens (unlike body text wrapping onto "หมวด ๕ หมวด ๖ ...")
    return bool(m) and not re.search(r"หมวด|มาตรา", body_rest)


def parse_statute(units, split_paragraphs: bool):
    """Turn text units (blocks or lines) into structural events.

    ('chapter', num, title) / ('part', num, title) / ('transitory',) /
    ('section', num, [para, ...]) / ('end',)
    In block mode each unit after a มาตรา opener is one วรรค / อนุมาตรา;
    in line mode the whole body collapses into a single paragraph.
    """
    events = []
    current = None  # [num, [paragraphs]]

    def flush():
        nonlocal current
        if current:
            paras = current[1] if split_paragraphs else [" ".join(current[1])]
            events.append(("section", current[0], [p.strip() for p in paras if p.strip()]))
            current = None

    def open_section(m):
        nonlocal current
        flush()
        rest = m.group(2)
        # the source sometimes doubles the marker ("มาตรา ๓๗ มาตรา ๓๗ ผู้ควบคุม…")
        rest = re.sub(r"^(?:มาตรา|มาตรำ|มาติรา)\s*ึ?\s*[๐-๙0-9ด]+\s*", "", rest, count=1)
        current = [th_int(m.group(1)), [rest]]

    for unit in units:
        if END_RE.match(unit):
            flush()
            events.append(("end",))
            break
        m = TRANSITORY_RE.match(unit)
        if m:
            flush()
            events.append(("transitory",))
            # "บทเฉพาะกาล" can share a block with the first section of the part
            m2 = SECTION_RE.match(m.group(1).strip())
            if m2:
                open_section(m2)
            continue
        m = SECTION_RE.match(unit) or MISREAD_RE.match(unit)
        if m:
            open_section(m)
            continue
        m = CHAPTER_RE.match(unit)
        if is_chapter(m, m.group(2) if m else ""):
            flush()
            events.append(("chapter", th_int(m.group(1)), m.group(2).strip()))
            continue
        m = PART_RE.match(unit)
        if m:
            flush()
            events.append(("part", th_int(m.group(1)), m.group(2).strip()))
            continue
        if current is not None:
            current[1].append(unit)
    flush()
    return events


def section_node(num, paras, id_prefix="s"):
    """มาตรา node: children are วรรค nodes; (๑)(๒)… blocks become children
    of the วรรค that introduces them."""
    node = {
        "id": f"{id_prefix}{num}",
        "name": f"มาตรา {num}",
        "type": "provision",
        "detail": "\n\n".join(paras),
        "children": [],
    }
    if paras:
        node["name"] = f"มาตรา {num} · {snippet(paras[0])}"

    wak = None
    wak_no = 0
    for para in paras:
        m = ITEM_RE.match(para)
        if m and wak is not None:
            wak["children"].append({
                "name": f"({th_int(m.group(1))}) {snippet(m.group(2), 42)}",
                "type": "item",
                "detail": para,
                "children": [],
            })
            wak["detail"] += "\n\n" + para
            continue
        m = SUBITEM_RE.match(para)
        if m and wak is not None:
            # (ก) (ข) … belong to the last (๑)-style item, or to the วรรค itself
            parent = wak["children"][-1] if wak["children"] else wak
            parent["children"].append({
                "name": f"({m.group(1)}) {snippet(m.group(2), 42)}",
                "type": "item",
                "detail": para,
            })
            parent["detail"] += "\n\n" + para
            continue
        m = DEFINITION_RE.match(para)
        if m and wak is not None:
            # บทนิยาม (ม.6 style): each defined term is shown as its own line
            # but is not counted as a separate วรรค
            wak["children"].append({
                "name": f"นิยาม “{m.group(1).strip()}”",
                "type": "item",
                "detail": para,
            })
            wak["detail"] += "\n\n" + para
            continue
        wak_no += 1
        wak = {
            "name": f"วรรค{ordinal(wak_no)} · {snippet(para)}",
            "type": "paragraph",
            "detail": para,
            "children": [],
        }
        node["children"].append(wak)

    # a single-วรรค มาตรา with no items needs no sub-line
    if len(node["children"]) == 1 and not node["children"][0]["children"]:
        node["children"] = []

    def prune(n):
        for c in n.get("children", []):
            prune(c)
        if "children" in n and not n["children"]:
            del n["children"]
    prune(node)
    return node


def build_act_structure(text: str):
    """หมวด/ส่วน → มาตรา → วรรค nodes for the PDPA (list of chapter nodes)."""
    chapters = []
    general = {"id": "chapter-0", "name": "บททั่วไป (มาตรา 1–7)", "type": "chapter", "children": []}
    chapters.append(general)
    container = general
    chapter = None

    for ev in parse_statute(blocks_of(text), split_paragraphs=True):
        kind = ev[0]
        if kind == "chapter":
            chapter = {"id": f"chapter-{ev[1]}", "name": f"หมวด {ev[1]} {ev[2]}".strip(),
                       "type": "chapter", "children": []}
            chapters.append(chapter)
            container = chapter
        elif kind == "part":
            part = {"name": f"ส่วนที่ {ev[1]} {ev[2]}".strip(), "type": "chapter", "children": []}
            chapter["children"].append(part)
            container = part
        elif kind == "transitory":
            chapter = {"id": "chapter-t", "name": "บทเฉพาะกาล (มาตรา 91–96)",
                       "type": "chapter", "children": []}
            chapters.append(chapter)
            container = chapter
        elif kind == "section":
            container["children"].append(section_node(ev[1], ev[2]))
        elif kind == "end":
            break

    # annotate มาตรา ranges on chapter labels that don't carry them yet
    for ch in chapters:
        nums = [int(p["id"][1:]) for p in _walk_provisions(ch)]
        if nums and "มาตรา" not in ch["name"]:
            ch["name"] += f" (มาตรา {min(nums)}–{max(nums)})"
    return chapters


def _walk_provisions(node):
    for c in node.get("children", []):
        if c.get("type") == "provision":
            yield c
        else:
            yield from _walk_provisions(c)


def build_decree_sections(text: str, mode: str, id_prefix: str):
    units = blocks_of(text) if mode == "block" else lines_of(text)
    nodes = []
    for ev in parse_statute(units, split_paragraphs=(mode == "block")):
        if ev[0] == "section":
            nodes.append(section_node(ev[1], ev[2], id_prefix=id_prefix))
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
                  "(มุมมองเดียวกับหน้า /act/299 ของระบบ — รายการเดียวกับที่ผูกกับรายมาตรา)",
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
        "actChapters": build_act_structure(act_text),
        "decreeSections": {
            "decree-2563": build_decree_sections(decree63_text, "block", "d63-"),
        },
        "byType": build_by_type(db),
    }
    if args.decree2566_text:
        text_2566 = Path(args.decree2566_text).read_text()
        payload["decreeSections"]["decree-2566"] = build_decree_sections(
            text_2566, "line", "d66-")

    provisions = [p for ch in payload["actChapters"] for p in _walk_provisions(ch)]
    n_wak = sum(len(p.get("children", [])) for p in provisions)
    out = Path(args.out)
    out.write_text(
        "// generated by scripts/build-sections.py — do not edit by hand\n"
        "// source: law-connection DocumentText (Act 299) + Vision OCR of gazette PDFs\n"
        "window.ACT_SECTIONS = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n")
    counts = {k: len(v) for k, v in payload["decreeSections"].items()}
    print(f"act มาตรา: {len(provisions)} (วรรค nodes: {n_wak}), decrees: {counts}, "
          f"types: {[c['name'] for c in payload['byType']['children']]} → {out}")


if __name__ == "__main__":
    main()
