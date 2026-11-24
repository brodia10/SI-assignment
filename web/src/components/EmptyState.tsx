import { Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** What a list shows when there's nothing in it yet, ideally with the next step: "Tap “New PO” to write the first one." */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined">
      <Typography color="text.secondary" sx={{ p: 3, fontSize: "1.1rem" }}>
        {children}
      </Typography>
    </Paper>
  );
}
