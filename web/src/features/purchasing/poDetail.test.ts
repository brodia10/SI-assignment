import { describe, expect, it } from "vitest";
import { backTarget, receivedItemStatus, receivedItemText } from "./poDetail";

describe("backTarget", () => {
  it("goes back to Receiving when opened from there", () => {
    expect(backTarget({ from: "receiving" })).toEqual({ path: "/receiving", label: "Back to Receiving" });
  });

  it("goes back to the PO list otherwise, including a deep link with no state", () => {
    const list = { path: "/purchasing", label: "Back to Purchasing" };
    expect(backTarget({ from: "purchasing" })).toEqual(list);
    expect(backTarget(null)).toEqual(list);
    expect(backTarget(undefined)).toEqual(list);
    expect(backTarget({ from: "somewhere-else" })).toEqual(list);
  });
});

describe("receivedItemStatus", () => {
  it("calls an item used in a work order Processed, as the issue and the floor do", () => {
    expect(receivedItemStatus.InStock.label).toBe("In stock");
    expect(receivedItemStatus.Consumed.label).toBe("Processed");
    expect(receivedItemStatus.Sold.label).toBe("Sold");
  });
});

describe("receivedItemText", () => {
  it("shows the weight and location of an item that's still in stock", () => {
    expect(receivedItemText({ weightLbs: 40_000, locationName: "Bay 2", status: "InStock" })).toBe(
      "40,000 lbs · Bay 2",
    );
  });

  it("says where it was put away once the item has been processed or sold", () => {
    expect(receivedItemText({ weightLbs: 40_000, locationName: "Bay 2", status: "Consumed" })).toBe(
      "40,000 lbs · last at Bay 2",
    );
    expect(receivedItemText({ weightLbs: 5_000, locationName: "Rack 1", status: "Sold" })).toBe(
      "5,000 lbs · last at Rack 1",
    );
  });
});
