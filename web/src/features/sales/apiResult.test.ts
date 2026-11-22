import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiError, type ApiNumbers, problemMessage, unwrap } from "./apiResult";

describe("problemMessage", () => {
  it("prefers the first validation message", () => {
    const body = {
      title: "One or more validation errors occurred.",
      errors: { CustomerVendorId: ["Pick a customer."] },
    };
    expect(problemMessage(body, 400)).toBe("Pick a customer.");
  });

  it("uses the problem detail for a conflict", () => {
    expect(problemMessage({ title: "Can't ship these items", detail: "C-1003 was already sold." }, 409)).toBe(
      "C-1003 was already sold.",
    );
  });

  it("falls back to the title, then to the status", () => {
    expect(problemMessage({ title: "Not Found" }, 404)).toBe("Not Found");
    expect(problemMessage(undefined, 404)).toBe("That record wasn't found.");
    expect(problemMessage("", 500)).toBe("Something went wrong (error 500). Try again.");
  });
});

describe("unwrap", () => {
  it("returns the data of a successful call", async () => {
    const result = await unwrap(Promise.resolve({ data: { id: 1 }, response: new Response(null, { status: 200 }) }));
    expect(result).toEqual({ id: 1 });
  });

  it("throws an ApiError carrying the server's message", async () => {
    const failed = unwrap(
      Promise.resolve({ error: { detail: "C-1003 was already sold." }, response: new Response(null, { status: 409 }) }),
    );
    await expect(failed).rejects.toEqual(new ApiError(409, "C-1003 was already sold."));
  });
});

describe("ApiNumbers", () => {
  it("narrows the generated number | string to number, deeply, and leaves strings and nulls alone", () => {
    type Generated = {
      id: number | string;
      tag: string;
      margin: null | number | string;
      lines: { weightLbs: number | string }[];
      soldOn: null | { revenue: number | string };
    };
    expectTypeOf<ApiNumbers<Generated>>().toEqualTypeOf<{
      id: number;
      tag: string;
      margin: null | number;
      lines: { weightLbs: number }[];
      soldOn: null | { revenue: number };
    }>();
  });
});
