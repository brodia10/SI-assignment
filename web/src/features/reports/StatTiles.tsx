import { Box, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** A row of headline numbers at the top of a report. Tiles share the row evenly, so 3 fit across a portrait iPad. */
export function StatTiles({ stats }: { stats: readonly { label: string; value: ReactNode }[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        mb: 3,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(auto-fit, minmax(150px, 1fr))" },
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
