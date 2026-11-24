import { describe, expect, it } from "vitest";
import {
  applyPadKey,
  defaultPadOptions,
  formatPadText,
  numberToPadText,
  type PadKey,
  type PadState,
  padStateFor,
  padTextToNumber,
  pressPadKey,
  syncPadState,
  syncPadText,
} from "./weightPad";

const type = (keys: PadKey[], start = "", options?: Parameters<typeof applyPadKey>[2]) =>
  keys.reduce((text, key) => applyPadKey(text, key, options), start);

describe("applyPadKey", () => {
  it("builds a whole number from digits", () => {
    expect(type(["4", "0", "0", "0", "0"])).toBe("40000");
  });

  it("allows only one decimal point", () => {
    expect(type(["1", ".", "5", ".", "2"])).toBe("1.52");
  });

  it("starts with 0. when the decimal point comes first", () => {
    expect(type(["."])).toBe("0.");
  });

  it("caps the digits after the decimal point", () => {
    expect(type(["1", ".", "2", "3", "4"])).toBe("1.23");
  });

  it("blocks the decimal point entirely when maxDecimals is 0", () => {
    expect(type(["5", ".", "1"], "", { maxDecimals: 0, maxWholeDigits: 6 })).toBe("51");
  });

  it("replaces a lone leading zero", () => {
    expect(type(["0", "0", "7"])).toBe("7");
    expect(type(["0", ".", "0", "5"])).toBe("0.05");
  });

  it("caps the whole-number digits", () => {
    expect(type(["1", "2", "3", "4", "5", "6", "7"])).toBe("123456");
  });

  it("backspace removes the last character, and does nothing when empty", () => {
    expect(type(["1", "2", "back"])).toBe("1");
    expect(type(["back"])).toBe("");
  });

  it("clear empties the value", () => {
    expect(type(["9", "9", "clear"])).toBe("");
  });
});

const pricePad = { maxDecimals: 4, maxWholeDigits: 3 };
const press = (keys: PadKey[], start: PadState, options = pricePad) =>
  keys.reduce((state, key) => pressPadKey(state, key, options), start);

describe("pressPadKey", () => {
  const prefilled = (text: string): PadState => ({ text, prefilled: true });

  it("replaces a prefilled value with the first digit, then appends", () => {
    expect(press(["4", "5"], prefilled("0.42"))).toEqual({ text: "45", prefilled: false });
    expect(press(["9", "9", "0", "0"], prefilled("10000"), defaultPadOptions)).toEqual({
      text: "9900",
      prefilled: false,
    });
  });

  it("replaces a prefilled value with the decimal point, so . 4 5 gives 0.45", () => {
    expect(press(["."], prefilled("0.42")).text).toBe("0.");
    expect(press([".", "4", "5"], prefilled("0.42")).text).toBe("0.45");
  });

  it("appends to a value the user typed", () => {
    expect(press(["5"], { text: "0.42", prefilled: false }).text).toBe("0.425");
  });

  it("backspace on a prefilled value deletes one character, and later keys append", () => {
    expect(press(["back"], prefilled("0.42"))).toEqual({ text: "0.4", prefilled: false });
    expect(press(["back", "5"], prefilled("0.42")).text).toBe("0.45");
  });

  it("ignores . on a whole-number pad instead of wiping the prefilled value", () => {
    const wholePounds = { maxDecimals: 0, maxWholeDigits: 6 };
    expect(press(["."], prefilled("40000"), wholePounds)).toEqual({ text: "40000", prefilled: false });
  });

  it("clear empties a prefilled value", () => {
    expect(press(["clear"], prefilled("0.42"))).toEqual({ text: "", prefilled: false });
  });
});

describe("padStateFor", () => {
  it("marks a starting value as prefilled, but not an empty one", () => {
    expect(padStateFor(0.42, pricePad)).toEqual({ text: "0.42", prefilled: true });
    expect(padStateFor(null)).toEqual({ text: "", prefilled: false });
  });
});

describe("syncPadState", () => {
  it("keeps the same state object while the parent agrees with the pad", () => {
    const typed: PadState = { text: "12.", prefilled: false };
    expect(syncPadState(typed, 12)).toBe(typed);
  });

  it("does not flag the parent echoing back what was just typed", () => {
    const afterKey = pressPadKey({ text: "0.42", prefilled: true }, "4", pricePad);
    expect(syncPadState(afterKey, 4, pricePad)).toBe(afterKey);
  });

  it("marks a value from the parent as prefilled", () => {
    expect(syncPadState({ text: "", prefilled: false }, 1.35, pricePad)).toEqual({ text: "1.35", prefilled: true });
    expect(syncPadState({ text: "45", prefilled: false }, 0.42, pricePad)).toEqual({ text: "0.42", prefilled: true });
  });

  it("is not prefilled when the parent empties the pad", () => {
    expect(syncPadState({ text: "0.42", prefilled: true }, null)).toEqual({ text: "", prefilled: false });
  });
});

describe("padTextToNumber", () => {
  it("returns null for nothing typed", () => {
    expect(padTextToNumber("")).toBeNull();
  });

  it("parses whole numbers and a trailing decimal point", () => {
    expect(padTextToNumber("9900")).toBe(9900);
    expect(padTextToNumber("12.")).toBe(12);
    expect(padTextToNumber("0.5")).toBe(0.5);
  });
});

describe("numberToPadText", () => {
  it("drops trailing zeros and rounds to the allowed decimals", () => {
    expect(numberToPadText(40000)).toBe("40000");
    expect(numberToPadText(12.345)).toBe("12.35");
  });

  it("returns empty text for missing or invalid values", () => {
    expect(numberToPadText(null)).toBe("");
    expect(numberToPadText(undefined)).toBe("");
    expect(numberToPadText(-5)).toBe("");
  });
});

describe("formatPadText", () => {
  it("adds thousands separators", () => {
    expect(formatPadText("40000")).toBe("40,000");
  });

  it("keeps what the user is mid-way through typing", () => {
    expect(formatPadText("1250.")).toBe("1,250.");
    expect(formatPadText("1250.50")).toBe("1,250.50");
  });

  it("shows 0 when empty", () => {
    expect(formatPadText("")).toBe("0");
  });
});

describe("syncPadText", () => {
  it("keeps in-progress text that means the same number", () => {
    expect(syncPadText("12.", 12)).toBe("12.");
    expect(syncPadText("0.0", 0)).toBe("0.0");
    expect(syncPadText("", null)).toBe("");
  });

  it("takes the parent's value when it differs (prefill, reset)", () => {
    expect(syncPadText("", 40000)).toBe("40000");
    expect(syncPadText("123", null)).toBe("");
  });

  it("reverts to the parent's value when the parent rejected the last key press", () => {
    // User typed 1234 but the parent kept 123.
    expect(syncPadText("1234", 123)).toBe("123");
  });

  it("is stable for a value with more decimals than the pad allows (no update loop)", () => {
    const once = syncPadText("", 12.345);
    expect(once).toBe("12.35");
    expect(syncPadText(once, 12.345)).toBe("12.35");
  });
});
