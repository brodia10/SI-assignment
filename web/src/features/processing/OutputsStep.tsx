import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { BigButton, ConfirmSummary, formatMoney, MoneyText, PageHeader, perLb } from "../../components";
import { AddOutputDialog } from "./AddOutputDialog";
import {
  type InputOption,
  type LocationOption,
  type PostedWorkOrder,
  type ProductOption,
  usePostWorkOrder,
  useWorkOrderPreview,
  WorkOrderApiError,
  type WorkOrderRequest,
} from "./api";
import { BalanceBar } from "./BalanceBar";
import {
  addOutputs,
  canReview,
  type DraftOutput,
  describeOutputs,
  formatLbs,
  removeOutput,
  roomForOutputs,
  weightBalance,
} from "./workOrderDraft";

interface OutputsStepProps {
  input: InputOption;
  products: readonly ProductOption[];
  locations: readonly LocationOption[];
  outputs: readonly DraftOutput[];
  onOutputsChange: (outputs: DraftOutput[]) => void;
  onChangeInput: () => void;
  /** The input was used by someone else (409): go back to the pick list with this message. */
  onInputGone: (message: string) => void;
  onPosted: (posted: PostedWorkOrder) => void;
}

/** Step 2: list the outputs with a live weight balance and cost preview, then confirm and post. */
export function OutputsStep({
  input,
  products,
  locations,
  outputs,
  onOutputsChange,
  onChangeInput,
  onInputGone,
  onPosted,
}: OutputsStepProps) {
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const balance = weightBalance(input.weightLbs, outputs);
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const locationsById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const productName = (id: number) => productsById.get(id)?.name ?? "Unknown product";
  const locationName = (id: number) => locationsById.get(id)?.name ?? "Unknown location";

  const request = useMemo<WorkOrderRequest>(
    () => ({
      inputItemId: input.id,
      outputs: outputs.map(({ productId, weightLbs, locationId }) => ({ productId, weightLbs, locationId })),
    }),
    [input.id, outputs],
  );
  const preview = useWorkOrderPreview(outputs.length > 0 ? request : null);
  // Only trust costs that answer the outputs on screen right now, not the previous answer kept while refetching.
  const fresh = preview.data && !preview.isPlaceholderData && !preview.isFetching ? preview.data : null;
  const post = usePostWorkOrder();

  // Someone else processed or sold this item while we were building the work order.
  const previewError = preview.error;
  useEffect(() => {
    if (previewError instanceof WorkOrderApiError && previewError.status === 409) onInputGone(previewError.message);
  }, [previewError, onInputGone]);

  const reviewable = canReview(outputs, balance) && fresh?.canPost === true;

  function confirm() {
    post.mutate(request, {
      onSuccess: onPosted,
      onError: (error) => {
        if (error instanceof WorkOrderApiError && error.status === 409) onInputGone(error.message);
      },
    });
  }

  function cancelConfirm() {
    setConfirming(false);
    post.reset();
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title={`Process ${input.tag}`}
        subtitle={`${input.productName} · ${formatLbs(input.weightLbs)} · ${input.locationName} · cost ${formatMoney(input.totalCost)}`}
        action={
          <Button variant="outlined" size="large" onClick={onChangeInput}>
            Pick a different item
          </Button>
        }
      />

      <BalanceBar balance={balance} />

      {outputs.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding aria-label="Outputs">
            {outputs.map((o, i) => {
              const product = productsById.get(o.productId);
              const cost = fresh?.outputs[i]?.totalCost ?? null;
              const costPerLb = cost === null ? null : perLb(cost, o.weightLbs);
              return (
                <ListItem
                  key={o.key}
                  divider={i < outputs.length - 1}
                  sx={{ minHeight: 72, gap: 2 }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={`Remove ${productName(o.productId)}, ${formatLbs(o.weightLbs)}`}
                      onClick={() => onOutputsChange(removeOutput(outputs, o.key))}
                    >
                      <DeleteOutlinedIcon fontSize="large" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <>
                        {productName(o.productId)}
                        {product?.isScrap && <Chip size="small" label="Scrap · $0" sx={{ ml: 1 }} />}
                      </>
                    }
                    secondary={`${formatLbs(o.weightLbs)} → ${locationName(o.locationId)}`}
                    slotProps={{ primary: { sx: { fontSize: "1.15rem", fontWeight: 600 } } }}
                  />
                  <Box sx={{ textAlign: "right", mr: 4, minWidth: 120 }}>
                    {cost !== null ? (
                      <>
                        <MoneyText amount={cost} sx={{ fontSize: "1.15rem", fontWeight: 600 }} />
                        {costPerLb !== null && (
                          <Typography color="text.secondary" variant="body2">
                            <MoneyText amount={costPerLb} perLb />
                          </Typography>
                        )}
                      </>
                    ) : preview.isFetching ? (
                      <CircularProgress size={24} aria-label="Working out the cost" />
                    ) : (
                      <Typography color="text.secondary">—</Typography>
                    )}
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      {fresh && fresh.errors.length > 0 && balance.state !== "over" && (
        <Alert severity="error" sx={{ fontSize: "1.05rem" }}>
          {fresh.errors.join(" ")}
        </Alert>
      )}
      {preview.error && !(preview.error instanceof WorkOrderApiError && preview.error.status === 409) && (
        <Alert severity="error" sx={{ fontSize: "1.05rem" }}>
          {preview.error.message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <BigButton
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAdding(true)}
          disabled={roomForOutputs(outputs) === 0}
        >
          Add output
        </BigButton>
        <BigButton onClick={() => setConfirming(true)} disabled={!reviewable}>
          Review and post
        </BigButton>
      </Stack>

      {adding && (
        <AddOutputDialog
          products={products}
          locations={locations}
          remainingLbs={Math.max(0, balance.remainingLbs)}
          room={roomForOutputs(outputs)}
          onAdd={(entry, count) => {
            onOutputsChange(addOutputs(outputs, entry, count));
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {fresh && (
        <ConfirmSummary
          open={confirming}
          title={`Process ${input.tag}?`}
          summary={
            <>
              Turn {input.tag} ({formatLbs(input.weightLbs)} {input.productName}) into{" "}
              {describeOutputs(outputs, productName)}. Its {formatMoney(fresh.inputTotalCost)} cost carries over to the
              new items.
            </>
          }
          details={outputs.map((o, i) => ({
            id: o.key,
            label: `${productName(o.productId)} · ${formatLbs(o.weightLbs)} → ${locationName(o.locationId)}`,
            value: <MoneyText amount={fresh.outputs[i]?.totalCost ?? 0} />,
          }))}
          warning={fresh.warnings.length > 0 ? fresh.warnings.join(" ") : undefined}
          error={post.error?.message}
          confirmLabel="Post work order"
          busy={post.isPending}
          onConfirm={confirm}
          onCancel={cancelConfirm}
        />
      )}
    </Stack>
  );
}
