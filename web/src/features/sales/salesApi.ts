import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
export function postSalesOrderOptions(queryClient: QueryClient) {
  return {
    mutationFn: (body: CreateSalesOrderRequest) => unwrap(api.POST("/api/sales-orders", { body })),
    // On success, not awaited: the caller's own onSuccess (navigate away) would otherwise run only after the new
    // in-stock list arrives without the sold items, and the open dialog would flash "Ship 0 items" first.
    // On failure, awaited: after a 409 the caller says the sold coil is off the order, so it must already be gone.
    onSettled: (_data: unknown, error: Error | null) => {
      const refreshed = Promise.all([
        queryClient.invalidateQueries({ queryKey: salesKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      return error ? refreshed : undefined;
    },
  };
}

export function usePostSalesOrder() {
  return useMutation(postSalesOrderOptions(useQueryClient()));
}
