import { describe, expect, it } from "vitest";
import { formatBuyPrice, formatLbs, listInEnglish } from "./format";
import { lineTotal, poTotal, totalWeight } from "./poMath";
import { describePurchaseOrder, whatsMissing } from "./poSummary";

const coil = { productName: "Hot-Rolled Steel Coil", weightLbs: 40_000, pricePerLb: 0.42 };
const aluminum = { productName: "Aluminum Sheet", weightLbs: 5_000, pricePerLb: 1.35 };

describe("PO math (mirrors the API's PurchaseOrderMath)", () => {
  it("totals scenario PO #2201 to $23,550.00", () => {
    expect(lineTotal(coil)).toBe(16_800);
    expect(lineTotal(aluminum)).toBe(6_750);
    expect(poTotal([coil, aluminum])).toBe(23_550);
  });

  it("is exact where floating point isn't", () => {
    // $1.005 is exactly half a cent, but as a float it's 1.00499999…, so Math.round(x * 100) would give $1.00.
    expect(Math.round(1.005 * 100) / 100).toBe(1);
    expect(lineTotal({ weightLbs: 1, pricePerLb: 1.005 })).toBe(1.01);
  });

  it("rounds each line to the cent, half away from zero", () => {
    expect(lineTotal({ weightLbs: 1, pricePerLb: 0.005 })).toBe(0.01);
    expect(lineTotal({ weightLbs: 1, pricePerLb: 0.0049 })).toBe(0);
    expect(lineTotal({ weightLbs: 1234.57, pricePerLb: 0.4235 })).toBe(522.84);
  });

  it("adds rounded line totals, like the items' costs will", () => {
    const halfCent = { weightLbs: 1, pricePerLb: 0.005 };
    expect(poTotal([halfCent, halfCent, halfCent])).toBe(0.03);
  });

  it("handles the largest weight and price without losing precision", () => {
    expect(lineTotal({ weightLbs: 999_999.99, pricePerLb: 999.9999 })).toBe(999_999_890);
  });

  it("totals weight", () => {
    expect(totalWeight([coil, aluminum])).toBe(45_000);
    expect(totalWeight([{ weightLbs: 0.1 }, { weightLbs: 0.2 }])).toBe(0.3);
    expect(poTotal([])).toBe(0);
  });
});

describe("describePurchaseOrder", () => {
  it("reads scenario PO #2201 back in plain English", () => {
    expect(describePurchaseOrder("Great Lakes Steel Supply", [coil, aluminum])).toBe(
      "Create a PO for Great Lakes Steel Supply: 40,000 lbs Hot-Rolled Steel Coil at $0.42/lb and 5,000 lbs " +
        "Aluminum Sheet at $1.35/lb. Total $23,550.00.",
    );
  });

  it("shows a 4-decimal price in full", () => {
    expect(describePurchaseOrder("Acme", [{ ...coil, pricePerLb: 0.4235 }])).toBe(
      "Create a PO for Acme: 40,000 lbs Hot-Rolled Steel Coil at $0.4235/lb. Total $16,940.00.",
    );
  });
});

describe("whatsMissing", () => {
  it("says what to do next", () => {
    expect(whatsMissing(false, 0)).toBe("Pick the supplier and add a product.");
    expect(whatsMissing(false, 2)).toBe("Pick the supplier.");
    expect(whatsMissing(true, 0)).toBe("Add at least one product.");
    expect(whatsMissing(true, 1)).toBeNull();
  });
});

describe("format", () => {
  it("formats pounds and prices", () => {
    expect(formatLbs(40_000)).toBe("40,000 lbs");
    expect(formatLbs(1_250.5)).toBe("1,250.5 lbs");
    expect(formatBuyPrice(0.42)).toBe("$0.42/lb");
    expect(formatBuyPrice(1.35)).toBe("$1.35/lb");
    expect(formatBuyPrice(0.4235)).toBe("$0.4235/lb");
  });

  it("joins lists the way people say them", () => {
    expect(listInEnglish([])).toBe("");
    expect(listInEnglish(["a"])).toBe("a");
    expect(listInEnglish(["a", "b"])).toBe("a and b");
    expect(listInEnglish(["a", "b", "c"])).toBe("a, b and c");
  });
});
