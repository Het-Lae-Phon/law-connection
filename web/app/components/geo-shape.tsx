import type { ReactNode } from "react";

/**
 * The สารบาญ geometric language: a บรรพ (Book) N is drawn as an N-sided shape —
 * 1 = circle, 2 = lens, 3 = triangle, 4 = square, 5 = pentagon, 6 = hexagon —
 * and the triangle also serves as the ตราช่าง (code emblem). Filled black with
 * white content, or hairline outline. Content is overlaid as HTML so it uses
 * the app's Thai fonts rather than SVG text.
 */

// vertices of a regular N-gon inscribed in radius r, with a per-N rotation
// chosen to match the printed edition (△ points down, ▢ sits flat, ⬠ is a
// house, ⬡ is vertical).
const ROTATION: Record<number, number> = { 3: 180, 4: 45, 5: 0, 6: 0 };

function polygonPoints(sides: number, r: number, cx: number, cy: number, rotDeg: number): string {
  const rot = (rotDeg - 90) * (Math.PI / 180);
  return Array.from({ length: sides }, (_, k) => {
    const a = rot + (k * 2 * Math.PI) / sides;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

export function GeoShape({
  sides,
  filled = true,
  rotate,
  children,
  className = "",
  contentClassName = "px-[14%]",
  size = 180,
}: {
  sides: number;
  filled?: boolean;
  rotate?: number;
  children?: ReactNode;
  className?: string;
  /** position/pad the overlaid content within the shape's widest zone */
  contentClassName?: string;
  size?: number;
}) {
  const cx = 50;
  const cy = 50;
  const r = 46;
  const stroke = "#3a3a38";
  const fill = filled ? "#111110" : "none";
  const strokeW = filled ? 0 : 2.4;

  let shape: ReactNode;
  if (sides <= 1) {
    shape = <circle cx={cx} cy={cy} r={r} fill={fill} stroke={filled ? "none" : stroke} strokeWidth={strokeW} />;
  } else if (sides === 2) {
    // vesica / lens — a fatter one so short Thai still fits
    const R = r * 1.12;
    const half = r;
    const path = `M ${cx} ${cy - half} A ${R} ${R} 0 0 1 ${cx} ${cy + half} A ${R} ${R} 0 0 1 ${cx} ${cy - half} Z`;
    shape = <path d={path} fill={fill} stroke={filled ? "none" : stroke} strokeWidth={strokeW} strokeLinejoin="round" />;
  } else {
    shape = (
      <polygon
        points={polygonPoints(sides, r, cx, cy, rotate ?? ROTATION[sides] ?? 0)}
        fill={fill}
        stroke={filled ? "none" : stroke}
        strokeWidth={strokeW}
        strokeLinejoin="round"
      />
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {shape}
      </svg>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-center ${contentClassName} ${
          filled ? "text-white" : "text-stone-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * TypeGlyph — the geometric mark of a law's rank, used as a small inline icon
 * across cards, lists and headers so each instrument type is recognisable at
 * a glance:
 *   ▲ (hairline ตราช่าง)  รัฐธรรมนูญ · ประมวลกฎหมาย · พ.ร.บ. — primary law
 *   ●                     พระราชกำหนด
 *   ◼                     พระราชกฤษฎีกา
 *   ⬟                     กฎกระทรวง / กฎ
 *   ⬢                     ประกาศ · ระเบียบ · ข้อบังคับ · คำสั่ง · อื่น ๆ
 */
const GLYPH_SIDES: [RegExp, { sides: number; filled: boolean; rotate?: number }][] = [
  [/^(รัฐธรรมนูญ|ประมวล|พระราชบัญญัติ)/, { sides: 3, filled: false, rotate: 0 }],
  [/^พระราชกำหนด/, { sides: 1, filled: true }],
  [/^พระราชกฤษฎีกา/, { sides: 4, filled: true }],
  [/^(กฎกระทรวง|กฎ)/, { sides: 5, filled: true }],
];

export function TypeGlyph({
  type,
  size = 13,
  className = "",
}: {
  type: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const t = (type ?? "").trim();
  const spec = GLYPH_SIDES.find(([re]) => re.test(t))?.[1] ?? { sides: 6, filled: true };
  const cx = 50, cy = 50, r = 42;
  const ink = "#44403c"; // stone-700
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`inline-block shrink-0 align-[-0.08em] ${className}`}
      aria-hidden
    >
      {spec.sides <= 1 ? (
        <circle cx={cx} cy={cy} r={r} fill={spec.filled ? ink : "none"} stroke={ink} strokeWidth={spec.filled ? 0 : 12} />
      ) : (
        <polygon
          points={polygonPoints(spec.sides, r, cx, cy, spec.rotate ?? ROTATION[spec.sides] ?? 0)}
          fill={spec.filled ? ink : "none"}
          stroke={ink}
          strokeWidth={spec.filled ? 0 : 12}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** The triangle ตราช่าง — hairline emblem that marks a ประมวลกฎหมาย. */
export function CodeEmblem({
  name,
  size = 150,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <GeoShape
      sides={3}
      filled={false}
      rotate={0}
      size={size}
      contentClassName="justify-center pt-[26%] px-[15%]"
      className={className}
    >
      <span className="font-heading font-bold leading-tight text-[12px] sm:text-[13px]">{name}</span>
    </GeoShape>
  );
}
