import { describe, expect, it } from "vitest";
import {
  addOutputs,
  canReview,
  type DraftOutput,
  describeOutputs,
  formatLbs,
  MAX_OUTPUTS,
  removeOutput,
  roomForOutputs,
  weightBalance,
} from "./workOrderDraft";

const SLIT = 3;
const SCRAP = 4;
const RACK_4 = 6;
const SCRAP_BIN = 7;

/** The scenario's step 4: C-1001 → four 9,900 lb slit coils in Rack 4 + 400 lbs of scrap. */
function scenarioOutputs(scrapLbs = 400): DraftOutput[] {
  const coils = addOutputs([], { productId: SLIT, weightLbs: 9_900, locationId: RACK_4 }, 4);
  return addOutputs(coils, { productId: SCRAP, weightLbs: scrapLbs, locationId: SCRAP_BIN }, 1);
}

describe("weightBalance", () => {
  it("is exact for the scenario work order", () => {
    expect(weightBalance(40_000, scenarioOutputs())).toEqual({
      inputLbs: 40_000,
      outputLbs: 40_000,
      remainingLbs: 0,
      state: "exact",
    });
  });

  it("is over when the outputs weigh more than the input", () => {
    const balance = weightBalance(40_000, scenarioOutputs(401));
    expect(balance.state).toBe("over");
    expect(balance.remainingLbs).toBe(-1);
  });

  it("is under when the outputs weigh less than the input", () => {
    const balance = weightBalance(40_000, scenarioOutputs(300));
    expect(balance.state).toBe("under");
    expect(balance.remainingLbs).toBe(100);
  });

  it("is empty with no outputs, even though the whole input is left", () => {
    expect(weightBalance(40_000, [])).toEqual({ inputLbs: 40_000, outputLbs: 0, remainingLbs: 40_000, state: "empty" });
  });

  it("adds decimal weights without floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; the balance must still say exact.
    expect(weightBalance(0.3, [{ weightLbs: 0.1 }, { weightLbs: 0.2 }]).state).toBe("exact");
  });
});

describe("addOutputs / removeOutput", () => {
  it("adds identical outputs with unique keys", () => {
    const outputs = scenarioOutputs();
    expect(outputs.map((o) => o.key)).toEqual([1, 2, 3, 4, 5]);
    expect(outputs.filter((o) => o.productId === SLIT)).toHaveLength(4);
  });

  it("keeps keys unique after a removal", () => {
    const outputs = addOutputs(
      removeOutput(scenarioOutputs(), 5),
      { productId: SCRAP, weightLbs: 1, locationId: 1 },
      1,
    );
    expect(new Set(outputs.map((o) => o.key)).size).toBe(outputs.length);
  });

  it("removes only the tapped output, even when others are identical", () => {
    const outputs = removeOutput(scenarioOutputs(), 2);
    expect(outputs.map((o) => o.key)).toEqual([1, 3, 4, 5]);
  });
});

describe("canReview", () => {
  it("allows exact and lighter work orders", () => {
    expect(canReview(scenarioOutputs(), weightBalance(40_000, scenarioOutputs()))).toBe(true);
    expect(canReview(scenarioOutputs(300), weightBalance(40_000, scenarioOutputs(300)))).toBe(true);
  });

  it("blocks heavier work orders", () => {
    expect(canReview(scenarioOutputs(401), weightBalance(40_000, scenarioOutputs(401)))).toBe(false);
  });

  it("blocks an empty work order", () => {
    expect(canReview([], weightBalance(40_000, []))).toBe(false);
  });

  it("blocks more outputs than the API allows", () => {
    const many = addOutputs([], { productId: SLIT, weightLbs: 1, locationId: RACK_4 }, MAX_OUTPUTS + 1);
    expect(canReview(many, weightBalance(40_000, many))).toBe(false);
    expect(roomForOutputs(many)).toBe(0);
  });
});

describe("describeOutputs", () => {
  const names: Record<number, string> = { [SLIT]: '12" Slit Coil', [SCRAP]: "Steel Scrap" };

  it("groups the scenario outputs by product", () => {
    expect(describeOutputs(scenarioOutputs(), (id) => names[id])).toBe(
      '4 × 12" Slit Coil (39,600 lbs) and 1 × Steel Scrap (400 lbs)',
    );
  });

  it("handles a single product and an empty list", () => {
    expect(describeOutputs([{ productId: SCRAP, weightLbs: 1 }], (id) => names[id])).toBe("1 × Steel Scrap (1 lb)");
    expect(describeOutputs([], (id) => names[id])).toBe("");
  });
});

describe("formatLbs", () => {
  it("formats with thousands separators and up to 2 decimals", () => {
    expect(formatLbs(40_000)).toBe("40,000 lbs");
    expect(formatLbs(9_900.5)).toBe("9,900.5 lbs");
    expect(formatLbs(0.25)).toBe("0.25 lbs");
  });
});
