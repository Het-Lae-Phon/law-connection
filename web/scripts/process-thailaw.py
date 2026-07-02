#!/usr/bin/env python3
"""Process the PyThaiNLP thailaw-v1.0 parquet files (full text of the
Krisdika/OCS law library, public domain) into JSONL ready for import:
classify each document, extract the parent-act citation from the preamble,
and parse the Royal Gazette citation footnote when present.

Usage: python3 process-thailaw.py <dir-with-parquets> <out.jsonl>
"""
import json
import re
import sys

import pyarrow.parquet as pq

PRIMARY_TYPES = ["พระราชบัญญัติประกอบรัฐธรรมนูญ", "พระราชบัญญัติ", "พระราชกำหนด"]
CODE_NAMES = [
    "ประมวลกฎหมายแพ่งและพาณิชย์",
    "ประมวลกฎหมายอาญา",
    "ประมวลกฎหมายวิธีพิจารณาความแพ่ง",
    "ประมวลกฎหมายวิธีพิจารณาความอาญา",
    "ประมวลกฎหมายที่ดิน",
    "ประมวลกฎหมายยาเสพติด",
    "ประมวลรัษฎากร",
]
INSTRUMENT_PREFIXES = [
    "พระราชกฤษฎีกา",
    "กฎกระทรวง",
    "กฎ",
    "ประกาศ",
    "ระเบียบ",
    "ข้อบังคับ",
    "ข้อกำหนด",
    "คำสั่ง",
    "คำวินิจฉัย",
    "คำพิพากษา",
    "พระบรมราชโองการ",
    "รัฐธรรมนูญ",
]

THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
THAI_MONTHS = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
}

ACT_REF = re.compile(
    r"(?:แห่ง|ใน)\s*(พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด)"
    r"\s*([฀-๿0-9A-Za-z.\- ]+?)\s*"
    r"(?:\(ฉบับที่\s*[0-9]+\)\s*)?พ\.ศ\.\s*([0-9]{4})"
)
GAZETTE_REF = re.compile(
    r"ราชกิจจานุเบกษา[\s/]*เล่ม\s*([0-9]+)[\s/]*ตอน(พิเศษ|ที่)?\s*([0-9]+)\s*([กขคง])?"
    r"[\s/]*หน้า\s*([0-9]+)[\s/]*(?:วันที่\s*)?([0-9]+)\s+(\S+)\s+([0-9]{4})"
)


def normalize(s: str) -> str:
    # decomposed sara-am + Thai digits, collapse whitespace
    return re.sub(r"\s+", " ", s.replace("ํา", "ำ")).translate(THAI_DIGITS).strip()


def classify(title: str):
    for t in PRIMARY_TYPES:
        if title.startswith(t):
            return t, True
    for c in CODE_NAMES:
        if title.startswith(c):
            return "ประมวลกฎหมาย", True
    for p in INSTRUMENT_PREFIXES:
        if title.startswith(p):
            return p, p == "รัฐธรรมนูญ"
    return None, False


def find_parent(text: str):
    m = ACT_REF.search(text)
    if m:
        name = re.sub(r"และที่แก้ไขเพิ่มเติม.*$|ซึ่งแก้ไขเพิ่มเติม.*$", "", m.group(2)).strip()
        return {"actType": m.group(1), "shortName": name, "year": int(m.group(3))}
    for c in CODE_NAMES:
        if ("แห่ง" + c) in text or ("ใน" + c) in text:
            return {"actType": "ประมวลกฎหมาย", "shortName": re.sub(r"^ประมวลกฎหมาย|^ประมวล", "", c) or c, "year": None}
    return None


def find_gazette(text: str):
    m = GAZETTE_REF.search(text)
    if not m:
        return None
    volume, special, issue, cat, page, day, month_name, year = m.groups()
    month = THAI_MONTHS.get(month_name)
    year_ce = int(year) - 543 if int(year) > 2400 else int(year)
    category = (cat or "").strip()
    if special == "พิเศษ":
        category = (category + " พิเศษ").strip() if category else "พิเศษ"
    date = f"{year_ce:04d}-{month:02d}-{int(day):02d}" if month else None
    return {
        "volume": int(volume),
        "issue": issue,
        "category": category,
        "page": int(page),
        "date": date,
    }


def main():
    src_dir, out_path = sys.argv[1], sys.argv[2]
    import glob
    out = open(out_path, "w", encoding="utf-8")
    n = skipped = with_parent = with_gazette = 0
    for f in sorted(glob.glob(src_dir + "/*.parquet")):
        table = pq.read_table(f)
        titles, texts = table.column("title"), table.column("text")
        for i in range(table.num_rows):
            title = normalize(str(titles[i]))
            if not title:
                skipped += 1
                continue
            text_head = normalize(str(texts[i])[:6000])
            text_tail = normalize(str(texts[i])[-3000:])
            instrument, is_primary = classify(title)
            amendment = bool(re.search(r"\(ฉบับที่\s*[0-9]+\)", title)) and is_primary
            parent = None
            if not is_primary:
                parent = find_parent(text_head) or find_parent(title)
            gaz = find_gazette(text_tail) or find_gazette(text_head)
            if parent:
                with_parent += 1
            if gaz:
                with_gazette += 1
            out.write(json.dumps({
                "id": n,
                "title": title,
                "instrumentType": instrument,
                "isPrimary": is_primary,
                "isAmendment": amendment,
                "parent": parent,
                "gazette": gaz,
            }, ensure_ascii=False) + "\n")
            n += 1
    out.close()
    print(f"processed {n} docs ({skipped} skipped): parent ref {with_parent}, gazette citation {with_gazette}")


if __name__ == "__main__":
    main()
