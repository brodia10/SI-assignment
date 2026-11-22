import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { errorText } from "./apiResult";

/** Spinner while loading, a retryable error if the load failed. Shared by the sales and reports screens. */
export function QueryState({ isPending, error, onRetry }: { isPending: boolean; error: unknown; onRetry: () => void }) {
  if (error)
    return (
      <Alert
        severity="error"
        sx={{ fontSize: "1.1rem" }}
        action={
          <Button color="inherit" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        {errorText(error)}
      </Alert>
    );
  if (isPending)
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  return null;
}
