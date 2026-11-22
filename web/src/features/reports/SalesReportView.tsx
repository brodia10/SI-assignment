import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatMoney, MoneyText } from "../../components";
import { QueryState } from "../sales/QueryState";
import { formatLbs, formatPrice } from "../sales/salesOrderDraft";
import { formatMargin } from "./reportFormat";
import { type SalesReportOrder, useSalesReport } from "./reportsApi";
import { StatTiles } from "./StatTiles";

const shipDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** Profit and margin per sales order. Margin = profit ÷ revenue. */
export function SalesReportView() {
  const report = useSalesReport();
  if (!report.data)
    return <QueryState isPending={report.isPending} error={report.error} onRetry={() => report.refetch()} />;
  const r = report.data;

  return (
    <>
      <StatTiles
        stats={[
          { label: "Sold for", value: formatMoney(r.revenue) },
          { label: "Cost", value: formatMoney(r.cost) },
          { label: "Profit", value: <MoneyText amount={r.profit} signColor /> },
          { label: "Margin", value: formatMargin(r.margin) },
        ]}
      />
      {r.orders.length === 0 ? (
        <Typography color="text.secondary">No sales orders shipped yet.</Typography>
      ) : (
        r.orders.map((o) => <OrderRow key={o.id} order={o} />)
      )}
    </>
  );
}

function OrderRow({ order: o }: { order: SalesReportOrder }) {
  return (
    <Accordion variant="outlined" disableGutters sx={{ "&:not(:last-of-type)": { mb: 1.5 } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />} sx={{ minHeight: 72 }}>
        <Box
          sx={{
            display: "grid",
            width: "100%",
            gap: 1,
            alignItems: "center",
            gridTemplateColumns: { xs: "1fr 1fr", md: "2fr repeat(4, 1fr)" },
          }}
        >
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700 }}>SO #{o.number}</Typography>
            <Typography color="text.secondary">
              {o.customerName} · {shipDate.format(new Date(o.shippedAt))}
              {o.containerNumber && ` · ${o.containerNumber}`}
            </Typography>
          </Box>
          <Figure label="Sold for" value={<MoneyText amount={o.revenue} />} />
          <Figure label="Cost" value={<MoneyText amount={o.cost} />} />
          <Figure label="Profit" value={<MoneyText amount={o.profit} signColor />} />
          <Figure label="Margin" value={formatMargin(o.margin)} />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tag</TableCell>
              <TableCell>Product</TableCell>
              <TableCell align="right">Weight</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Sold for</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">Profit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {o.lines.map((l) => (
              <TableRow key={l.inventoryItemId}>
                <TableCell>
                  <Chip
                    label={l.tag}
                    component={Link}
                    to={`/reports/lineage/${l.inventoryItemId}`}
                    clickable
                    variant="outlined"
                    sx={{ minHeight: 48, fontSize: "1rem" }}
                  />
                </TableCell>
                <TableCell>{l.productName}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {formatLbs(l.weightLbs)}
                </TableCell>
                <TableCell align="right">{formatPrice(l.pricePerLb)}</TableCell>
                <TableCell align="right">
                  <MoneyText amount={l.revenue} />
                </TableCell>
                <TableCell align="right">
                  <MoneyText amount={l.cost} />
                </TableCell>
                <TableCell align="right">
                  <MoneyText amount={l.profit} signColor />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          {formatLbs(o.weightLbs)} shipped. Cost is what the items cost when they were bought, carried through any work
          orders.
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ textAlign: { md: "right" } }}>
      <Typography color="text.secondary" sx={{ fontSize: "0.95rem" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
