import "server-only";
import { headers } from "next/headers";
import { isLang, type Lang } from "./config";

/** Language of the current request, set by middleware (for not-found/error boundaries without params). */
export async function requestLang(): Promise<Lang> {
  const l = (await headers()).get("x-lang");
  return isLang(l) ? l : "es";
}
