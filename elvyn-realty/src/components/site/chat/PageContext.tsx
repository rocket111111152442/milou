"use client";
import { useEffect } from "react";

export interface ChatPageContext { type: "listing" | "catalog" | "other"; slug?: string; title?: string }

/** Tells the assistant which property the visitor is looking at. */
export function ChatPageContextSetter(ctx: ChatPageContext) {
  const { type, slug, title } = ctx;
  useEffect(() => {
    const w = window as unknown as { __eaPage?: ChatPageContext };
    w.__eaPage = { type, slug, title };
    window.dispatchEvent(new CustomEvent("ea:page", { detail: w.__eaPage }));
    return () => {
      w.__eaPage = { type: "other" };
      window.dispatchEvent(new CustomEvent("ea:page", { detail: w.__eaPage }));
    };
  }, [type, slug, title]);
  return null;
}
