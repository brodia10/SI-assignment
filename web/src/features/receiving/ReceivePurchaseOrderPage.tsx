import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BigButton, ConfirmSummary, MoneyText, PageHeader, PickList, WeightInput } from "../../components";
import { type PurchaseOrder, usePurchaseOrder } from "../purchasing/api";
import { formatLbs } from "../purchasing/format";
import type { PoDetailFrom } from "../purchasing/poDetail";
import { type Location, type Receipt, useReceivePurchaseOrder, useReceivingLocations } from "./api";
import {
  describeReceipt,
  type ReceiveLineDraft,
  weightDifferenceText,
  weightWarning,
  whatsMissing,
} from "./receiveChecks";

type ReceiveMutation = ReturnType<typeof useReceivePurchaseOrder>;

/** /receiving/:purchaseOrderId — put each product on the PO away, then post the receipt. */
export function ReceivePurchaseOrderPage() {
  const navigate = useNavigate();
  const id = Number(useParams().purchaseOrderId);
  const po = usePurchaseOrder(id);
  const locations = useReceivingLocations();
  // The mutation lives here, not in the form, and its result is checked before the PO's status. Once posted, the
  // refetched PO says "Received", which swaps the form out; the screen must still show the tags just assigned.
  const receive = useReceivePurchaseOrder();

  if (receive.data)
    return <ReceiptDone receipt={receive.data} onAnother={() => navigate("/receiving")} onHome={() => navigate("/")} />;

  if (!Number.isInteger(id) || id <= 0) return <BackToList message="That isn't a purchase order." />;
  if (po.isPending || locations.isPending) return <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />;
  if (po.isError) return <BackToList message={po.error.message} />;
  if (locations.isError) return <BackToList message={locations.error.message} />;
  if (po.data.status !== "Open")
    return (
      <BackToList
        message={
          po.data.status === "Received"
            ? `PO #${po.data.number} has already been received. Its items are in inventory.`
            : `PO #${po.data.number} was voided, so it can't be received.`
        }
        severity="info"
        detailPath={po.data.status === "Received" ? `/purchasing/${po.data.id}` : undefined}
      />
    );

  return <ReceiveForm key={po.data.id} po={po.data} locations={locations.data} receive={receive} />;
}

interface BackToListProps {
  message: string;
  severity?: "error" | "info";
  /** For a PO that's already in: its detail, which shows the tags and locations it was received into. */
  detailPath?: string;
}

function BackToList({ message, severity = "error", detailPath }: BackToListProps) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Receiving" />
      <Alert severity={severity} sx={{ fontSize: "1.1rem", mb: 2 }}>
        {message}
      </Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        {detailPath && (
          <BigButton onClick={() => navigate(detailPath, { state: { from: "receiving" } satisfies PoDetailFrom })}>
            See what it became
          </BigButton>
        )}
        <BigButton variant="outlined" onClick={() => navigate("/receiving")}>
          Pick another PO
        </BigButton>
      </Stack>
    </>
  );
}

interface ReceiveFormProps {
  po: PurchaseOrder;
  locations: readonly Location[];
  receive: ReceiveMutation;
}

