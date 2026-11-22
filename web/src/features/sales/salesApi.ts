import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { ApiError, type ApiNumbers, unwrap } from "./apiResult";

type Schemas = components["schemas"];
export type Customer = ApiNumbers<Schemas["CustomerOption"]>;
export type SellableItem = ApiNumbers<Schemas["AvailableItem"]>;
export type SalesOrderSummary = ApiNumbers<Schemas["SalesOrderSummary"]>;
export type SalesOrderDetail = ApiNumbers<Schemas["SalesOrderDetail"]>;
export type CreateSalesOrderRequest = Schemas["CreateSalesOrderRequest"];

export const salesKeys = {
  all: ["sales"] as const,
  customers: ["sales", "customers"] as const,
  items: ["sales", "available-items"] as const,
  orders: ["sales", "orders"] as const,
  order: (id: number) => ["sales", "orders", id] as const,
};

export function useCustomers() {
  return useQuery({ queryKey: salesKeys.customers, queryFn: () => unwrap(api.GET("/api/sales-orders/customers")) });
}

export function useSellableItems() {
  return useQuery({
    queryKey: salesKeys.items,
    queryFn: () => unwrap(api.GET("/api/sales-orders/available-items")),
  });
}

export function useSalesOrders() {
  return useQuery({ queryKey: salesKeys.orders, queryFn: () => unwrap(api.GET("/api/sales-orders")) });
}

/** `null` (a bad link like /sales/abc) fails right away with "not found" instead of calling the API. */
export function useSalesOrder(id: number | null) {
  return useQuery({
    queryKey: salesKeys.order(id ?? 0),
    queryFn: () =>
      id === null
        ? Promise.reject(new ApiError(404, "That sales order wasn't found."))
        : unwrap(api.GET("/api/sales-orders/{id}", { params: { path: { id } } })),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 3,
  });
}

/** Posts a sales order. Afterwards, sales lists and every report are stale (items were sold). */
export function usePostSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSalesOrderRequest) => unwrap(api.POST("/api/sales-orders", { body })),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: salesKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]),
  });
}
