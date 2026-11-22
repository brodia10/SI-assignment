import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { AppRoutes } from "./app/AppRoutes";
import { toRole } from "./app/navigation";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./features/auth/LoginPage";

export default function App() {
  const auth = useAuth();

  if (auth.status === "loading")
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );

  if (auth.status === "signedOut") return <LoginPage />;

  if (auth.status === "notInvited")
    return (
      <Stack spacing={2} sx={{ p: 4, maxWidth: 520, mx: "auto" }}>
        <Typography variant="h5">You're signed in, but this account hasn't been invited.</Typography>
        <Typography>Ask an admin to invite {auth.firebaseUser.email}.</Typography>
        <Button variant="outlined" onClick={auth.signOut}>
          Sign out
        </Button>
      </Stack>
    );

  return <AppRoutes role={toRole(auth.me.role)} email={auth.me.email} onSignOut={auth.signOut} />;
}
