import { Navigate, Route, Routes } from "react-router";
import { PickPurchaseOrder } from "./PickPurchaseOrder";
import { ReceivePurchaseOrderPage } from "./ReceivePurchaseOrderPage";

/** /receiving (pick an open PO) and /receiving/:purchaseOrderId (put it away). */
export function ReceivingPage() {
  return (
    <Routes>
      <Route index element={<PickPurchaseOrder />} />
      <Route path=":purchaseOrderId" element={<ReceivePurchaseOrderPage />} />
      <Route path="*" element={<Navigate to="/receiving" replace />} />
    </Routes>
  );
}
