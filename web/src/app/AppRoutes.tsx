import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router";
import { LeaveGuardProvider } from "../components";
import { AdminPage } from "../features/admin/AdminPage";
import { ProcessingPage } from "../features/processing/ProcessingPage";
import { PurchasingPage } from "../features/purchasing/PurchasingPage";
import { ReceivingPage } from "../features/receiving/ReceivingPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { SalesPage } from "../features/sales/SalesPage";
import { AppLayout } from "./AppLayout";
import { HomePage } from "./HomePage";
import { type LaneId, lanesFor, type Role } from "./navigation";

// Each lane's entry screen. A lane adds its own sub-routes (e.g. /purchasing/new) inside its page with a nested
// <Routes>, so this file doesn't need to change.
const lanePages: Record<LaneId, ComponentType> = {
  purchasing: PurchasingPage,
  receiving: ReceivingPage,
  processing: ProcessingPage,
  sales: SalesPage,
  reports: ReportsPage,
  admin: AdminPage,
};

interface AppRoutesProps {
  role: Role | null;
  email: string;
  onSignOut: () => void;
}

/**
 * Only the lanes this role can use get a route at all. Anything else, including a purchaser typing /admin,
 * lands back on the home screen. The API enforces the same rules, so this is about not showing dead ends.
 */
export function AppRoutes({ role, email, onSignOut }: AppRoutesProps) {
  const lanes = lanesFor(role);
  return (
    <LeaveGuardProvider>
      <Routes>
        <Route element={<AppLayout lanes={lanes} email={email} role={role ?? "No role"} onSignOut={onSignOut} />}>
          <Route index element={<HomePage lanes={lanes} />} />
          {lanes.map((lane) => {
            const Page = lanePages[lane.id];
            return <Route key={lane.id} path={`${lane.path}/*`} element={<Page />} />;
          })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LeaveGuardProvider>
  );
}
