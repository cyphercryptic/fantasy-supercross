"use client";

export type RiderStatus = "active" | "out" | "questionable" | string | undefined | null;

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; title: string }> = {
  out: {
    bg: "bg-red-500",
    text: "text-white",
    label: "OUT",
    title: "Not racing this round (not on entry list)",
  },
  questionable: {
    bg: "bg-amber-500",
    text: "text-white",
    label: "Q",
    title: "Questionable — on entry list but missed practice/qualifying",
  },
};

export default function StatusBadge({ status }: { status: RiderStatus }) {
  if (!status || status === "active") return null;
  const style = STATUS_STYLES[status];
  if (!style) return null;
  return (
    <span
      className={`${style.bg} ${style.text} text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none`}
      title={style.title}
    >
      {style.label}
    </span>
  );
}
