import { Paper } from "@mui/material";
import type { ReactNode } from "react";

/**
 * The bar pinned to the bottom of a form that holds its main action ("Review PO", "Review and receive", "Ship it",
 * "Review and post"), with a short status on the left. Same place on every screen, so the next step is always
 * under the purchaser's thumb.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <Paper
      elevation={6}
      sx={{
        position: "sticky",
        bottom: 16,
        mt: 2,
        p: 2,
        borderRadius: 3,
        zIndex: (t) => t.zIndex.appBar - 1,
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        alignItems: "center",
        justifyContent: "space-between",
        // The main action stays at the right edge, also when it's the only thing in the bar.
        "& > :last-child": { ml: "auto" },
      }}
    >
      {children}
    </Paper>
  );
}
