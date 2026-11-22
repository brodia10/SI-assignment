import { describe, expect, it } from "vitest";
import { canAccess, lanes, lanesFor, toRole } from "./navigation";

const ids = (role: Parameters<typeof lanesFor>[0]) => lanesFor(role).map((lane) => lane.id);

describe("lanesFor", () => {
  it("gives the purchaser exactly the four day-to-day lanes", () => {
    expect(ids("Purchaser")).toEqual(["purchasing", "receiving", "processing", "sales"]);
  });

  it("gives the admin every lane", () => {
    expect(ids("Admin")).toEqual(lanes.map((lane) => lane.id));
  });

  it("gives an unknown role nothing", () => {
    expect(ids(null)).toEqual([]);
  });
});

describe("canAccess", () => {
  it("keeps purchasers out of reports and admin", () => {
    expect(canAccess("Purchaser", "reports")).toBe(false);
    expect(canAccess("Purchaser", "admin")).toBe(false);
    expect(canAccess("Purchaser", "sales")).toBe(true);
  });

  it("lets admins into reports and admin", () => {
    expect(canAccess("Admin", "reports")).toBe(true);
    expect(canAccess("Admin", "admin")).toBe(true);
  });
});

describe("toRole", () => {
  it("accepts the API's role names and rejects anything else", () => {
    expect(toRole("Admin")).toBe("Admin");
    expect(toRole("Purchaser")).toBe("Purchaser");
    expect(toRole("admin")).toBeNull();
    expect(toRole("Owner")).toBeNull();
  });
});

describe("lanes", () => {
  it("have unique ids and paths", () => {
    expect(new Set(lanes.map((l) => l.id)).size).toBe(lanes.length);
    expect(new Set(lanes.map((l) => l.path)).size).toBe(lanes.length);
  });
});
