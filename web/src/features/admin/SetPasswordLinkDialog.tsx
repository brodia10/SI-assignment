import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { BigButton } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";

interface SetPasswordLinkDialogProps {
  email: string;
  link: string;
  onClose: () => void;
}

/**
 * Shows the one-time link an invited person uses to choose their password, with a big Copy button.
 * The app doesn't send email itself, so the admin passes the link on by text or email.
 */
export function SetPasswordLinkDialog({ email, link, onClose }: SetPasswordLinkDialogProps) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    // No onClose: a stray tap outside (or Escape) mustn't throw away a link the admin hasn't copied yet.
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle variant="h4" component="h2">
        Send this link to {email}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography component="ol" sx={{ pl: 3, m: 0, "& li": { mb: 0.5 } }}>
            <li>Copy the link and send it to them by text or email.</li>
            <li>They open it and choose a password.</li>
            <li>
              They sign in at <strong>{window.location.origin}</strong> with {email} and that password.
            </li>
          </Typography>
          <TextField
            label="Set-password link"
            value={link}
            multiline
            onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
            slotProps={{ htmlInput: { readOnly: true } }}
          />
          <BigButton
            onClick={copy}
            startIcon={copied === "yes" ? <CheckIcon /> : <ContentCopyIcon />}
            color={copied === "yes" ? "success" : "primary"}
          >
            {copied === "yes" ? "Copied" : "Copy link"}
          </BigButton>
          {copied === "failed" && (
            <Alert severity="warning">Couldn't copy automatically. Tap the link above, then copy it.</Alert>
          )}
          <Typography color="text.secondary">
            The link stops working after about an hour. If it expires, tap {email} in the user list to make a new one.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
