import { describe, expect, it } from "vitest";
import { currentPlace, formatMargin, statusLabel } from "./reportFormat";

describe("formatMargin", () => {
  it("shows the scenario's sales order #5001 at 22.9%", () => {
    expect(formatMargin(2490 / 10890)).toBe("22.9%");
  });

  it("rounds only once, for display", () => {
    expect(formatMargin(0.22849)).toBe("22.8%");
    expect(formatMargin(0.2285)).toBe("22.9%");
  });

  it("shows losses, all-margin scrap and missing revenue", () => {
    expect(formatMargin(-0.5)).toBe("-50.0%");
    expect(formatMargin(1)).toBe("100.0%");
    expect(formatMargin(0)).toBe("0.0%");
    expect(formatMargin(null)).toBe("—");
  });
});

describe("statusLabel", () => {
  it("uses the floor's words", () => {
    expect(statusLabel("InStock")).toBe("In stock");
    expect(statusLabel("Consumed")).toBe("Processed");
    expect(statusLabel("Sold")).toBe("Sold");
  });
});

describe("currentPlace", () => {
  it("shows the location while the item is in stock", () => {
    expect(currentPlace({ status: "InStock", locationName: "Rack 4" })).toBe("Rack 4");
  });

  it("shows the sales order for a sold item, not its old rack", () => {
    expect(currentPlace({ status: "Sold", locationName: "Rack 4", soldOnNumber: 5001 })).toBe("Shipped on SO #5001");
  });

  it("shows the work order for a consumed item, not its old bay", () => {
    expect(currentPlace({ status: "Consumed", locationName: "Bay 2", usedInWorkOrderNumber: 1 })).toBe("Used in WO #1");
  });

  it("never falls back to the old location once the item has left the floor", () => {
    expect(currentPlace({ status: "Sold", locationName: "Rack 4", soldOnNumber: null })).toBe("Shipped");
    expect(currentPlace({ status: "Consumed", locationName: "Bay 2" })).toBe("Used in a work order");
    expect(currentPlace({ status: "Voided", locationName: "Rack 1" })).toBe("Voided");
  });
});
