"use client";
import { useEffect } from "react";
import { IconCalendar, IconPhone, IconWhatsApp } from "../Icons";

export function MobileActionBar({ wa, tel, labels }: { wa: string; tel: string; labels: { whatsapp: string; call: string; visit: string } }) {
  useEffect(() => {
    document.body.classList.add("has-actionbar");
    return () => document.body.classList.remove("has-actionbar");
  }, []);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
      <div className="grid grid-cols-3 gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-2 text-[13px]"><IconWhatsApp size={17} /> {labels.whatsapp}</a>
        <a href={tel} className="btn-dark px-2 text-[13px]"><IconPhone size={17} /> {labels.call}</a>
        <a href="#solicitar-visita" className="btn-outline px-2 text-[13px]"><IconCalendar size={17} /> {labels.visit}</a>
      </div>
    </div>
  );
}
