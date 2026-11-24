import { Navigate, Route, Routes } from "react-router";
import { NewPurchaseOrderPage } from "./NewPurchaseOrderPage";
import { PurchaseOrderDetailPage } from "./PurchaseOrderDetailPage";
import { PurchaseOrderList } from "./PurchaseOrderList";

/** /purchasing (the PO list), /purchasing/new (write a PO) and /purchasing/:id (one PO, read-only). */
export function PurchasingPage() {
  return (
    <Routes>
      <Route index element={<PurchaseOrderList />} />
      <Route path="new" element={<NewPurchaseOrderPage />} />
      <Route path=":id" element={<PurchaseOrderDetailPage />} />
      <Route path="*" element={<Navigate to="/purchasing" replace />} />
    </Routes>
  );
}
