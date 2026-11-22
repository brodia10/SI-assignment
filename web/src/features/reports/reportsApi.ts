import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { type ApiNumbers, unwrap } from "../sales/apiResult";

type Schemas = components["schemas"];
export type InventoryReport = ApiNumbers<Schemas["InventoryReport"]>;
export type SalesReport = ApiNumbers<Schemas["SalesReport"]>;
export type SalesReportOrder = ApiNumbers<Schemas["SalesReportOrder"]>;
export type TraceableItem = ApiNumbers<Schemas["TraceableItem"]>;
export type ItemLineage = ApiNumbers<Schemas["ItemLineage"]>;
export type LineageNode = ApiNumbers<Schemas["LineageNode"]>;

// Posting a sales order invalidates everything under "reports".
export const reportKeys = {
  inventory: ["reports", "inventory"] as const,
  sales: ["reports", "sales-orders"] as const,
  items: ["reports", "items"] as const,
  lineage: (id: number) => ["reports", "items", id, "lineage"] as const,
};

export function useInventoryReport() {
  return useQuery({ queryKey: reportKeys.inventory, queryFn: () => unwrap(api.GET("/api/reports/inventory")) });
}

export function useSalesReport() {
  return useQuery({ queryKey: reportKeys.sales, queryFn: () => unwrap(api.GET("/api/reports/sales-orders")) });
}

export function useTraceableItems() {
  return useQuery({ queryKey: reportKeys.items, queryFn: () => unwrap(api.GET("/api/reports/items")) });
}

export function useLineage(id: number | null) {
  return useQuery({
    queryKey: reportKeys.lineage(id ?? 0),
    queryFn: () => unwrap(api.GET("/api/reports/items/{id}/lineage", { params: { path: { id: id ?? 0 } } })),
    enabled: id !== null,
  });
}
