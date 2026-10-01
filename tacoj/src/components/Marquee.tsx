const words = ["Tacos", "Birria", "Burritos", "Quesadillas", "Nachos", "Elotes", "Loaded fries", "Churros", "Cocktails at SBMA", "Beach days", "Late nights"];

export default function Marquee({ tone = "mango" }: { tone?: "mango" | "char" }) {
  const cls = tone === "mango" ? "bg-mango text-char" : "bg-char text-mango";
  return (
    <div className={`relative overflow-hidden border-y-[3px] border-char py-3 ${cls}`} aria-hidden>
      <div className="flex w-max animate-marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {words.map((w) => (
              <span key={w + k} className="display flex items-center whitespace-nowrap px-4 text-2xl sm:text-3xl">
                {w}
                <span className="ml-8 inline-block h-3 w-3 rotate-45 bg-chili" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
