// Which screens each role can use. One list drives the nav, the home tiles and the route guards,
// so they can't drift apart.
//
// Per the requirements: the purchaser does purchasing, receiving, processing and sales; the admin sets up
// products/users and views the reports. Admins also get the purchaser screens (our decision: easy demos, and
// the owner can cover a shift).

export type Role = "Admin" | "Purchaser";

export type LaneId = "purchasing" | "receiving" | "processing" | "sales" | "reports" | "admin";

export interface Lane {
  id: LaneId;
  path: `/${string}`;
  label: string;
  /** One line under the label on the home tile, in the purchaser's words. */
  description: string;
  roles: readonly Role[];
}

const everyone: readonly Role[] = ["Admin", "Purchaser"];
const adminOnly: readonly Role[] = ["Admin"];

export const lanes: readonly Lane[] = [
  {
    id: "purchasing",
    path: "/purchasing",
    label: "Purchasing",
    description: "Write a purchase order",
    roles: everyone,
  },
  {
    id: "receiving",
    path: "/receiving",
    label: "Receiving",
    description: "Put delivered material away",
    roles: everyone,
  },
  {
    id: "processing",
    path: "/processing",
    label: "Processing",
    description: "Run a work order",
    roles: everyone,
  },
  { id: "sales", path: "/sales", label: "Sales", description: "Sell and ship a container", roles: everyone },
  {
    id: "reports",
    path: "/reports",
    label: "Reports",
    description: "Inventory, profit and margin",
    roles: adminOnly,
  },
  { id: "admin", path: "/admin", label: "Admin", description: "Products, prices and users", roles: adminOnly },
];

/** Narrows the API's role string. Unknown roles get no lanes rather than a guess. */
export function toRole(value: string): Role | null {
  return value === "Admin" || value === "Purchaser" ? value : null;
}

export function lanesFor(role: Role | null): Lane[] {
  return role ? lanes.filter((lane) => lane.roles.includes(role)) : [];
}

export function canAccess(role: Role | null, laneId: LaneId): boolean {
  return lanesFor(role).some((lane) => lane.id === laneId);
}
