import { Route, Routes } from "react-router";
import { NewSalesOrder } from "./NewSalesOrder";
import { SalesOrderDetailPage } from "./SalesOrderDetailPage";
import { SalesOrderList } from "./SalesOrderList";

/** /sales: recent orders; /sales/new: sell and ship; /sales/:id: one shipped order. */
export function SalesPage() {
  return (
    <Routes>
      <Route index element={<SalesOrderList />} />
      <Route path="new" element={<NewSalesOrder />} />
      <Route path=":id" element={<SalesOrderDetailPage />} />
    </Routes>
  );
}
