import AddIcon from "@mui/icons-material/Add";
import { List, ListItemButton, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router";
import { BigButton, EmptyState, MoneyText, PageHeader } from "../../components";
import { QueryState } from "./QueryState";
import { useSalesOrders } from "./salesApi";
import { formatLbs } from "./salesOrderDraft";

const shipDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function SalesOrderList() {
  const orders = useSalesOrders();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle="Sell in-stock items and ship them in a container."
        action={
          <BigButton onClick={() => navigate("new")} startIcon={<AddIcon />}>
            New sales order
          </BigButton>
        }
      />
      <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
        Recent sales orders
      </Typography>
      <QueryState isPending={orders.isPending} error={orders.error} onRetry={() => orders.refetch()} />
      {orders.data &&
        (orders.data.length === 0 ? (
          <EmptyState>No sales orders yet. Tap “New sales order” to ship the first one.</EmptyState>
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {orders.data.map((o, i) => (
                <ListItemButton
                  key={o.id}
                  component={Link}
                  to={String(o.id)}
                  divider={i < orders.data.length - 1}
                  sx={{ minHeight: 72 }}
                >
                  <ListItemText
                    primary={`SO #${o.number} · ${o.customerName}`}
                    secondary={[
                      shipDate.format(new Date(o.shippedAt)),
                      o.containerNumber ? `Container ${o.containerNumber}` : null,
                      `${o.itemCount} ${o.itemCount === 1 ? "item" : "items"}, ${formatLbs(o.weightLbs)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    slotProps={{ primary: { sx: { fontSize: "1.15rem", fontWeight: 600 } } }}
                  />
                  <Stack sx={{ ml: 2 }}>
                    <MoneyText amount={o.revenue} sx={{ fontSize: "1.15rem", fontWeight: 600 }} />
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        ))}
    </>
  );
}
