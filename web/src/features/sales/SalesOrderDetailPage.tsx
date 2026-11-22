import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Alert, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router";
import { BigButton, MoneyText, PageHeader } from "../../components";
import { QueryState } from "./QueryState";
import { useSalesOrder } from "./salesApi";
import { formatLbs, formatPrice } from "./salesOrderDraft";

const shipDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** One shipped sales order. Right after posting it also says so, so the purchaser knows it went through. */
export function SalesOrderDetailPage() {
  const param = useParams().id;
  const id = Number.isInteger(Number(param)) ? Number(param) : null;
  const justShipped = (useLocation().state as { justShipped?: boolean } | null)?.justShipped === true;
  const order = useSalesOrder(id);
  const navigate = useNavigate();

  if (!order.data)
    return <QueryState isPending={order.isPending} error={order.error} onRetry={() => order.refetch()} />;
  const o = order.data;

  return (
    <>
      <PageHeader
        title={`Sales order #${o.number}`}
        subtitle={[o.customerName, o.containerNumber ? `Container ${o.containerNumber}` : "No container number"].join(
          " · ",
        )}
      />
      {justShipped && (
        <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ mb: 3, fontSize: "1.2rem" }}>
          Shipped. SO #{o.number} is posted and its items are marked sold.
        </Alert>
      )}
      <Paper variant="outlined" sx={{ mb: 3, overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">Weight</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {o.lines.map((l) => (
              <TableRow key={l.inventoryItemId}>
                <TableCell sx={{ fontWeight: 600 }}>{l.tag}</TableCell>
                <TableCell>{l.productName}</TableCell>
                <TableCell align="right">{formatLbs(l.weightLbs)}</TableCell>
                <TableCell align="right">{formatPrice(l.pricePerLb)}</TableCell>
                <TableCell align="right">
                  <MoneyText amount={l.revenue} />
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} sx={{ fontWeight: 700 }}>
                Total
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatLbs(o.weightLbs)}
              </TableCell>
              <TableCell />
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                <MoneyText amount={o.revenue} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Shipped {shipDate.format(new Date(o.shippedAt))} by {o.shippedByEmail}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <BigButton onClick={() => navigate("/sales/new")}>Start another sales order</BigButton>
        <BigButton onClick={() => navigate("/sales")} variant="outlined">
          Back to sales
        </BigButton>
      </Stack>
    </>
  );
}
