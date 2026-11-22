import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

export interface AdminRow {
  id: string | number;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Status chips on the right, e.g. "Scrap" or "Turned off". */
  chips?: ReactNode;
  /** Greys the row out (e.g. turned off), so active records stand out. */
  muted?: boolean;
  onClick: () => void;
}

interface AdminListProps {
  rows: readonly AdminRow[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  emptyText: string;
}

/** A list of big tappable rows. Tap a row to edit it. Handles the loading and error states too. */
export function AdminList({ rows, isPending, error, onRetry, emptyText }: AdminListProps) {
  if (isPending)
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Alert
        severity="error"
        sx={{ fontSize: "1.05rem" }}
        action={
          <Button color="inherit" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        {error.message}
      </Alert>
    );

  if (!rows || rows.length === 0)
    return (
      <Paper variant="outlined">
        <Typography sx={{ p: 3 }} color="text.secondary">
          {emptyText}
        </Typography>
      </Paper>
    );

  return (
    <Paper variant="outlined">
      <List disablePadding>
        {rows.map((row, i) => (
          <ListItemButton
            key={row.id}
            divider={i < rows.length - 1}
            onClick={row.onClick}
            sx={{ minHeight: 72, py: 1.5, gap: 2, opacity: row.muted ? 0.6 : 1 }}
          >
            <ListItemText
              primary={row.primary}
              secondary={row.secondary}
              slotProps={{
                primary: { sx: { fontSize: "1.2rem", fontWeight: 600 } },
                secondary: { sx: { fontSize: "1.05rem" } },
              }}
            />
            {row.chips && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "flex-end", rowGap: 1 }}>
                {row.chips}
              </Stack>
            )}
            <ChevronRightIcon color="action" />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
