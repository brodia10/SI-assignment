import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Link } from "react-router";
import { formatMoney, MoneyText, perLb } from "../../components";
import { QueryState } from "../sales/QueryState";
import { formatLbs } from "../sales/salesOrderDraft";
import { useInventoryReport } from "./reportsApi";
import { StatTiles } from "./StatTiles";

/** What's in stock, by product, then by location. Tap a tag to trace it. */
export function InventoryReportView() {
  const report = useInventoryReport();
  if (!report.data)
    return <QueryState isPending={report.isPending} error={report.error} onRetry={() => report.refetch()} />;
  const r = report.data;

  return (
    <>
      <StatTiles
        stats={[
          { label: "Items in stock", value: r.itemCount },
          { label: "Total weight", value: formatLbs(r.weightLbs) },
          { label: "Total cost", value: formatMoney(r.totalCost) },
        ]}
      />
      {r.products.length === 0 && <Typography color="text.secondary">Nothing is in stock.</Typography>}
      <Stack spacing={3}>
        {r.products.map((p) => {
          const avg = perLb(p.totalCost, p.weightLbs);
          return (
            <Paper key={p.productId} variant="outlined" sx={{ overflowX: "auto" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ p: 2, justifyContent: "space-between", alignItems: { sm: "baseline" } }}
              >
                <Typography variant="h5" component="h2">
                  {p.productName}
                  {p.isScrap && <Chip label="Scrap" size="small" sx={{ ml: 1, verticalAlign: "middle" }} />}
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>
                  {p.itemCount} {p.itemCount === 1 ? "item" : "items"} · {formatLbs(p.weightLbs)} ·{" "}
                  <MoneyText amount={p.totalCost} />
                  {avg !== null && (
                    <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                      {" "}
                      (<MoneyText amount={avg} perLb />)
                    </Box>
                  )}
                </Typography>
              </Stack>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="right">Weight</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.locations.map((l) => (
                    <TableRow key={l.locationId}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{l.locationName}</TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                          {l.items.map((i) => (
                            <Chip
                              key={i.id}
                              label={i.tag}
                              component={Link}
                              to={`/reports/lineage/${i.id}`}
                              clickable
                              variant="outlined"
                              sx={{ minHeight: 48, fontSize: "1rem" }}
                            />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {formatLbs(l.weightLbs)}
                      </TableCell>
                      <TableCell align="right">
                        <MoneyText amount={l.totalCost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          );
        })}
      </Stack>
    </>
  );
}
