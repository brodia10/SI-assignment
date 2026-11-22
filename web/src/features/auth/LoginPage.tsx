import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from "@mui/material";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { auth } from "../../lib/firebase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("That email and password didn't match. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!email.trim()) {
      setError("Type your email first, then tap “Forgot password?”.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } finally {
      // Same message either way, so the screen doesn't reveal which emails have accounts.
      setInfo("If that email has an account, a reset link is on its way.");
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            SI Metals
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in to continue
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}
              {info && <Alert severity="info">{info}</Alert>}
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <Link component="button" type="button" onClick={handleForgotPassword} sx={{ alignSelf: "center", py: 1 }}>
                Forgot password?
              </Link>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
