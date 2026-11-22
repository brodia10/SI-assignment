import { Box, Tab, Tabs } from "@mui/material";
import { Link, Route, Routes, useLocation } from "react-router";
import { PageHeader } from "../../components";
import { InventoryReportView } from "./InventoryReportView";
import { ItemLineageView } from "./ItemLineageView";
import { SalesReportView } from "./SalesReportView";

const tabs = [
  { path: "/reports", label: "Inventory" },
  { path: "/reports/sales", label: "Sales & margin" },
  { path: "/reports/lineage", label: "Trace an item" },
] as const;

/** Admin reports: /reports (inventory), /reports/sales, /reports/lineage[/:itemId]. */
export function ReportsPage() {
  const { pathname } = useLocation();
  const current = [...tabs].reverse().find((t) => pathname.startsWith(t.path))?.path ?? "/reports";

  return (
    <>
      <PageHeader title="Reports" subtitle="How much inventory there is, where it is, and what each sale made." />
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={current} variant="scrollable" allowScrollButtonsMobile>
          {tabs.map((t) => (
            <Tab key={t.path} value={t.path} label={t.label} component={Link} to={t.path} />
          ))}
        </Tabs>
      </Box>
      <Routes>
        <Route index element={<InventoryReportView />} />
        <Route path="sales" element={<SalesReportView />} />
        <Route path="lineage" element={<ItemLineageView />} />
        <Route path="lineage/:itemId" element={<ItemLineageView />} />
      </Routes>
    </>
  );
}
