import { describe, expect, it } from "vitest";
import { formatMargin, statusLabel } from "./reportFormat";

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
