import { describe, expect, it } from "vitest";
import { displaySign, formatMoney, formatPerLb, perLb } from "./money";

describe("formatMoney", () => {
  it("formats the scenario totals with cents and thousands separators", () => {
    expect(formatMoney(23550)).toBe("$23,550.00");
    expect(formatMoney(8400)).toBe("$8,400.00");
    expect(formatMoney(2490)).toBe("$2,490.00");
  });

  it("shows zero without a minus sign", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(-0)).toBe("$0.00");
    expect(formatMoney(-0.0001)).toBe("$0.00");
    expect(formatMoney(-0.004)).toBe("$0.00");
  });

  it("shows negatives with a leading minus", () => {
    expect(formatMoney(-12.5)).toBe("-$12.50");
  });
});

describe("formatPerLb", () => {
  it("keeps whole-cent prices at two decimals", () => {
    expect(formatPerLb(0.42)).toBe("$0.42/lb");
    expect(formatPerLb(1.35)).toBe("$1.35/lb");
  });

  it("shows the carried-over slit coil cost as about $0.424/lb", () => {
    expect(formatPerLb(16800 / 39600)).toBe("$0.424/lb");
  });
});

describe("displaySign", () => {
  it("is zero for anything that displays as zero", () => {
    expect(displaySign(0)).toBe(0);
    expect(displaySign(-0.004)).toBe(0);
    expect(displaySign(0.004)).toBe(0);
  });

  it("follows the sign once there's a visible cent", () => {
    expect(displaySign(2490)).toBe(1);
    expect(displaySign(-0.01)).toBe(-1);
  });

  it("uses the finer $/lb precision when asked", () => {
    expect(displaySign(-0.004, true)).toBe(-1);
    expect(displaySign(-0.0004, true)).toBe(0);
  });
});

describe("perLb", () => {
  it("divides total by weight", () => {
    expect(perLb(4200, 9900)).toBeCloseTo(0.42424, 5);
  });

  it("returns null when there is no weight", () => {
    expect(perLb(100, 0)).toBeNull();
  });
});
