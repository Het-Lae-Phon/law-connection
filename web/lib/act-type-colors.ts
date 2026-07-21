// Maps Act.actType to the shared wayfinding color tokens (see globals.css
// --color-type-* / --color-seal-*). One muted hue per type, used consistently
// as small dots and dashed-border catalog tags so a type is recognizable at
// a glance without competing with the seal accent. Classes are written out
// in full (not composed at runtime) because Tailwind's scanner needs literal
// utility strings to generate the CSS.
interface ActTypeStyle {
  dot: string; // solid color for small indicator dots
  text: string; // text color to pair with the dashed tag
}

const DEFAULT_STYLE: ActTypeStyle = {
  dot: "bg-stone-400",
  text: "text-stone-500",
};

export const ACT_TYPE_STYLE: Record<string, ActTypeStyle> = {
  "พระราชบัญญัติ": { dot: "bg-type-act", text: "text-type-act" },
  "พระราชกำหนด": { dot: "bg-type-decree", text: "text-type-decree" },
  "พระราชบัญญัติประกอบรัฐธรรมนูญ": { dot: "bg-type-organic", text: "text-type-organic" },
  "ประมวลกฎหมาย": { dot: "bg-type-code", text: "text-type-code" },
  "รัฐธรรมนูญ": { dot: "bg-seal-700", text: "text-seal-700" },
};

export function actTypeStyle(actType: string | null | undefined): ActTypeStyle {
  return (actType && ACT_TYPE_STYLE[actType]) || DEFAULT_STYLE;
}
