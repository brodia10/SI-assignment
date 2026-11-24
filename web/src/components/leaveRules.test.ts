import { describe, expect, it } from "vitest";
import { firstDirty, shouldBlock } from "./leaveRules";

const po = (dirty: boolean) => ({ dirty, what: "purchase order" });

describe("shouldBlock", () => {
  it("asks before leaving a draft with something in it", () => {
    expect(shouldBlock([po(true)], "/purchasing/new", "/sales")).toBe(true);
  });

  it("lets you leave an empty draft without asking", () => {
    expect(shouldBlock([po(false)], "/purchasing/new", "/sales")).toBe(false);
  });

  it("lets you leave once the draft is posted (the screen turns dirty off)", () => {
    expect(shouldBlock([po(false)], "/sales/new", "/sales/12")).toBe(false);
  });

  it("doesn't ask when staying on the same screen", () => {
    expect(shouldBlock([po(true)], "/purchasing/new", "/purchasing/new")).toBe(false);
  });

  it("doesn't ask when no screen has a draft", () => {
    expect(shouldBlock([], "/", "/reports")).toBe(false);
  });
});

describe("firstDirty", () => {
  it("names the draft that would be lost", () => {
    const wo = { dirty: true, what: "work order" };
    expect(firstDirty([po(false), wo])).toBe(wo);
    expect(firstDirty([po(false)])).toBeNull();
  });
});
