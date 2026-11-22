import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  /** One line telling the user what this screen is for. */
  subtitle?: ReactNode;
  /** A button on the right, e.g. "New PO". */
  action?: ReactNode;
}

/** The title row at the top of every screen, so they all start the same way. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ mb: 3, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h2" component="h1">
          {title}
        </Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Stack>
      {action}
    </Stack>
  );
}
