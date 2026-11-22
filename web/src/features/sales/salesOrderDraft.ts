// The sales order being put together on the New Sales Order screen. Pure functions, so the rules are unit-tested.
// The API recomputes everything when the order is posted; the money here is a preview for the screen only.

import { formatMoney } from "../../components";
import type { CreateSalesOrderRequest, SellableItem } from "./salesApi";

export interface SalesDraft {
  customerId: number | null;
  /** Picked items, in the order they were tapped. */
  itemIds: readonly number[];
  /** $/lb for each product on the order. One price per product: every coil of a product sells at the same price. */
  priceByProduct: Readonly<Record<number, number | null>>;
  containerNumber: string;
}

export const emptyDraft: SalesDraft = { customerId: null, itemIds: [], priceByProduct: {}, containerNumber: "" };

/** One product on the order, with the picked items of that product. */
export interface ProductLine {
  productId: number;
  productName: string;
  items: SellableItem[];
  weightLbs: number;
  pricePerLb: number | null;
  /** Null until there's a price. */
  revenue: number | null;
}

/** Tap an item to add it; tap again to take it off. The first item of a product brings in its default sell price. */
export function toggleItem(draft: SalesDraft, item: SellableItem): SalesDraft {
  if (draft.itemIds.includes(item.id)) return { ...draft, itemIds: draft.itemIds.filter((id) => id !== item.id) };
  const priceByProduct =
    item.productId in draft.priceByProduct
      ? draft.priceByProduct
      : { ...draft.priceByProduct, [item.productId]: item.defaultSellPricePerLb };
  return { ...draft, itemIds: [...draft.itemIds, item.id], priceByProduct };
}

export function setPrice(draft: SalesDraft, productId: number, pricePerLb: number | null): SalesDraft {
  return { ...draft, priceByProduct: { ...draft.priceByProduct, [productId]: pricePerLb } };
}

/** Drops picked items that are no longer for sale (e.g. someone else just shipped them). */
export function keepAvailable(draft: SalesDraft, available: readonly SellableItem[]): SalesDraft {
  const ids = new Set(available.map((i) => i.id));
  const itemIds = draft.itemIds.filter((id) => ids.has(id));
  return itemIds.length === draft.itemIds.length ? draft : { ...draft, itemIds };
}

/** Line revenue, rounded to the cent like the API (half a cent rounds up). */
export function lineRevenue(weightLbs: number, pricePerLb: number): number {
  // Weights have at most 2 decimals and prices at most 4, so this product is an exact integer count of
  // millionths of a dollar: float noise can't decide the rounding, and it's rounded only once.
  const millionths = Math.round(weightLbs * 100) * Math.round(pricePerLb * 10_000);
  return Math.round(millionths / 10_000) / 100;
}

/** The picked items grouped by product, in the order each product was first picked. */
export function productLines(draft: SalesDraft, available: readonly SellableItem[]): ProductLine[] {
  const byId = new Map(available.map((i) => [i.id, i]));
  const lines = new Map<number, ProductLine>();
  for (const id of draft.itemIds) {
    const item = byId.get(id);
    if (!item) continue;
    let line = lines.get(item.productId);
    if (!line) {
      line = {
        productId: item.productId,
        productName: item.productName,
        items: [],
        weightLbs: 0,
        pricePerLb: draft.priceByProduct[item.productId] ?? null,
        revenue: null,
      };
      lines.set(item.productId, line);
    }
    line.items.push(item);
    line.weightLbs += item.weightLbs;
  }
  for (const line of lines.values()) {
    const price = line.pricePerLb;
    if (price !== null) line.revenue = line.items.reduce((sum, i) => sum + lineRevenue(i.weightLbs, price), 0);
  }
  return [...lines.values()];
}

export interface DraftTotals {
  itemCount: number;
  weightLbs: number;
  /** Null while any product is missing a price. */
  revenue: number | null;
}

export function draftTotals(lines: readonly ProductLine[]): DraftTotals {
  const missingPrice = lines.some((l) => l.revenue === null);
  return {
    itemCount: lines.reduce((n, l) => n + l.items.length, 0),
    weightLbs: lines.reduce((sum, l) => sum + l.weightLbs, 0),
    revenue: missingPrice ? null : lines.reduce((sum, l) => sum + (l.revenue ?? 0), 0),
  };
}

/** What still has to be done before the order can be shipped, in plain words. Empty when it's ready. */
export function missingSteps(draft: SalesDraft, lines: readonly ProductLine[]): string[] {
  const missing: string[] = [];
  if (draft.customerId === null) missing.push("Pick a customer.");
  if (lines.length === 0) missing.push("Pick at least one item.");
  for (const line of lines) if (line.pricePerLb === null) missing.push(`Enter a price for ${line.productName}.`);
  return missing;
}

export function normalizeContainer(text: string): string | null {
  const trimmed = text.trim().toUpperCase();
  return trimmed === "" ? null : trimmed;
}

/** The request body. Only call when `missingSteps` is empty. */
export function toRequest(draft: SalesDraft, lines: readonly ProductLine[]): CreateSalesOrderRequest {
  if (draft.customerId === null) throw new Error("No customer picked");
  return {
    customerVendorId: draft.customerId,
    containerNumber: normalizeContainer(draft.containerNumber),
    lines: lines.flatMap((line) =>
      line.items.map((item) => {
        if (line.pricePerLb === null) throw new Error(`No price for ${line.productName}`);
        return { inventoryItemId: item.id, pricePerLb: line.pricePerLb };
      }),
    ),
  };
}

// Sell prices are stored with up to 4 decimals, so show all of them ($0.5525/lb). The shared formatPerLb stops at
// 3, which suits averaged costs like $0.424/lb.
const sellPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** 0.55 → "$0.55/lb", 0.5525 → "$0.5525/lb". */
export function formatPrice(pricePerLb: number): string {
  return `${sellPrice.format(pricePerLb)}/lb`;
}

const lbs = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 19800 → "19,800 lbs". */
export function formatLbs(weightLbs: number): string {
  return `${lbs.format(weightLbs)} lbs`;
}

/** "Ship 2 items (19,800 lbs) to Buckeye Fabrication in container MSCU1234567 for $10,890.00." */
export function shipSentence(customerName: string, totals: DraftTotals, containerNumber: string | null): string {
  const what = `${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"} (${formatLbs(totals.weightLbs)})`;
  const where = containerNumber ? ` in container ${containerNumber}` : "";
  const price = totals.revenue === null ? "" : ` for ${formatMoney(totals.revenue)}`;
  return `Ship ${what} to ${customerName}${where}${price}.`;
}
