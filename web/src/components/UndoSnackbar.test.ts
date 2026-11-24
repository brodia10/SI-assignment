import { describe, expect, it } from "vitest";
import { insertAt } from "./UndoSnackbar";

describe("insertAt", () => {
  it("puts a removed row back where it was", () => {
    expect(insertAt(["a", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("puts the first row back first", () => {
    expect(insertAt(["b", "c"], "a", 0)).toEqual(["a", "b", "c"]);
  });

  it("puts the last row back last", () => {
    expect(insertAt(["a", "b"], "c", 2)).toEqual(["a", "b", "c"]);
  });

  it("appends when the list got shorter since the row was removed", () => {
    expect(insertAt(["a"], "z", 5)).toEqual(["a", "z"]);
  });

  it("doesn't change the original list", () => {
    const list = ["a", "c"];
    insertAt(list, "b", 1);
    expect(list).toEqual(["a", "c"]);
  });
});
