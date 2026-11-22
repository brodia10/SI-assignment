import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { purchaseOrderKeys, unwrap } from "../purchasing/api";

type Schemas = components["schemas"];

export interface Location {
  id: number;
  name: string;
  kind: Schemas["LocationKind"];
}

export interface ReceivedItem {
  inventoryItemId: number;
  tag: string;
  productName: string;
  locationName: string;
  weightLbs: number;
  orderedWeightLbs: number;
  totalCost: number;
}

export interface Receipt {
  purchaseOrderId: number;
  purchaseOrderNumber: number;
  items: ReceivedItem[];
}

export interface ReceiveRequest {
  purchaseOrderId: number;
  lines: { purchaseOrderLineId: number; locationId: number; weightLbs: number }[];
}

export function useReceivingLocations() {
  return useQuery({
    queryKey: ["receiving", "locations"],
    queryFn: async () =>
      (await unwrap(api.GET("/api/receipts/locations"), "Couldn't load the locations.")).map(
        (l): Location => ({ id: Number(l.id), name: l.name, kind: l.kind }),
      ),
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ReceiveRequest): Promise<Receipt> => {
      const r = await unwrap(api.POST("/api/receipts", { body: request }), "Couldn't receive the purchase order.");
      return {
        purchaseOrderId: Number(r.purchaseOrderId),
        purchaseOrderNumber: Number(r.purchaseOrderNumber),
        items: r.items.map((i) => ({
          inventoryItemId: Number(i.inventoryItemId),
          tag: i.tag,
          productName: i.productName,
          locationName: i.locationName,
          weightLbs: Number(i.weightLbs),
          orderedWeightLbs: Number(i.orderedWeightLbs),
          totalCost: Number(i.totalCost),
        })),
      };
    },
    // Whether it posted or someone else got there first (409), the PO's status has changed. Not awaited on purpose:
    // TanStack waits for a returned promise before reporting success, and the refetched PO ("Received") would
    // otherwise reach the screen before the receipt does.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
  });
}
