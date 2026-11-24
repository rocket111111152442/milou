import type { Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

export function DemoBanner({ lang }: { lang: Lang }) {
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-[13px] font-medium text-amber-950">
      {getDict(lang).demo.banner}
    </div>
  );
}
