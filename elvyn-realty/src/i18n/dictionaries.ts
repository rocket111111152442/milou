import type { Lang } from "./config";
import es, { type Dict } from "./dict/es";
import en from "./dict/en";

const dicts: Record<Lang, Dict> = { es, en };
export const getDict = (lang: Lang): Dict => dicts[lang];
export type { Dict };
