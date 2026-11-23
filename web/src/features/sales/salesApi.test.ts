import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { postSalesOrderOptions, salesKeys } from "./salesApi";

vi.mock("../../api/client", () => ({ api: { POST: vi.fn() } }));

const body = { customerVendorId: 1, containerNumber: null, lines: [{ inventoryItemId: 10, pricePerLb: 0.55 }] };

describe("postSalesOrderOptions", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    queryClient.clear();
    vi.mocked(api.POST).mockReset();
  });

  // Issue #27: if the caller's onSuccess (which navigates away) waits for the in-stock list to refetch, the sold
  // items drop out of the open confirm dialog first and it flashes "Ship 0 items (0 lbs) … $0.00".
  it("hands the posted order to the caller without waiting for the in-stock list to refetch", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: { id: 7, number: 5001 },
      response: new Response(null, { status: 201 }),
    } as never);

    // The New Sales Order screen is watching the in-stock list. Its refetch never finishes in this test.
    const refetch = vi.fn(() => new Promise<never>(() => {}));
    queryClient.setQueryData(salesKeys.items, []);
    cleanups.push(new QueryObserver(queryClient, { queryKey: salesKeys.items, queryFn: refetch }).subscribe(() => {}));
    queryClient.setQueryData(["reports", "inventory"], []);

    // Subscribed like useMutation does: per-call callbacks only run while someone is listening.
    const post = new MutationObserver(queryClient, postSalesOrderOptions(queryClient));
    cleanups.push(post.subscribe(() => {}));
    const onSuccess = vi.fn();
    void post.mutate(body, { onSuccess });

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0][0]).toEqual({ id: 7, number: 5001 });
    // The stale lists are still refreshed, just not awaited.
    expect(refetch).toHaveBeenCalled();
    expect(queryClient.getQueryState(salesKeys.items)?.fetchStatus).toBe("fetching");
    expect(queryClient.getQueryState(["reports", "inventory"])?.isInvalidated).toBe(true);
  });

  // After a 409 the screen says the sold coil "has been taken off this order", so the new list must be in first.
  it("on a failed post, tells the caller only after the in-stock list has refetched", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { title: "C-1003 was already sold." },
      response: new Response(null, { status: 409 }),
    } as never);

    let finishRefetch = (_items: never[]) => {};
    const refetch = vi.fn(() => new Promise<never[]>((resolve) => (finishRefetch = resolve)));
    queryClient.setQueryData(salesKeys.items, []);
    cleanups.push(new QueryObserver(queryClient, { queryKey: salesKeys.items, queryFn: refetch }).subscribe(() => {}));

    const post = new MutationObserver(queryClient, postSalesOrderOptions(queryClient));
    cleanups.push(post.subscribe(() => {}));
    const onError = vi.fn();
    void post.mutate(body, { onError }).catch(() => {});

    await vi.waitFor(() => expect(refetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(onError).not.toHaveBeenCalled();

    finishRefetch([]);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toMatchObject({ status: 409 });
  });
});
