import type { InventoryItemStatus } from "./api";
import { formatLbs } from "./format";

// Display-only helpers for the read-only PO detail screen.

/** Where the PO detail was opened from, passed as router state so "Back" returns there. */
export interface PoDetailFrom {
  from: "purchasing" | "receiving";
}

/** The back button for a PO detail opened from `state` (router state, so anything). Defaults to the PO list. */
export function backTarget(state: unknown): { path: string; label: string } {
  const from = state && typeof state === "object" ? (state as { from?: unknown }).from : undefined;
  return from === "receiving"
    ? { path: "/receiving", label: "Back to Receiving" }
    : { path: "/purchasing", label: "Back to Purchasing" };
}

/** What happened to a received item since: "In stock", "Processed" (used in a work order), "Sold" or "Voided". */
export const receivedItemStatus: Record<
  InventoryItemStatus,
  { label: string; color: "success" | "info" | "primary" | "default" }
> = {
  InStock: { label: "In stock", color: "success" },
  Consumed: { label: "Processed", color: "info" },
  Sold: { label: "Sold", color: "primary" },
  Voided: { label: "Voided", color: "default" },
};

/**
 * The line under a received item's tag. Once it's been processed or sold, the location is only where it was put
 * away, so it reads "last at Bay 2" and the status chip says what happened to it.
 */
export function receivedItemText(item: {
  weightLbs: number;
  locationName: string;
  status: InventoryItemStatus;
}): string {
  return item.status === "InStock"
    ? `${formatLbs(item.weightLbs)} · ${item.locationName}`
    : `${formatLbs(item.weightLbs)} · last at ${item.locationName}`;
}
