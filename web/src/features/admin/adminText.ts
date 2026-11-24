// Pure helpers for the admin screens: the plain-English confirmation text, change lists and error messages.
// Kept free of React so they can be unit-tested.

import type { ConfirmDetail } from "../../components";
import { formatPerLb } from "../../components";

export const locationKinds = ["Bay", "Rack", "Bin"] as const;
export const vendorKinds = ["Supplier", "Customer", "Both"] as const;
export const roles = ["Purchaser", "Admin"] as const;

export type LocationKind = (typeof locationKinds)[number];
export type VendorKind = (typeof vendorKinds)[number];
export type UserRole = (typeof roles)[number];

/** The API sends ids and decimals as `number | string` (its OpenAPI doc allows both); normalize for the screen. */
export function num(value: number | string): number;
export function num(value: number | string | null | undefined): number | null;
export function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? value : Number(value);
}

export function priceText(price: number | string | null | undefined): string {
  const n = num(price);
  return n === null ? "No price" : formatPerLb(n);
}

/** A product's prices for the list: "Buy $0.42/lb", "Sell $0.55/lb", both, or "No prices yet". Missing ones are left out. */
export function pricesText(
  buyPrice: number | string | null | undefined,
  sellPrice: number | string | null | undefined,
): string {
  const buy = num(buyPrice);
  const sell = num(sellPrice);
  const parts = [buy !== null && `Buy ${formatPerLb(buy)}`, sell !== null && `Sell ${formatPerLb(sell)}`].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : "No prices yet";
}

export function activeText(isActive: boolean): string {
  return isActive ? "Active" : "Turned off";
}

/** Same cleanup the API does, so the confirm text shows exactly the name that will be saved. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export interface FieldRow {
  label: string;
  /** Undefined when creating something new. */
  before?: string;
  after: string;
}

/**
 * Rows for the confirmation dialog. A new record lists every field; an edit lists only what changes, as
 * "before → after", so the admin double-checks just the difference.
 */
export function changeDetails(rows: readonly FieldRow[]): ConfirmDetail[] {
  return rows
    .filter((r) => r.before === undefined || r.before !== r.after)
    .map((r) => ({ label: r.label, value: r.before === undefined ? r.after : `${r.before} → ${r.after}` }));
}

export interface ProductForm {
  name: string;
  isScrap: boolean;
  buyPrice: number | null;
  sellPrice: number | null;
  isActive: boolean;
}

export interface ProductLike {
  name: string;
  isScrap: boolean;
  defaultBuyPricePerLb: number | string | null;
  defaultSellPricePerLb: number | string | null;
  isActive: boolean;
}

export function productRows(form: ProductForm, before?: ProductLike): FieldRow[] {
  return [
    { label: "Name", before: before?.name, after: cleanName(form.name) },
    { label: "Scrap", before: before && (before.isScrap ? "Yes" : "No"), after: form.isScrap ? "Yes" : "No" },
    { label: "Buy price", before: before && priceText(before.defaultBuyPricePerLb), after: priceText(form.buyPrice) },
    {
      label: "Sell price",
      before: before && priceText(before.defaultSellPricePerLb),
      after: priceText(form.sellPrice),
    },
    { label: "Status", before: before && activeText(before.isActive), after: activeText(form.isActive) },
  ];
}

/** The sentence at the top of the product confirmation. */
export function productSummary(form: ProductForm, before?: ProductLike): string {
  const name = cleanName(form.name);
  if (!before) return `Add “${name}” to the product list?`;
  const priceChanged =
    num(before.defaultBuyPricePerLb) !== form.buyPrice || num(before.defaultSellPricePerLb) !== form.sellPrice;
  const offNow = before.isActive && !form.isActive;
  return [
    `Save changes to “${name}”?`,
    priceChanged ? "New prices fill in on new orders only; orders already written keep their prices." : "",
    offNow ? "It won't show up in pick lists any more." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function userChangeSummary(
  email: string,
  before: { role: string; isActive: boolean },
  role: UserRole,
  isActive: boolean,
) {
  if (before.isActive && !isActive)
    return `Turn off ${email}? They won't be able to use the app until an admin turns their account back on.`;
  if (!before.isActive && isActive) return `Turn ${email} back on as ${aOrAn(role)} ${role}?`;
  if (role === "Admin")
    return `Make ${email} an Admin? They'll be able to change prices, see the reports and manage users.`;
  return `Make ${email} a Purchaser? They'll lose access to the reports and admin screens.`;
}

function aOrAn(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/**
 * Turns an API error (ASP.NET ProblemDetails, possibly with field `errors`) into one sentence for the screen.
 * Field errors win, because they say exactly what to fix.
 */
export function problemMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const p = error as { errors?: Record<string, unknown>; detail?: unknown; title?: unknown };
    const fieldMessages = Object.values(p.errors ?? {})
      .flatMap((v) => (Array.isArray(v) ? v : []))
      .filter((m): m is string => typeof m === "string");
    if (fieldMessages.length > 0) return fieldMessages.join(" ");
    if (typeof p.detail === "string" && p.detail) return p.detail;
    if (typeof p.title === "string" && p.title) return p.title;
  }
  return fallback;
}