function ReceiveForm({ po, locations, receive }: ReceiveFormProps) {
  const [confirming, setConfirming] = useState(false);
  const [lines, setLines] = useState<ReceiveLineDraft[]>(() =>
    po.lines.map((l) => ({
      lineId: l.id,
      productName: l.productName,
      orderedLbs: l.weightLbs,
      locationId: null,
      weightLbs: l.weightLbs,
    })),
  );

  const update = (lineId: number, change: Partial<ReceiveLineDraft>) =>
    setLines((current) => current.map((l) => (l.lineId === lineId ? { ...l, ...change } : l)));

  const locationName = (locationId: number | null) => locations.find((l) => l.id === locationId)?.name ?? "";
  const missing = whatsMissing(lines);

  function post() {
    receive.mutate(
      {
        purchaseOrderId: po.id,
        lines: lines.map((l) => ({
          purchaseOrderLineId: l.lineId,
          locationId: l.locationId ?? 0,
          weightLbs: l.weightLbs ?? 0,
        })),
      },
      // Success needs nothing here: the page sees receive.data and shows the tags.
    );
  }

  return (
    <>
      <PageHeader
        title={`Receive PO #${po.number}`}
        subtitle={`${po.vendorName} · ${po.lines.length} ${po.lines.length === 1 ? "product" : "products"} · ${formatLbs(po.totalWeightLbs)}`}
      />

      <Stack spacing={3} sx={{ pb: 16 }}>
        {po.lines.map((poLine, i) => {
          const line = lines.find((l) => l.lineId === poLine.id);
          if (!line) return null;
          return (
            <ReceiveLineCard
              key={poLine.id}
              index={i}
              count={po.lines.length}
              line={line}
              grade={poLine.grade}
              cost={poLine.lineTotal}
              locations={locations}
              onChange={(change) => update(line.lineId, change)}
            />
          );
        })}
      </Stack>

      <Paper
        elevation={6}
        sx={{
          position: "sticky",
          bottom: 16,
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {missing && <Typography color="text.secondary">{missing}</Typography>}
        <BigButton
          disabled={missing !== null}
          onClick={() => {
            receive.reset();
            setConfirming(true);
          }}
        >
          Review and receive
        </BigButton>
      </Paper>

      {missing === null && (
        <ConfirmSummary
          open={confirming}
          title={`Receive PO #${po.number}?`}
          summary={describeReceipt(
            po.number,
            lines.map((l) => ({
              productName: l.productName,
              weightLbs: l.weightLbs ?? 0,
              locationName: locationName(l.locationId),
            })),
          )}
          details={lines.map((l) => ({
            id: l.lineId,
            label: l.productName,
            value: `${formatLbs(l.weightLbs ?? 0)} → ${locationName(l.locationId)}`,
          }))}
          warning={weightWarning(lines)}
          confirmLabel="Receive"
          busy={receive.isPending}
          error={receive.error?.message}
          onConfirm={post}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

interface ReceiveLineCardProps {
  index: number;
  count: number;
  line: ReceiveLineDraft;
  grade: string | null;
  cost: number;
  locations: readonly Location[];
  onChange: (change: Partial<ReceiveLineDraft>) => void;
}

function ReceiveLineCard({ index, count, line, grade, cost, locations, onChange }: ReceiveLineCardProps) {
  // The scale weight is usually the PO weight, so the number pad stays tucked away until it's needed.
  const [changingWeight, setChangingWeight] = useState(false);
  const difference = line.weightLbs === null ? null : weightDifferenceText(line.orderedLbs, line.weightLbs);

  return (
    <Card variant="outlined" sx={{ borderWidth: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography color="text.secondary">
              Product {index + 1} of {count}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="h3" component="h2">
                {line.productName}
              </Typography>
              {grade && <Chip label={`Grade ${grade}`} />}
            </Stack>
            <Typography color="text.secondary">
              PO weight {formatLbs(line.orderedLbs)} · cost <MoneyText amount={cost} />
            </Typography>
          </Box>

          <PickList
            label="Where are you putting it?"
            options={locations.map((l) => ({ id: l.id, value: l.id, label: l.name }))}
            value={line.locationId}
            onChange={(locationId) => onChange({ locationId })}
            emptyText="No locations are set up. Ask an admin to add them."
          />

          <Stack spacing={1.5}>
            <Typography variant="h6" component="h3">
              Weight
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 700 }}>
                {line.weightLbs === null ? "—" : formatLbs(line.weightLbs)}
              </Typography>
              {!changingWeight && (
                <Button variant="outlined" onClick={() => setChangingWeight(true)}>
                  Scale shows a different weight
                </Button>
              )}
              {difference && (
                <Button onClick={() => onChange({ weightLbs: line.orderedLbs })}>Use the PO weight</Button>
              )}
            </Stack>
            {difference && (
              <Alert severity="warning" sx={{ fontSize: "1.05rem" }}>
                {difference}. That's fine if it's what the scale shows. The cost stays at the PO amount.
              </Alert>
            )}
            <Collapse in={changingWeight} unmountOnExit>
              <Stack spacing={1}>
                <WeightInput
                  label="Scale weight"
                  value={line.weightLbs}
                  onChange={(weightLbs) => onChange({ weightLbs })}
                  helperText={`PO weight: ${formatLbs(line.orderedLbs)}`}
                />
                <Button onClick={() => setChangingWeight(false)} sx={{ alignSelf: "flex-start" }}>
                  Done
                </Button>
              </Stack>
            </Collapse>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface ReceiptDoneProps {
  receipt: Receipt;
  onAnother: () => void;
  onHome: () => void;
}

/** After posting: the tags to write on the material, and where each piece went. */
function ReceiptDone({ receipt, onAnother, onHome }: ReceiptDoneProps) {
  return (
    <Card variant="outlined" sx={{ maxWidth: 720, mx: "auto", borderWidth: 2, borderColor: "success.main" }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />
            <Typography variant="h2" component="h1">
              PO #{receipt.purchaseOrderNumber} received
            </Typography>
            <Typography color="text.secondary">Tag each piece with its number below.</Typography>
          </Stack>
          <Paper variant="outlined" component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {receipt.items.map((item, i) => (
              <Stack
                component="li"
                key={item.inventoryItemId}
                direction="row"
                spacing={3}
                sx={{ alignItems: "center", px: 2.5, py: 2, borderTop: i > 0 ? 1 : 0, borderColor: "divider" }}
              >
                <Typography sx={{ fontSize: "2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {item.tag}
                </Typography>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontSize: "1.2rem", fontWeight: 600 }}>{item.productName}</Typography>
                  <Typography color="text.secondary">
                    {formatLbs(item.weightLbs)} · {item.locationName}
                  </Typography>
                </Box>
                <MoneyText amount={item.totalCost} sx={{ fontSize: "1.1rem" }} />
              </Stack>
            ))}
          </Paper>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "center" }}>
            <BigButton onClick={onAnother}>Receive another PO</BigButton>
            <BigButton variant="outlined" onClick={onHome}>
              Home
            </BigButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
