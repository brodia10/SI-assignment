import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { problemMessage } from "./adminText";

type Schemas = components["schemas"];
export type Product = Schemas["ProductResponse"];
export type SaveProduct = Schemas["SaveProductRequest"];
export type Location = Schemas["LocationResponse"];
export type SaveLocation = Schemas["SaveLocationRequest"];
export type Vendor = Schemas["VendorResponse"];
export type SaveVendor = Schemas["SaveVendorRequest"];
export type User = Schemas["UserResponse"];
export type InviteUser = Schemas["InviteUserRequest"];
export type UpdateUser = Schemas["UpdateUserRequest"];

// Query keys start with the resource name, so saving a product also refreshes any other screen's product pick list
// (e.g. ["products"] in purchasing), not just the admin's full list.
const keys = {
  products: ["products", "admin"] as const,
  locations: ["locations", "admin"] as const,
  vendors: ["vendors", "admin"] as const,
  users: ["users"] as const,
};

/** Unwraps an openapi-fetch result: the data, or an Error whose message is ready to show the admin. */
async function call<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await request;
  if (error !== undefined || data === undefined)
    throw new Error(problemMessage(error, `Something went wrong (error ${response.status}). Please try again.`));
  return data;
}

const includeInactive = { params: { query: { includeInactive: true } } };

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: () => call(api.GET("/api/products", includeInactive)) });
export const useLocations = () =>
  useQuery({ queryKey: keys.locations, queryFn: () => call(api.GET("/api/locations", includeInactive)) });
export const useVendors = () =>
  useQuery({ queryKey: keys.vendors, queryFn: () => call(api.GET("/api/vendors", includeInactive)) });
export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: () => call(api.GET("/api/users")) });

/**
 * A create-or-update mutation that refreshes every query for that resource afterwards. Also on failure: an invite
 * can save the user and then fail to make the link, and the admin needs to see them in the list to retry.
 */
function useSave<TArgs, TResult>(resource: string, save: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: save,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });
}

export const useSaveProduct = () =>
  useSave("products", ({ id, body }: { id?: number; body: SaveProduct }) =>
    id === undefined
      ? call(api.POST("/api/products", { body }))
      : call(api.PUT("/api/products/{id}", { params: { path: { id } }, body })),
  );

export const useSaveLocation = () =>
  useSave("locations", ({ id, body }: { id?: number; body: SaveLocation }) =>
    id === undefined
      ? call(api.POST("/api/locations", { body }))
      : call(api.PUT("/api/locations/{id}", { params: { path: { id } }, body })),
  );

export const useSaveVendor = () =>
  useSave("vendors", ({ id, body }: { id?: number; body: SaveVendor }) =>
    id === undefined
      ? call(api.POST("/api/vendors", { body }))
      : call(api.PUT("/api/vendors/{id}", { params: { path: { id } }, body })),
  );

export const useInviteUser = () =>
  useSave("users", ({ body }: { body: InviteUser }) => call(api.POST("/api/users/invite", { body })));

export const useUpdateUser = () =>
  useSave("users", ({ id, body }: { id: number; body: UpdateUser }) =>
    call(api.PUT("/api/users/{id}", { params: { path: { id } }, body })),
  );

export const useNewSetPasswordLink = () =>
  useMutation({
    mutationFn: (id: number) =>
      call(api.POST("/api/users/{id}/set-password-link", { params: { path: { id } } })).then((r) => r.setPasswordLink),
  });
