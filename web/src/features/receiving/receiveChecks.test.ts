import { describe, expect, it } from "vitest";
import {
  describeReceipt,
  type ReceiveLineDraft,
  weightDifference,
  weightDifferenceText,
  weightWarning,
  whatsMissing,
} from "./receiveChecks";

const coil: ReceiveLineDraft = {
  lineId: 1,
  productName: "Hot-Rolled Steel Coil",
  orderedLbs: 40_000,
  locationId: 2,
  weightLbs: 40_000,
};
const aluminum: ReceiveLineDraft = {
  lineId: 2,
  productName: "Aluminum Sheet",
  orderedLbs: 5_000,
  locationId: 3,
  weightLbs: 5_000,
};

describe("describeReceipt", () => {
  it("reads scenario step 3 back in plain English", () => {
    expect(
      describeReceipt(2201, [
        { productName: "Hot-Rolled Steel Coil", weightLbs: 40_000, locationName: "Bay 2" },
        { productName: "Aluminum Sheet", weightLbs: 5_000, locationName: "Rack 1" },
      ]),
    ).toBe("Receive PO #2201: 40,000 lbs Hot-Rolled Steel Coil into Bay 2 and 5,000 lbs Aluminum Sheet into Rack 1.");
  });
});

describe("weight differences", () => {
  it("is quiet when the scale matches the PO", () => {
    expect(weightDifferenceText(40_000, 40_000)).toBeNull();
    expect(weightWarning([coil, aluminum])).toBeNull();
  });

  it("says how much lighter or heavier", () => {
    expect(weightDifferenceText(40_000, 39_850)).toBe("150 lbs less than the PO (40,000 lbs)");
    expect(weightDifferenceText(5_000, 5_012.5)).toBe("12.5 lbs more than the PO (5,000 lbs)");
  });

  it("doesn't invent a difference from floating point", () => {
    expect(weightDifference(0.3, 0.1 + 0.2)).toBe(0);
    expect(weightDifference(100.1, 100.3)).toBe(0.2);
  });

  it("warns about every line that differs and says the cost doesn't change", () => {
    expect(weightWarning([{ ...coil, weightLbs: 39_850 }, aluminum])).toBe(
      "Hot-Rolled Steel Coil: 150 lbs less than the PO (40,000 lbs). The cost stays at the PO amount.",
    );
    expect(
      weightWarning([
        { ...coil, weightLbs: 39_850 },
        { ...aluminum, weightLbs: 5_100 },
      ]),
    ).toBe(
      "Hot-Rolled Steel Coil: 150 lbs less than the PO (40,000 lbs). " +
        "Aluminum Sheet: 100 lbs more than the PO (5,000 lbs). The cost stays at the PO amount.",
    );
  });
});

describe("whatsMissing", () => {
  it("is ready when every line has a location and a weight", () => {
    expect(whatsMissing([coil, aluminum])).toBeNull();
  });

  it("asks for the first missing thing, line by line", () => {
    expect(
      whatsMissing([
        { ...coil, locationId: null },
        { ...aluminum, locationId: null },
      ]),
    ).toBe("Pick where the Hot-Rolled Steel Coil goes.");
    expect(whatsMissing([coil, { ...aluminum, weightLbs: null }])).toBe("Enter the weight of the Aluminum Sheet.");
    expect(whatsMissing([{ ...coil, weightLbs: 0 }])).toBe("Enter the weight of the Hot-Rolled Steel Coil.");
  });
});
