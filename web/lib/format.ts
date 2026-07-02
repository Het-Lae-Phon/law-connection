const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatThaiDate(d: Date): string {
  return thaiDate.format(d);
}

// Human label for a gazette section (ประเภท)
export function categoryLabel(c: string): string {
  const map: Record<string, string> = {
    "ก": "ประเภท ก (กฎหมาย)",
    "ข": "ประเภท ข (ประกาศสำคัญ)",
    "ค": "ประเภท ค",
    "ง": "ประเภท ง (ประกาศทั่วไป)",
    "ง พิเศษ": "ประเภท ง ฉบับพิเศษ",
  };
  return map[c] ?? `ประเภท ${c}`;
}
