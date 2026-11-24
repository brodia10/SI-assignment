import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router";
import { formatMoney, MoneyText, PickList, perLb } from "../../components";
import { QueryState } from "../sales/QueryState";
import { formatLbs, formatPrice } from "../sales/salesOrderDraft";
import { currentPlace, statusLabel } from "./reportFormat";
import { type ItemLineage, type LineageNode, useLineage, useTraceableItems } from "./reportsApi";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** Follow an item from the PO it was bought on, through work orders, to the sales order that shipped it. */
export function ItemLineageView() {
  const param = useParams().itemId;
  const itemId = param ? Number(param) : null;
  return itemId !== null && Number.isInteger(itemId) ? <Lineage itemId={itemId} /> : <PickItem />;
}

function PickItem() {
  const items = useTraceableItems();
  const navigate = useNavigate();
  if (!items.data)
    return <QueryState isPending={items.isPending} error={items.error} onRetry={() => items.refetch()} />;

  return (
    <PickList
      label="Which item do you want to trace?"
      options={items.data.map((i) => {
        const place = currentPlace(i);
        // Once an item has left the floor, the place already says so ("Shipped on SO #5001").
        const status = i.status === "InStock" ? ` · ${statusLabel(i.status)}` : "";
        return {
          id: i.id,
          value: i.id,
          label: `${i.tag} · ${i.productName}`,
          secondary: `${formatLbs(i.weightLbs)} · ${place}${status}`,
          searchText: place,
        };
      })}
      value={null}
      onChange={(id) => navigate(`/reports/lineage/${id}`)}
      emptyText="No inventory yet."
    />
  );
}

function Lineage({ itemId }: { itemId: number }) {
  const lineage = useLineage(itemId);
  const navigate = useNavigate();

  return (
    <Stack spacing={2}>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/reports/lineage")}>
          Trace a different item
        </Button>
      </Box>
      {lineage.data ? (
        <LineageTree lineage={lineage.data} />
      ) : (
        <QueryState isPending={lineage.isPending} error={lineage.error} onRetry={() => lineage.refetch()} />
      )}
    </Stack>
  );
}

function LineageTree({ lineage }: { lineage: ItemLineage }) {
  const po = lineage.purchaseOrder;
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
        <ReceiptLongIcon color="primary" sx={{ fontSize: 40 }} />
        <Box>
          <Typography variant="h5" component="h2">
            Bought on PO #{po.number}
          </Typography>
          <Typography>
            {po.vendorName} · {day.format(new Date(po.orderedAt))}
            {po.receivedAt && `, received ${day.format(new Date(po.receivedAt))}`}
          </Typography>
          <Typography color="text.secondary">
            {formatLbs(po.weightLbs)} {po.productName} @ {formatPrice(po.pricePerLb)} ={" "}
            {formatMoney(po.weightLbs * po.pricePerLb)}
          </Typography>
        </Box>
      </Paper>
      <Typography color="text.secondary" sx={{ pl: 1 }}>
        Received as:
      </Typography>
      <NodeCard node={lineage.root} highlightId={lineage.itemId} />
    </Stack>
  );
}

function NodeCard({ node, highlightId }: { node: LineageNode; highlightId: number }) {
  const highlighted = node.id === highlightId;
  const avg = perLb(node.totalCost, node.weightLbs);
  const wo = node.processedBy;
  const place = currentPlace({
    status: node.status,
    locationName: node.locationName,
    soldOnNumber: node.soldOn?.number,
    usedInWorkOrderNumber: wo?.number,
  });

  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        sx={{ p: 2, borderWidth: highlighted ? 3 : 1, borderColor: highlighted ? "primary.main" : "divider" }}
        aria-current={highlighted ? "true" : undefined}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {node.tag} · {node.productName}
              {highlighted && <Chip label="This item" color="primary" size="small" sx={{ ml: 1 }} />}
            </Typography>
            <Typography color="text.secondary">
              {formatLbs(node.weightLbs)} · {place} · cost <MoneyText amount={node.totalCost} />
              {avg !== null && (
                <>
                  {" "}
                  (<MoneyText amount={avg} perLb />)
                </>
              )}
            </Typography>
          </Box>
          <Chip
            label={statusLabel(node.status)}
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
        {node.soldOn && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center", color: "success.dark" }}>
            <LocalShippingIcon />
            <Typography sx={{ fontWeight: 600 }}>
              Sold on SO #{node.soldOn.number} to {node.soldOn.customerName},{" "}
              {day.format(new Date(node.soldOn.shippedAt))}: {formatPrice(node.soldOn.pricePerLb)} ={" "}
              {formatMoney(node.soldOn.revenue)}
            </Typography>
          </Stack>
        )}
      </Paper>
      {wo && (
        <Box sx={{ pl: { xs: 2, sm: 4 }, borderLeft: 3, borderColor: "divider", ml: 1 }}>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            Processed on WO #{wo.number}, {day.format(new Date(wo.processedAt))}, into {wo.outputs.length}{" "}
            {wo.outputs.length === 1 ? "item" : "items"}:
          </Typography>
          <Stack spacing={1.5}>
            {wo.outputs.map((child) => (
              <NodeCard key={child.id} node={child} highlightId={highlightId} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
