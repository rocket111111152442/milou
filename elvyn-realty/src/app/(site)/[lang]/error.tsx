"use client";
import { useEffect } from "react";
import { site } from "@/config/site";

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  const lang = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "es";
  useEffect(() => {
    // no PII is logged
  }, []);
  return (
    <section className="container flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">{lang === "es" ? "Algo salió mal" : "Something went wrong"}</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        {lang === "es" ? "Ocurrió un error inesperado. Puedes intentarlo de nuevo o contactarnos directamente." : "An unexpected error occurred. You can try again or contact us directly."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-dark">{lang === "es" ? "Reintentar" : "Try again"}</button>
        <a href={`https://wa.me/${site.whatsapp}`} className="btn-outline" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
    </section>
  );
}
