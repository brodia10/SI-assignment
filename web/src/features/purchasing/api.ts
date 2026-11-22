import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";

// The generated types allow `number | string` for every number (ASP.NET Core can read numbers from strings), but
// the API always writes real JSON numbers. These hooks hand screens plain numbers so nothing downstream has to care.

type Schemas = components["schemas"];
type Num = number | string;

export type PurchaseOrderStatus = Schemas["PurchaseOrderStatus"];

export interface Supplier {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  defaultBuyPricePerLb: number | null;
}

export interface PurchaseOrderLine {
  id: number;
  productId: number;
  productName: string;
  weightLbs: number;
  pricePerLb: number;
  lineTotal: number;
  grade: string | null;
}

export interface PurchaseOrder {
  id: number;
  number: number;
  vendorName: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  receivedAt: string | null;
  totalWeightLbs: number;
  total: number;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderSummary {
  id: number;
  number: number;
  vendorName: string;
  status: PurchaseOrderStatus;
  createdAt: string;
  lineCount: number;
  totalWeightLbs: number;
  total: number;
}

export interface NewPurchaseOrderLine {
  productId: number;
  weightLbs: number;
  pricePerLb: number;
  grade: string | null;
}

export interface NewPurchaseOrder {
  vendorId: number;
  lines: NewPurchaseOrderLine[];
}

const n = (value: Num) => Number(value);
const nOrNull = (value: Num | null) => (value === null ? null : Number(value));

function toPurchaseOrder(po: Schemas["PurchaseOrderResponse"]): PurchaseOrder {
  return {
    id: n(po.id),
    number: n(po.number),
    vendorName: po.vendorName,
    status: po.status,
    createdAt: po.createdAt,
    receivedAt: po.receivedAt,
    totalWeightLbs: n(po.totalWeightLbs),
    total: n(po.total),
    lines: po.lines.map((l) => ({
      id: n(l.id),
      productId: n(l.productId),
      productName: l.productName,
      weightLbs: n(l.weightLbs),
      pricePerLb: n(l.pricePerLb),
      lineTotal: n(l.lineTotal),
      grade: l.grade,
    })),
  };
}

/** The message to show for a failed request: the API's plain-English `detail`, else its first field error. */
export function problemMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const problem = error as { detail?: unknown; errors?: unknown };
    if (typeof problem.detail === "string" && problem.detail) return problem.detail;
    if (problem.errors && typeof problem.errors === "object") {
      const first = Object.values(problem.errors as Record<string, unknown>).flat()[0];
      if (typeof first === "string") return first;
    }
  }
  return fallback;
}

/** Awaits an openapi-fetch call and returns its data, or throws an Error whose message is fit for the screen. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
  fallback: string,
): Promise<T> {
  let result: Awaited<typeof request>;
  try {
    result = await request;
  } catch {
    throw new Error("Couldn't reach the server. Check the connection and try again.");
  }
  if (result.data === undefined) throw new Error(problemMessage(result.error, fallback));
  return result.data;
}

export const purchaseOrderKeys = {
  /** Lists and details (everything that shows a PO's status or totals), not the form's pick lists. */
  all: ["purchase-orders"] as const,
  list: (status?: PurchaseOrderStatus) => ["purchase-orders", "list", status ?? "all"] as const,
  detail: (id: number) => ["purchase-orders", "detail", id] as const,
  // Its own root, so invalidating `all` after a create or receive doesn't refetch the suppliers and products too.
  formOptions: ["purchase-order-form-options"] as const,
};

export function usePurchaseOrderFormOptions() {
  return useQuery({
    queryKey: purchaseOrderKeys.formOptions,
    queryFn: async () => {
      const data = await unwrap(api.GET("/api/purchase-orders/form-options"), "Couldn't load suppliers and products.");
      return {
        suppliers: data.suppliers.map((s): Supplier => ({ id: n(s.id), name: s.name })),
        products: data.products.map(
          (p): Product => ({ id: n(p.id), name: p.name, defaultBuyPricePerLb: nOrNull(p.defaultBuyPricePerLb) }),
        ),
      };
    },
  });
}

export function usePurchaseOrders(status?: PurchaseOrderStatus) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(status),
    queryFn: async () => {
      const data = await unwrap(
        api.GET("/api/purchase-orders", { params: { query: status ? { status } : {} } }),
        "Couldn't load purchase orders.",
      );
      return data.map(
        (p): PurchaseOrderSummary => ({
          id: n(p.id),
          number: n(p.number),
          vendorName: p.vendorName,
          status: p.status,
          createdAt: p.createdAt,
          lineCount: n(p.lineCount),
          totalWeightLbs: n(p.totalWeightLbs),
          total: n(p.total),
        }),
      );
    },
  });
}

export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () =>
      toPurchaseOrder(
        await unwrap(
          api.GET("/api/purchase-orders/{id}", { params: { path: { id } } }),
          "Couldn't load that purchase order.",
        ),
      ),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (po: NewPurchaseOrder) =>
      toPurchaseOrder(
        await unwrap(api.POST("/api/purchase-orders", { body: po }), "Couldn't create the purchase order."),
      ),
    // Not awaited, so the "PO created" screen doesn't wait on a refetch of the PO list.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
  });
}

/**
 * Adds a supplier by name through the Vendors feature's quick-add (one rule for new vendors, shared with sales).
 * A name already on file comes back as that vendor, and a customer we now buy from becomes "Both".
 */
export function useQuickAddSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Supplier> => {
      const s = await unwrap(
        api.POST("/api/vendors/quick-add", { body: { name, kind: "Supplier" } }),
        "Couldn't add the supplier.",
      );
      return { id: n(s.id), name: s.name };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.formOptions }),
  });
}
