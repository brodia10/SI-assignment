import { Tab, Tabs } from "@mui/material";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { PageHeader } from "../../components";
import { LocationsTab } from "./LocationsTab";
import { ProductEditor } from "./ProductEditor";
import { ProductsTab } from "./ProductsTab";
import { UsersTab } from "./UsersTab";
import { VendorsTab } from "./VendorsTab";

const tabs = [
  { id: "products", label: "Products & prices" },
  { id: "locations", label: "Locations" },
  { id: "vendors", label: "Vendors" },
  { id: "users", label: "Users" },
] as const;

/** /admin/*: one tab per kind of setup data. Each tab is its own route, so Back and refresh keep your place. */
export function AdminPage() {
  const { pathname } = useLocation();
  const current = tabs.find((t) => pathname.startsWith(`/admin/${t.id}`))?.id ?? false;

  return (
    <>
      <PageHeader title="Admin" subtitle="Products and prices, locations, vendors and users." />
      <Tabs
        value={current}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Admin sections"
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} component={Link} to={`/admin/${t.id}`} />
        ))}
      </Tabs>
      <Routes>
        <Route index element={<Navigate to="products" replace />} />
        <Route path="products" element={<ProductsTab />} />
        <Route path="products/new" element={<ProductEditor />} />
        <Route path="products/:id" element={<ProductEditor />} />
        <Route path="locations" element={<LocationsTab />} />
        <Route path="vendors" element={<VendorsTab />} />
        <Route path="users" element={<UsersTab />} />
        <Route path="*" element={<Navigate to="products" replace />} />
      </Routes>
    </>
  );
}
