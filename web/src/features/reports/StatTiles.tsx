import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** A row of headline numbers at the top of a report. */
export function StatTiles({ stats }: { stats: readonly { label: string; value: ReactNode }[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        mb: 3,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${stats.length}, 1fr)` },
      }}
    >
      {stats.map((s) => (
        <Paper key={s.label} variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{s.label}</Typography>
          <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {s.value}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
