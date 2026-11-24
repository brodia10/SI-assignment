import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ActionBar,
  BigButton,
  ConfirmSummary,
  formatMoney,
  MoneyText,
  PageHeader,
  PickList,
  useLeaveGuard,
} from "../../components";
import { ApiError, errorText } from "./apiResult";
import { ItemChecklist } from "./ItemChecklist";
import { PriceDialog } from "./PriceDialog";
import { QueryState } from "./QueryState";
import { useCustomers, usePostSalesOrder, useSellableItems } from "./salesApi";
import {
  draftTotals,
  emptyDraft,
  formatLbs,
  formatPrice,
  keepAvailable,
  missingSteps,
  normalizeContainer,
  type ProductLine,
  productLines,
  type ShipConfirmation,
  setPrice,
  shipConfirmation,
  toggleItem,
  toRequest,
} from "./salesOrderDraft";

/** Sell and ship: customer → items → prices (defaulted) → container → confirm. */
export function NewSalesOrder() {
  const customers = useCustomers();
  const items = useSellableItems();
  const post = usePostSalesOrder();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(emptyDraft);
  const [pricing, setPricing] = useState<ProductLine | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** Set after a 409: the order changed under us, so the purchaser must look again before shipping. */
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * What the dialog said when "Ship it" was tapped. Posting refreshes the in-stock list, which takes the sold items
   * off this draft; without this the dialog could read "Ship 0 items" for a moment before the screen moves on.
   */
  const [frozen, setFrozen] = useState<ShipConfirmation | null>(null);
  // Not once "Ship it" is tapped: a successful post navigates straight to the order.
  useLeaveGuard(draft.itemIds.length > 0 && !frozen, "sales order");

  // If the list refreshes (e.g. after "someone else just sold that coil"), take sold items off this order.
  useEffect(() => {
    if (items.data) setDraft((d) => keepAvailable(d, items.data));
  }, [items.data]);

  const available = items.data ?? [];
  const lines = useMemo(() => productLines(draft, items.data ?? []), [draft, items.data]);
  const totals = draftTotals(lines);
  const missing = missingSteps(draft, lines);
  const customer = customers.data?.find((c) => c.id === draft.customerId);
  const container = normalizeContainer(draft.containerNumber);
  const confirmation = frozen ?? (customer ? shipConfirmation(customer.name, lines, container) : null);

  if (!customers.data || !items.data)
    return (
      <>
        <PageHeader title="New sales order" />
        <QueryState
          isPending={customers.isPending || items.isPending}
          error={customers.error ?? items.error}
          onRetry={() => {
            customers.refetch();
            items.refetch();
          }}
        />
      </>
    );

  function ship() {
    if (frozen) return; // already posting, or posted and about to leave this screen
    setFrozen(confirmation);
    post.mutate(toRequest(draft, lines), {
      onSuccess: (created) => navigate(`/sales/${created.id}`, { replace: true, state: { justShipped: true } }),
      onError: (error) => {
        setFrozen(null); // back to the live order, so a retry ships exactly what the dialog shows
        if (!(error instanceof ApiError && error.status === 409)) return; // stays in the dialog to retry
        // The item list refetches and anything gone comes off the order, so close the dialog: "Ship it" must not
        // silently ship a smaller order.
        setConfirming(false);
        post.reset();
        setNotice(`${error.message} It's been taken off this order. Check the order, then ship again.`);
      },
    });
  }

  return (
    <>
      <PageHeader title="New sales order" subtitle="Pick the customer and the items going in the container." />
      {notice && (
        <Alert severity="warning" onClose={() => setNotice(null)} sx={{ mb: 3, fontSize: "1.1rem" }}>
          {notice}
        </Alert>
      )}
      <Stack spacing={4} sx={{ pb: 2 }}>
        <PickList
          label="1. Who is buying?"
          options={customers.data.map((c) => ({ id: c.id, value: c.id, label: c.name }))}
          value={draft.customerId}
          onChange={(customerId) => setDraft((d) => ({ ...d, customerId }))}
          emptyText="No customers yet. Ask an admin to add one."
        />

        <ItemChecklist
          label="2. What's going in the container?"
          items={available}
          selectedIds={draft.itemIds}
          onToggle={(item) => setDraft((d) => toggleItem(d, item))}
        />

        {lines.length > 0 && (
          <Stack spacing={1.5}>
            <Typography variant="h6" component="h2">
              3. Check the prices
            </Typography>
            {lines.map((line) => (
              <Paper key={line.productId} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                >
                  <Box>
                    <Typography sx={{ fontSize: "1.15rem", fontWeight: 600 }}>{line.productName}</Typography>
                    <Typography color="text.secondary">
                      {line.items.map((i) => i.tag).join(", ")} · {formatLbs(line.weightLbs)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <Box sx={{ textAlign: "right" }}>
                      {line.pricePerLb === null ? (
                        <Typography color="error.main" sx={{ fontWeight: 600 }}>
                          No price yet
                        </Typography>
                      ) : (
                        <>
                          <Typography sx={{ fontSize: "1.15rem", fontWeight: 600 }}>
                            {formatPrice(line.pricePerLb)}
                          </Typography>
                          {line.revenue !== null && (
                            <MoneyText amount={line.revenue} sx={{ color: "text.secondary" }} />
                          )}
                        </>
                      )}
                    </Box>
                    <Button variant="outlined" size="large" onClick={() => setPricing(line)}>
                      {line.pricePerLb === null ? "Enter price" : "Change"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Stack spacing={1.5} sx={{ maxWidth: 480 }}>
          <Typography variant="h6" component="h2">
            {lines.length > 0 ? "4." : "3."} Container number (optional)
          </Typography>
          <TextField
            placeholder="e.g. MSCU1234567"
            value={draft.containerNumber}
            onChange={(e) => setDraft((d) => ({ ...d, containerNumber: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 50, autoCapitalize: "characters", autoCorrect: "off" } }}
          />
        </Stack>
      </Stack>

      <ActionBar>
        <Box>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 700 }}>
            {totals.itemCount === 0
              ? "Nothing picked yet"
              : `${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"} · ${formatLbs(totals.weightLbs)}` +
                (totals.revenue === null ? "" : ` · ${formatMoney(totals.revenue)}`)}
          </Typography>
          {missing.length > 0 && <Typography color="text.secondary">{missing.join(" ")}</Typography>}
        </Box>
        <BigButton
          disabled={missing.length > 0}
          onClick={() => {
            setNotice(null);
            setConfirming(true);
          }}
        >
          Review and ship
        </BigButton>
      </ActionBar>

      {pricing && (
        <PriceDialog
          productName={pricing.productName}
          initial={pricing.pricePerLb}
          onCancel={() => setPricing(null)}
          onSave={(price) => {
            setDraft((d) => setPrice(d, pricing.productId, price));
            setPricing(null);
          }}
        />
      )}

      <ConfirmSummary
        open={confirming}
        title="Ship this sales order?"
        summary={confirmation?.summary ?? ""}
        details={[
          ...(confirmation?.rows ?? []).map((r) => ({
            id: r.productId,
            label: r.label,
            value: r.revenue === null ? "—" : <MoneyText amount={r.revenue} />,
          })),
          { id: "container", label: "Container", value: confirmation?.containerNumber ?? "None" },
        ]}
        warning={confirmation?.containerNumber ? undefined : "No container number. You can still ship."}
        error={post.error ? errorText(post.error) : undefined}
        confirmLabel="Ship it"
        busy={post.isPending}
        onConfirm={ship}
        onCancel={() => {
          setConfirming(false);
          setFrozen(null);
          post.reset();
        }}
      />
    </>
  );
}
