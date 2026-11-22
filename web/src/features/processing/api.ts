import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../../api/client";
import type { components } from "../../api/schema";

// The generated types say `number | string` for every number (.NET's OpenAPI allows numbers as strings on input).
// The API always sends real numbers; these local types and `num` pin that down once, at the boundary.
type Schemas = components["schemas"];
const num = (value: number | string) => Number(value);

export interface InputOption {
  id: number;
  tag: string;
  productId: number;
  productName: string;
  weightLbs: number;
  totalCost: number;
  locationName: string;
}
export interface ProductOption {
  id: number;
  name: string;
  isScrap: boolean;
}
export interface LocationOption {
  id: number;
  name: string;
  kind: string;
}
export interface WorkOrderOptions {
  inputs: InputOption[];
  products: ProductOption[];
  locations: LocationOption[];
}

export interface WorkOrderRequest {
  inputItemId: number;
  outputs: { productId: number; weightLbs: number; locationId: number }[];
}

export interface PreviewOutput {
  productId: number;
  isScrap: boolean;
  weightLbs: number;
  /** Null while the work order breaks a rule (nothing to allocate). */
  totalCost: number | null;
}
export interface WorkOrderPreview {
  inputTotalCost: number;
  outputs: PreviewOutput[];
  errors: string[];
  warnings: string[];
  canPost: boolean;
}

export interface PostedOutput {
  id: number;
  tag: string;
  productName: string;
  isScrap: boolean;
  weightLbs: number;
  locationName: string;
  totalCost: number;
}
export interface PostedWorkOrder {
  number: number;
  inputTag: string;
  outputs: PostedOutput[];
}

/** A failed request, with the API's plain-English message (ProblemDetails `detail`, plus any rule `errors`). */
export class WorkOrderApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function toApiError(error: unknown, status: number, fallback: string): WorkOrderApiError {
  const problem = (error ?? {}) as { detail?: string | null; errors?: unknown };
  const errors = Array.isArray(problem.errors) ? problem.errors.filter((e) => typeof e === "string") : [];
  const message = [problem.detail, ...errors].filter(Boolean).join(" ") || fallback;
  return new WorkOrderApiError(message, status);
}

const optionsKey = ["work-orders", "options"] as const;

export function useWorkOrderOptions() {
  return useQuery({
    queryKey: optionsKey,
    queryFn: async (): Promise<WorkOrderOptions> => {
      const { data, error, response } = await api.GET("/api/work-orders/options");
      if (!data) throw toApiError(error, response.status, `Couldn't load the work order lists (${response.status}).`);
      return {
        inputs: data.inputs.map((i: Schemas["WorkOrderInputOption"]) => ({
          ...i,
          id: num(i.id),
          productId: num(i.productId),
          weightLbs: num(i.weightLbs),
          totalCost: num(i.totalCost),
        })),
        products: data.products.map((p) => ({ ...p, id: num(p.id) })),
        locations: data.locations.map((l) => ({ ...l, id: num(l.id) })),
      };
    },
  });
}

/**
 * The API's cost preview for the work order as it stands. Refetches when the outputs change (taps, not keystrokes,
 * so no debounce) and keeps showing the last answer meanwhile; check `isPlaceholderData` before trusting it.
 */
export function useWorkOrderPreview(request: WorkOrderRequest | null) {
  return useQuery({
    queryKey: ["work-orders", "preview", request],
    enabled: request !== null && request.outputs.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: async (): Promise<WorkOrderPreview> => {
      // biome-ignore lint/style/noNonNullAssertion: `enabled` guarantees a request
      const body = request!;
      const { data, error, response } = await api.POST("/api/work-orders/preview", { body });
      if (!data) throw toApiError(error, response.status, `Couldn't work out the costs (${response.status}).`);
      return {
        inputTotalCost: num(data.inputTotalCost),
        outputs: data.outputs.map((o) => ({
          productId: num(o.productId),
          isScrap: o.isScrap,
          weightLbs: num(o.weightLbs),
          totalCost: o.totalCost === null ? null : num(o.totalCost),
        })),
        errors: data.errors,
        warnings: data.warnings,
        canPost: data.canPost,
      };
    },
  });
}

/** Refetch the in-stock list, e.g. after learning that the picked item was used elsewhere. */
export function useRefreshWorkOrderOptions() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: optionsKey });
  }, [queryClient]);
}

export function usePostWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkOrderRequest): Promise<PostedWorkOrder> => {
      const { data, error, response } = await api.POST("/api/work-orders", { body });
      if (!data) throw toApiError(error, response.status, `The work order didn't post (${response.status}).`);
      return {
        number: num(data.number),
        inputTag: data.inputTag,
        outputs: data.outputs.map((o) => ({
          ...o,
          id: num(o.id),
          weightLbs: num(o.weightLbs),
          totalCost: num(o.totalCost),
        })),
      };
    },
    // Posted or not (a 409 means someone else used the coil), the in-stock list has changed. Not awaited on purpose:
    // the refetch drops the consumed coil, which unmounts the outputs step, and an awaited refetch would do that
    // before the caller's own onSuccess runs, so the "posted" screen would never show.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: optionsKey });
    },
  });
}
