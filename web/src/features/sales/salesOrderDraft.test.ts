import { describe, expect, it } from "vitest";
import type { SellableItem } from "./salesApi";
import {
  draftTotals,
  emptyDraft,
  formatLbs,
  formatPrice,
  keepAvailable,
  lineRevenue,
  missingSteps,
  normalizeContainer,
  productLines,
  type SalesDraft,
  setPrice,
  shipConfirmation,
  shipSentence,
  toggleItem,
  toRequest,
} from "./salesOrderDraft";

const SLIT = 3;
const ALUMINUM = 2;

const slit = (id: number, tag: string): SellableItem => ({
  id,
  tag,
  productId: SLIT,
  productName: '12" Slit Coil',
  locationName: "Rack 4",
  weightLbs: 9900,
  defaultSellPricePerLb: 0.55,
});
const c1003 = slit(3, "C-1003");
const c1004 = slit(4, "C-1004");
const aluminum: SellableItem = {
  id: 2,
  tag: "C-1002",
  productId: ALUMINUM,
  productName: "Aluminum Sheet",
  locationName: "Rack 1",
  weightLbs: 5000,
  defaultSellPricePerLb: null,
};
const available = [c1003, c1004, aluminum];

function scenarioDraft(): SalesDraft {
  return { ...toggleItem(toggleItem(emptyDraft, c1003), c1004), customerId: 2, containerNumber: " mscu1234567 " };
}

describe("toggleItem", () => {
  it("adds an item with its product's default sell price, and removes it on a second tap", () => {
    const once = toggleItem(emptyDraft, c1003);
    expect(once.itemIds).toEqual([3]);
    expect(once.priceByProduct).toEqual({ [SLIT]: 0.55 });
    expect(toggleItem(once, c1003).itemIds).toEqual([]);
  });

  it("keeps a price the purchaser already changed", () => {
    const changed = setPrice(toggleItem(emptyDraft, c1003), SLIT, 0.6);
    expect(toggleItem(changed, c1004).priceByProduct[SLIT]).toBe(0.6);
  });

  it("leaves the price empty when the product has no default sell price", () => {
    expect(toggleItem(emptyDraft, aluminum).priceByProduct[ALUMINUM]).toBeNull();
  });
});

describe("scenario step 5", () => {
  it("two slit coils at $0.55/lb come to 19,800 lbs and $10,890.00", () => {
    const lines = productLines(scenarioDraft(), available);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      productName: '12" Slit Coil',
      weightLbs: 19800,
      pricePerLb: 0.55,
      revenue: 10890,
    });
    expect(draftTotals(lines)).toEqual({ itemCount: 2, weightLbs: 19800, revenue: 10890 });
  });

  it("builds the request with one line per item", () => {
    const draft = scenarioDraft();
    expect(toRequest(draft, productLines(draft, available))).toEqual({
      customerVendorId: 2,
      containerNumber: "MSCU1234567",
      lines: [
        { inventoryItemId: 3, pricePerLb: 0.55 },
        { inventoryItemId: 4, pricePerLb: 0.55 },
      ],
    });
  });

  it("reads back in plain English", () => {
    const lines = productLines(scenarioDraft(), available);
    expect(shipSentence("Buckeye Fabrication", draftTotals(lines), "MSCU1234567")).toBe(
      "Ship 2 items (19,800 lbs) to Buckeye Fabrication in container MSCU1234567 for $10,890.00.",
    );
  });
});

describe("shipConfirmation", () => {
  it("lists the tags going in the container on each product row, in the order they were picked", () => {
    const draft = toggleItem(toggleItem(toggleItem(emptyDraft, c1004), aluminum), c1003);
    const confirm = shipConfirmation("Buckeye Fabrication", productLines(draft, available), "MSCU1234567");
    expect(confirm.rows).toEqual([
      { productId: SLIT, label: '2 × 12" Slit Coil (C-1004, C-1003) · 19,800 lbs @ $0.55/lb', revenue: 10890 },
      { productId: ALUMINUM, label: "1 × Aluminum Sheet (C-1002) · 5,000 lbs @ ?", revenue: null },
    ]);
    expect(confirm.summary).toBe("Ship 3 items (24,800 lbs) to Buckeye Fabrication in container MSCU1234567.");
    expect(confirm.containerNumber).toBe("MSCU1234567");
  });

  it("reads back scenario step 5", () => {
    const confirm = shipConfirmation("Buckeye Fabrication", productLines(scenarioDraft(), available), null);
    expect(confirm.summary).toBe("Ship 2 items (19,800 lbs) to Buckeye Fabrication for $10,890.00.");
    expect(confirm.rows.map((r) => r.label)).toEqual(['2 × 12" Slit Coil (C-1003, C-1004) · 19,800 lbs @ $0.55/lb']);
  });
});

describe("lineRevenue", () => {
  it("rounds to the cent, half a cent up, like the API", () => {
    expect(lineRevenue(9900, 0.55)).toBe(5445);
    expect(lineRevenue(1, 0.125)).toBe(0.13);
    expect(lineRevenue(1, 0.1249)).toBe(0.12);
    expect(lineRevenue(1234.56, 0.4237)).toBe(523.08);
    // 0.124976 exactly: rounding to hundredths of a cent first would wrongly give 0.13.
    expect(lineRevenue(1.07, 0.1168)).toBe(0.12);
    expect(lineRevenue(999_999.99, 999.9999)).toBe(999_999_890);
  });
});

describe("missingSteps", () => {
  it("lists everything left to do on an empty order", () => {
    expect(missingSteps(emptyDraft, [])).toEqual(["Pick a customer.", "Pick at least one item."]);
  });

  it("asks for a price when a product has none, and holds back the total", () => {
    const draft = { ...toggleItem(scenarioDraft(), aluminum) };
    const lines = productLines(draft, available);
    expect(missingSteps(draft, lines)).toEqual(["Enter a price for Aluminum Sheet."]);
    expect(draftTotals(lines).revenue).toBeNull();
  });

  it("is empty when the order is ready (the container number is optional)", () => {
    const draft = { ...scenarioDraft(), containerNumber: "" };
    expect(missingSteps(draft, productLines(draft, available))).toEqual([]);
  });
});

describe("keepAvailable", () => {
  it("drops items that were sold elsewhere", () => {
    expect(keepAvailable(scenarioDraft(), [c1004, aluminum]).itemIds).toEqual([4]);
  });

  it("returns the same draft when nothing changed", () => {
    const draft = scenarioDraft();
    expect(keepAvailable(draft, available)).toBe(draft);
  });
});

describe("formatting", () => {
  it("shows every decimal of a sell price", () => {
    expect(formatPrice(0.55)).toBe("$0.55/lb");
    expect(formatPrice(0.5525)).toBe("$0.5525/lb");
  });

  it("normalizes the container number", () => {
    expect(normalizeContainer("  mscu1234567 ")).toBe("MSCU1234567");
    expect(normalizeContainer("   ")).toBeNull();
  });

  it("formats weights and leaves out the container when there is none", () => {
    expect(formatLbs(19800)).toBe("19,800 lbs");
    expect(shipSentence("Buckeye Fabrication", { itemCount: 1, weightLbs: 400, revenue: 60 }, null)).toBe(
      "Ship 1 item (400 lbs) to Buckeye Fabrication for $60.00.",
    );
  });
});
