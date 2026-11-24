import { Stack, Typography } from "@mui/material";
import { BigButton } from "../components";

/**
 * Shown if a screen crashes while drawing, instead of React Router's developer error page. Posted records are saved
 * on the server, so reloading is always safe.
 */
export function CrashScreen() {
  return (
    <Stack spacing={3} sx={{ p: 4, maxWidth: 560, mx: "auto", mt: 8 }}>
      <Typography variant="h4" component="h1">
        Something went wrong on this screen.
      </Typography>
      <Typography sx={{ fontSize: "1.2rem" }}>
        Anything you already posted is saved. Reload to carry on. If it keeps happening, tell your admin what you were
        doing.
      </Typography>
      <BigButton onClick={() => window.location.reload()} sx={{ alignSelf: "flex-start" }}>
        Reload
      </BigButton>
    </Stack>
  );
}
