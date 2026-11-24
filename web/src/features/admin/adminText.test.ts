import { describe, expect, it } from "vitest";
import {
  changeDetails,
  cleanName,
  num,
  type ProductForm,
  type ProductLike,
  pricesText,
  priceText,
  problemMessage,
  productRows,
  productSummary,
  userChangeSummary,
} from "./adminText";

const steelCoil: ProductLike = {
  name: "Hot-Rolled Steel Coil",
  isScrap: false,
  defaultBuyPricePerLb: 0.42,
  defaultSellPricePerLb: null,
  isActive: true,
};

const formFrom = (p: ProductLike): ProductForm => ({
  name: p.name,
  isScrap: p.isScrap,
  buyPrice: num(p.defaultBuyPricePerLb),
  sellPrice: num(p.defaultSellPricePerLb),
  isActive: p.isActive,
});

describe("num", () => {
  it("accepts the API's number-or-string values", () => {
    expect(num(42)).toBe(42);
    expect(num("0.42")).toBe(0.42);
    expect(num(null)).toBeNull();
    expect(num("")).toBeNull();
  });
});

describe("priceText", () => {
  it("formats a $/lb price or says there is none", () => {
    expect(priceText(0.42)).toBe("$0.42/lb");
    expect(priceText("1.35")).toBe("$1.35/lb");
    expect(priceText(null)).toBe("No price");
  });
});

describe("cleanName", () => {
  it("matches the API's whitespace cleanup", () => {
    expect(cleanName("  Bay   2 ")).toBe("Bay 2");
  });
});

describe("changeDetails", () => {
  it("lists every field for something new", () => {
    expect(changeDetails([{ label: "Name", after: "Bay 9" }])).toEqual([{ label: "Name", value: "Bay 9" }]);
  });

  it("lists only what changes for an edit", () => {
    expect(
      changeDetails([
        { label: "Name", before: "Bay 9", after: "Bay 9" },
        { label: "Kind", before: "Bay", after: "Rack" },
      ]),
    ).toEqual([{ label: "Kind", value: "Bay → Rack" }]);
  });
});

describe("product confirmation", () => {
  it("shows the price change as before → after", () => {
    const form = { ...formFrom(steelCoil), buyPrice: 0.45 };
    expect(changeDetails(productRows(form, steelCoil))).toEqual([{ label: "Buy price", value: "$0.42/lb → $0.45/lb" }]);
  });

  it("explains that a new price only affects new orders", () => {
    const summary = productSummary({ ...formFrom(steelCoil), buyPrice: 0.45 }, steelCoil);
    expect(summary).toContain("new orders only");
  });

  it("doesn't mention prices when they didn't change", () => {
    const summary = productSummary({ ...formFrom(steelCoil), name: "HR Steel Coil" }, steelCoil);
    expect(summary).toBe("Save changes to “HR Steel Coil”?");
  });

  it("treats a string price from the API as equal to the same number", () => {
    const fromApi = { ...steelCoil, defaultBuyPricePerLb: "0.42" };
    expect(productSummary(formFrom(steelCoil), fromApi)).toBe("Save changes to “Hot-Rolled Steel Coil”?");
  });

  it("warns that turning a product off hides it from pick lists", () => {
    expect(productSummary({ ...formFrom(steelCoil), isActive: false }, steelCoil)).toContain("pick lists");
  });

  it("asks to add a new product, with every field listed", () => {
    const form: ProductForm = { name: " Copper  Wire", isScrap: false, buyPrice: 3.1, sellPrice: null, isActive: true };
    expect(productSummary(form)).toBe("Add “Copper Wire” to the product list?");
    expect(changeDetails(productRows(form)).map((d) => d.label)).toEqual([
      "Name",
      "Scrap",
      "Buy price",
      "Sell price",
      "Status",
    ]);
  });
});

describe("userChangeSummary", () => {
  const purchaser = { role: "Purchaser", isActive: true };

  it("spells out what turning someone off means", () => {
    expect(userChangeSummary("pat@example.com", purchaser, "Purchaser", false)).toMatch(/won't be able to use the app/);
  });

  it("spells out what making someone an admin means", () => {
    expect(userChangeSummary("pat@example.com", purchaser, "Admin", true)).toMatch(/change prices/);
  });

  it("names the role when turning someone back on", () => {
    expect(userChangeSummary("pat@example.com", { role: "Admin", isActive: false }, "Admin", true)).toBe(
      "Turn pat@example.com back on as an Admin?",
    );
  });
});

describe("problemMessage", () => {
  it("prefers field errors, which say what to fix", () => {
    const error = { title: "One or more validation errors occurred.", errors: { Name: ["Enter a name."] } };
    expect(problemMessage(error, "fallback")).toBe("Enter a name.");
  });

  it("falls back to the detail, then the title, then the fallback", () => {
    expect(problemMessage({ title: "Conflict", detail: "There's already a product called X." }, "f")).toBe(
      "There's already a product called X.",
    );
    expect(problemMessage({ title: "Conflict" }, "f")).toBe("Conflict");
    expect(problemMessage(undefined, "Couldn't save.")).toBe("Couldn't save.");
  });
});

describe("pricesText", () => {
  it("leaves out a missing price instead of saying 'No price'", () => {
    expect(pricesText(0.42, null)).toBe("Buy $0.42/lb");
    expect(pricesText(null, 0.55)).toBe("Sell $0.55/lb");
  });

  it("shows both when both are set", () => {
    expect(pricesText(0.42, 0.5)).toBe("Buy $0.42/lb · Sell $0.50/lb");
  });

  it("says so when neither is set", () => {
    expect(pricesText(null, null)).toBe("No prices yet");
  });
});
