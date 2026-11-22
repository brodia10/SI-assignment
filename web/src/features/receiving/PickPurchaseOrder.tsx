import { Alert, Button, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router";
import { formatMoney, PageHeader, PickList } from "../../components";
import { usePurchaseOrders } from "../purchasing/api";
import { formatLbs } from "../purchasing/format";

/** /receiving — tap the PO that just arrived. Only Open POs are listed. */
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
    </>
  );
}
