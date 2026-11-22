import AddIcon from "@mui/icons-material/Add";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { BigButton, MoneyText, PageHeader } from "../../components";
import { type PurchaseOrderStatus, usePurchaseOrders } from "./api";
import { formatLbs } from "./format";

const statusChip: Record<PurchaseOrderStatus, { label: string; color: "warning" | "success" | "default" }> = {
  Open: { label: "Waiting to be received", color: "warning" },
  Received: { label: "Received", color: "success" },
  Voided: { label: "Voided", color: "default" },
};

/** The Purchasing home: recent POs, newest first, with a big "New PO" button. */
export function PurchaseOrderList() {
  const navigate = useNavigate();
  const orders = usePurchaseOrders();

  return (
    <>
      <PageHeader
        title="Purchasing"
        subtitle="Write a purchase order for material you've graded."
        action={
          <BigButton startIcon={<AddIcon />} onClick={() => navigate("new")}>
            New PO
          </BigButton>
        }
      />

      {orders.isPending ? (
        <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />
      ) : orders.isError ? (
        <Alert severity="error" action={<Button onClick={() => orders.refetch()}>Try again</Button>}>
          {orders.error.message}
        </Alert>
      ) : orders.data.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">No purchase orders yet. Tap “New PO” to write the first one.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {orders.data.map((po, i) => {
            const chip = statusChip[po.status];
            return (
              <Stack
                component="li"
                key={po.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                  alignItems: { xs: "stretch", sm: "center" },
                  px: 2.5,
                  py: 2,
                  borderTop: i > 0 ? 1 : 0,
                  borderColor: "divider",
                }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
                    PO #{po.number} · {po.vendorName}
                  </Typography>
                  <Typography color="text.secondary">
                    {new Date(po.createdAt).toLocaleDateString()} · {po.lineCount}{" "}
                    {po.lineCount === 1 ? "product" : "products"} · {formatLbs(po.totalWeightLbs)}
                  </Typography>
                </Box>
                <Chip label={chip.label} color={chip.color} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
                <MoneyText
                  amount={po.total}
                  sx={{ fontSize: "1.25rem", fontWeight: 700, minWidth: 130, textAlign: "right" }}
                />
                {po.status === "Open" && (
                  <Button variant="outlined" onClick={() => navigate(`/receiving/${po.id}`)}>
                    Receive
                  </Button>
                )}
              </Stack>
            );
          })}
        </Paper>
      )}
    </>
  );
}
