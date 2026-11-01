import { en, type Dict } from "./en";
import { ar } from "./ar";
import type { L10n, Locale } from "../types";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dict>;
export type Translate = (key: TKey, params?: Record<string, string | number>) => string;

const DICTS: Record<Locale, Dict> = { en, ar };

function lookup(dict: Dict, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function makeT(locale: Locale): Translate {
  return (key, params) => {
    const raw = lookup(DICTS[locale], key) ?? lookup(en, key) ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
  };
}

/** Translate a key that is only known at runtime (e.g. stored activity keys); falls back to the key itself. */
export function tDynamic(t: Translate, key: string, params?: Record<string, string | number>): string {
  return t(key as TKey, params);
}

export function pick(l: L10n, locale: Locale): string {
  return l[locale] || l.en;
}

// Western digits in both languages keep IDs, dates, and numbers consistent across the UI.
const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-u-nu-latn" : "en-GB");

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), opts).format(n);
}
