#!/usr/bin/env python3
"""Backfill DocumentText for imported Krisdika library entries.

Walks the thailaw parquet files in the same sorted order as process-thailaw.py,
so the sequential row number matches the `thailaw:<n>` pdfUrl surrogate assigned
at import time. Writes directly to the SQLite database.

Usage: python3 backfill-doctext.py <parquet-dir> <sqlite-db>
"""
import glob
import re
import sqlite3
import sys

import pyarrow.parquet as pq


def normalize_title(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("ํา", "ำ")).strip()


def main():
    src_dir, db_path = sys.argv[1], sys.argv[2]
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # entries that need text: thailaw:<n> -> entry id
    rows = cur.execute(
        "SELECT id, pdfUrl FROM GazetteEntry WHERE pdfUrl LIKE 'thailaw:%'"
    ).fetchall()
    want = {int(u.split(":")[1]): eid for eid, u in rows}
    have = {r[0] for r in cur.execute("SELECT entryId FROM DocumentText").fetchall()}
    print(f"entries needing text: {len(want)} (already have {len(have)})")

    n = 0
    inserted = 0
    batch = []
    for f in sorted(glob.glob(src_dir + "/*.parquet")):
        table = pq.read_table(f)
        titles, texts = table.column("title"), table.column("text")
        for i in range(table.num_rows):
            title = normalize_title(str(titles[i]))
            if not title:
                # process-thailaw.py skipped empty titles without consuming an id
                continue
            eid = want.get(n)
            if eid and eid not in have:
                # keep original text (normalize only line endings), cap pathological sizes
                text = str(texts[i]).replace("\r\n", "\n")[:2_000_000]
                batch.append((eid, text))
                inserted += 1
                if len(batch) >= 500:
                    cur.executemany(
                        "INSERT OR REPLACE INTO DocumentText (entryId, text) VALUES (?, ?)", batch
                    )
                    con.commit()
                    batch = []
            n += 1
    if batch:
        cur.executemany("INSERT OR REPLACE INTO DocumentText (entryId, text) VALUES (?, ?)", batch)
        con.commit()
    print(f"inserted {inserted} document texts (walked {n} rows)")
    con.close()


if __name__ == "__main__":
    main()
