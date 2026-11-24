import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ActionBar,
  BigButton,
  ConfirmSummary,
  insertAt,
  MoneyText,
  PageHeader,
  PickList,
  SuccessCard,
  UndoSnackbar,
  useLeaveGuard,
} from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";
import { type PurchaseOrder, type Supplier, useCreatePurchaseOrder, usePurchaseOrderFormOptions } from "./api";
import { formatBuyPrice, formatLbs } from "./format";
import { type LineDraft, LineEditorDialog } from "./LineEditorDialog";
import { lineTotal, poTotal } from "./poMath";
import { describePurchaseOrder, whatsMissing } from "./poSummary";
import { QuickAddSupplierDialog } from "./QuickAddSupplierDialog";

/** Which dialog is open: none, the supplier quick-add, or the line editor (with the line, or undefined for new). */
type OpenDialog = { kind: "none" } | { kind: "supplier" } | { kind: "line"; line?: LineDraft } | { kind: "confirm" };

/** Write a PO: pick the supplier, add each graded product with its weight and price, review, create. */
export function NewPurchaseOrderPage() {
  const options = usePurchaseOrderFormOptions();
  const create = useCreatePurchaseOrder();
  const navigate = useNavigate();

  const [supplierId, setSupplierId] = useState<number | null>(null);
  // A just-added supplier, shown before the refetched list includes it.
  const [addedSupplier, setAddedSupplier] = useState<Supplier | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [dialog, setDialog] = useState<OpenDialog>({ kind: "none" });
  const [created, setCreated] = useState<PurchaseOrder | null>(null);
  const [removed, setRemoved] = useState<{ line: LineDraft; index: number } | null>(null);
  useLeaveGuard(!created && lines.length > 0, "purchase order");

  if (options.isPending) return <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />;
  if (options.isError)
    return (
      <Alert severity="error" action={<Button onClick={() => options.refetch()}>Try again</Button>}>
        {options.error.message}
      </Alert>
    );

  if (created)
    return (
      <PurchaseOrderCreated
        po={created}
        onReceive={() => navigate(`/receiving/${created.id}`)}
        onAnother={() => {
          setCreated(null);
          setRemoved(null);
          setSupplierId(null);
          setLines([]);
          create.reset();
        }}
        onDone={() => navigate("/purchasing")}
      />
    );

  const suppliers = [...options.data.suppliers];
  if (addedSupplier && !suppliers.some((s) => s.id === addedSupplier.id)) suppliers.unshift(addedSupplier);
  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const missing = whatsMissing(supplier !== null, lines.length);
  const total = poTotal(lines);

  function saveLine(line: LineDraft) {
    setLines((current) =>
      current.some((l) => l.key === line.key)
        ? current.map((l) => (l.key === line.key ? line : l))
        : [...current, line],
    );
    setDialog({ kind: "none" });
  }

  function removeLine(line: LineDraft) {
    setRemoved({ line, index: lines.findIndex((l) => l.key === line.key) });
    setLines((current) => current.filter((l) => l.key !== line.key));
  }

  function undoRemove() {
    if (!removed) return;
    const { line, index } = removed;
    setLines((current) => insertAt(current, line, index));
    setRemoved(null);
  }

  function confirm() {
    if (!supplier) return;
    create.mutate(
      {
        vendorId: supplier.id,
        lines: lines.map((l) => ({
          productId: l.productId,
          weightLbs: l.weightLbs,
          pricePerLb: l.pricePerLb,
          grade: l.grade || null,
        })),
      },
      {
        onSuccess: (po) => {
          setDialog({ kind: "none" });
          setRemoved(null);
          setCreated(po);
        },
      },
    );
  }

  return (
    <>
      <PageHeader title="New purchase order" subtitle="Pick the supplier, then add each product you graded." />

      <Stack spacing={4} sx={{ pb: 16 }}>
        <Stack spacing={1.5}>
          <PickList
            label="1. Who are you buying from?"
            options={suppliers.map((s) => ({ id: s.id, value: s.id, label: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
            emptyText="No suppliers yet. Add one below."
          />
          <Button
            variant="outlined"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: "supplier" })}
            sx={{ alignSelf: "flex-start", minHeight: BIG_TOUCH_TARGET }}
          >
            Add a new supplier
          </Button>
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="h6" component="h2">
            2. What are you buying?
          </Typography>
          {lines.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography color="text.secondary">
                No products yet. Tap “Add a product” for each one you graded.
              </Typography>
            </Paper>
          ) : (
            <Paper variant="outlined">
              {lines.map((line, i) => (
                <Stack
                  key={line.key}
                  direction="row"
                  spacing={2}
                  sx={{
                    alignItems: "center",
                    px: 2.5,
                    py: 2,
                    borderTop: i > 0 ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "1.2rem", fontWeight: 600 }}>{line.productName}</Typography>
                    <Typography color="text.secondary">
                      {formatLbs(line.weightLbs)} × {formatBuyPrice(line.pricePerLb)}
                      {line.grade && ` · Grade ${line.grade}`}
                    </Typography>
                  </Box>
                  <MoneyText amount={lineTotal(line)} sx={{ fontSize: "1.2rem", fontWeight: 600 }} />
                  <IconButton
                    aria-label={`Change ${line.productName}`}
                    onClick={() => setDialog({ kind: "line", line })}
                  >
                    <EditOutlinedIcon />
                  </IconButton>
                  <IconButton aria-label={`Remove ${line.productName}`} onClick={() => removeLine(line)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}
            </Paper>
          )}
          <Button
            variant="outlined"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setDialog({ kind: "line" })}
            sx={{ alignSelf: "flex-start", minHeight: BIG_TOUCH_TARGET }}
          >
            Add a product
          </Button>
        </Stack>
      </Stack>

      {/* The total and the next step stay in view while the list grows. */}
      <ActionBar>
        <Box>
          <Typography color="text.secondary">PO total</Typography>
          <MoneyText amount={total} sx={{ fontSize: "2rem", fontWeight: 700 }} />
        </Box>
        <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
          <BigButton
            disabled={missing !== null}
            onClick={() => {
              create.reset();
              setRemoved(null); // the undo bar would sit on top of the confirmation
              setDialog({ kind: "confirm" });
            }}
          >
            Review PO
          </BigButton>
          {missing && <Typography color="text.secondary">{missing}</Typography>}
        </Stack>
      </ActionBar>

      <UndoSnackbar
        removal={removed && { key: removed.line.key, message: `Removed ${removed.line.productName}` }}
        onUndo={undoRemove}
        onClose={() => setRemoved(null)}
      />

      {dialog.kind === "supplier" && (
        <QuickAddSupplierDialog
          onClose={() => setDialog({ kind: "none" })}
          onAdded={(added) => {
            setAddedSupplier(added);
            setSupplierId(added.id);
            setDialog({ kind: "none" });
          }}
        />
      )}

      {dialog.kind === "line" && (
        <LineEditorDialog
          products={options.data.products}
          line={dialog.line}
          onSave={saveLine}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}

      {supplier && (
        <ConfirmSummary
          open={dialog.kind === "confirm"}
          title="Create this PO?"
          summary={describePurchaseOrder(supplier.name, lines)}
          details={[
            ...lines.map((l) => ({
              id: l.key,
              label: `${l.productName}: ${formatLbs(l.weightLbs)} × ${formatBuyPrice(l.pricePerLb)}`,
              value: <MoneyText amount={lineTotal(l)} />,
            })),
            { id: "total", label: "PO total", value: <MoneyText amount={total} /> },
          ]}
          confirmLabel="Create PO"
          busy={create.isPending}
          error={create.error?.message}
          onConfirm={confirm}
          onCancel={() => setDialog({ kind: "none" })}
        />
      )}
    </>
  );
}

interface PurchaseOrderCreatedProps {
  po: PurchaseOrder;
  onReceive: () => void;
  onAnother: () => void;
  onDone: () => void;
}

function PurchaseOrderCreated({ po, onReceive, onAnother, onDone }: PurchaseOrderCreatedProps) {
  return (
    <SuccessCard
      title={`PO #${po.number} created`}
      subtitle={
        <>
          {po.vendorName} · {po.lines.length} {po.lines.length === 1 ? "product" : "products"} ·{" "}
          {formatLbs(po.totalWeightLbs)} · <MoneyText amount={po.total} sx={{ fontWeight: 700 }} />
        </>
      }
      actions={
        <>
          <BigButton onClick={onReceive}>Receive it now</BigButton>
          <BigButton variant="outlined" onClick={onAnother}>
            Write another PO
          </BigButton>
          <Button size="large" onClick={onDone}>
            Back to purchase orders
          </Button>
        </>
      }
    >
      <Typography color="text.secondary" sx={{ textAlign: "center" }}>
        When the material arrives, receive it to put it into inventory.
      </Typography>
    </SuccessCard>
  );
}
