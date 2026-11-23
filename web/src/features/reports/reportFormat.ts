// Display-only formatting for the reports. The API sends margin as an unrounded fraction (0.22865…).

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "negative",
});

/** 2490 / 10890 → "22.9%". No revenue → "—". */
export function formatMargin(margin: number | null): string {
  return margin === null ? "—" : percent.format(margin);
}

/** "InStock" → "In stock". */
export function statusLabel(status: string): string {
  switch (status) {
    case "InStock":
      return "In stock";
    case "Consumed":
      return "Processed";
    case "Sold":
      return "Sold";
    case "Voided":
      return "Voided";
    default:
      return status;
  }
}

/** What the trace screen needs to say where an item is now. */
export interface ItemWhereabouts {
  status: string;
  locationName: string;
  soldOnNumber?: number | null;
  usedInWorkOrderNumber?: number | null;
}

/**
 * Where the item is now. A sold or used-up item isn't on the floor anymore, so its last
 * location would mislead: say which order took it instead.
 */
export function currentPlace(item: ItemWhereabouts): string {
  switch (item.status) {
    case "Sold":
      return item.soldOnNumber != null ? `Shipped on SO #${item.soldOnNumber}` : "Shipped";
    case "Consumed":
      return item.usedInWorkOrderNumber != null ? `Used in WO #${item.usedInWorkOrderNumber}` : "Used in a work order";
    case "Voided":
      return "Voided";
    default:
      return item.locationName;
  }
}
