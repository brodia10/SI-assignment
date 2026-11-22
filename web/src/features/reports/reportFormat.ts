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
