import { Navigate, Route, Routes } from "react-router";
import { NewPurchaseOrderPage } from "./NewPurchaseOrderPage";
import { PurchaseOrderList } from "./PurchaseOrderList";

/** /purchasing (the PO list) and /purchasing/new (write a PO). */
export function PurchasingPage() {
  return (
    <Routes>
      <Route index element={<PurchaseOrderList />} />
      <Route path="new" element={<NewPurchaseOrderPage />} />
      <Route path="*" element={<Navigate to="/purchasing" replace />} />
    </Routes>
  );
}
