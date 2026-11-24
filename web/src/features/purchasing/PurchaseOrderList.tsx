import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Alert, Box, Button, ButtonBase, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router";
import { BigButton, EmptyState, MoneyText, PageHeader } from "../../components";
import { usePurchaseOrders } from "./api";
import { formatLbs, purchaseOrderStatusChip } from "./format";
import type { PoDetailFrom } from "./poDetail";

const fromList: PoDetailFrom = { from: "purchasing" };

/** The Purchasing home: recent POs, newest first, with a big "New PO" button. Tap a PO to see its detail. */
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
        <EmptyState>No purchase orders yet. Tap “New PO” to write the first one.</EmptyState>
      ) : (
        <Paper variant="outlined" component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {orders.data.map((po, i) => {
            const chip = purchaseOrderStatusChip[po.status];
            return (
              <Stack
                component="li"
                key={po.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", pr: 2, borderTop: i > 0 ? 1 : 0, borderColor: "divider" }}
              >
                {/* The whole row opens the detail. "Receive" sits beside the link, not inside it. */}
                <ButtonBase
                  component={Link}
                  to={`/purchasing/${po.id}`}
                  state={fromList}
                  sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    minHeight: 72,
                    px: 2.5,
                    py: 2,
                    gap: 2,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "center" },
                    "&:hover": { bgcolor: "action.hover" },
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
                  <Chip
                    label={chip.label}
                    color={chip.color}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" }, cursor: "inherit" }}
                  />
                  <MoneyText
                    amount={po.total}
                    sx={{ fontSize: "1.25rem", fontWeight: 700, minWidth: 130, textAlign: { sm: "right" } }}
                  />
                  <ChevronRightIcon color="action" sx={{ display: { xs: "none", sm: "block" } }} />
                </ButtonBase>
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
