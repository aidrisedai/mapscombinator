export function SectionEyebrow({
  children,
  tone = "emerald",
}: {
  children: React.ReactNode;
  tone?: "emerald" | "cream";
}) {
  return (
    <p
      className={`mb-4 text-xs font-semibold uppercase tracking-[0.2em] ${
        tone === "cream" ? "text-moss" : "text-emerald"
      }`}
    >
      {children}
    </p>
  );
}
