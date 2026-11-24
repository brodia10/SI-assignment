import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Alert,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useId } from "react";
import { Link, useNavigate } from "react-router";
import { formatMoney, PageHeader, PickList } from "../../components";
import { usePurchaseOrders, useRecentlyReceived } from "../purchasing/api";
import { formatLbs } from "../purchasing/format";
import type { PoDetailFrom } from "../purchasing/poDetail";

const fromReceiving: PoDetailFrom = { from: "receiving" };
const receivedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * /receiving — tap the PO that just arrived. Only Open POs are listed there; below it, the last few receipts open
 * the PO's detail, so the tags and locations can be looked up again after the "received" screen is gone.
 */
export function PickPurchaseOrder() {
  const navigate = useNavigate();
  const orders = usePurchaseOrders("Open");

  return (
    <>
      <PageHeader title="Receiving" subtitle="Pick the purchase order that was delivered." />
      {orders.isPending ? (
        <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />
      ) : orders.isError ? (
        <Alert severity="error" action={<Button onClick={() => orders.refetch()}>Try again</Button>}>
          {orders.error.message}
        </Alert>
      ) : (
        <PickList
          label="Which PO arrived?"
          options={orders.data.map((po) => ({
            id: po.id,
            value: po.id,
            label: `PO #${po.number} · ${po.vendorName}`,
            secondary: `${po.lineCount} ${po.lineCount === 1 ? "product" : "products"} · ${formatLbs(po.totalWeightLbs)} · ${formatMoney(po.total)}`,
            searchText: String(po.number),
          }))}
          value={null}
          onChange={(id) => navigate(String(id))}
          emptyText="Nothing waiting to be received. Every purchase order is in."
        />
      )}
      <RecentlyReceived />
    </>
  );
}

/**
 * Hidden until something has been received, and quietly left out if it can't load: it's a lookup, not the task.
 * Plain links (not a PickList): tapping one opens a page, it doesn't pick a value.
 */
function RecentlyReceived() {
  const received = useRecentlyReceived();
  const headingId = useId();
  if (!received.data || received.data.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mt: 5 }}>
      <Typography id={headingId} variant="h6" component="h2">
        Recently received
      </Typography>
      <Paper variant="outlined">
        <List disablePadding aria-labelledby={headingId}>
          {received.data.map((po, i) => (
            <ListItemButton
              key={po.id}
              component={Link}
              to={`/purchasing/${po.id}`}
              state={fromReceiving}
              divider={i < received.data.length - 1}
              sx={{ minHeight: 64, py: 1.5 }}
            >
              <ListItemText
                primary={`PO #${po.number} · ${po.vendorName}`}
                secondary={[
                  po.receivedAt && `Received ${receivedOn.format(new Date(po.receivedAt))}`,
                  formatLbs(po.totalWeightLbs),
                  formatMoney(po.total),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                slotProps={{ primary: { sx: { fontSize: "1.15rem", fontWeight: 500 } } }}
              />
              <ChevronRightIcon color="action" />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Stack>
  );
}
