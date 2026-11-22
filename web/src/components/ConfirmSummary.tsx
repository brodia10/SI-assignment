import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useRef } from "react";
import { BIG_TOUCH_TARGET } from "../theme";
import { BigButton } from "./BigButton";

export interface ConfirmDetail {
  /** Stable key when labels repeat (e.g. four "12\" Slit Coil" rows). Defaults to the label. */
  id?: string | number;
  label: string;
  value: ReactNode;
}

export interface ConfirmSummaryProps {
  open: boolean;
  /** Short title, e.g. "Receive PO #2201?". */
  title: string;
  /** The plain-English sentence of what will happen, e.g. "Receive 40,000 lbs Hot-Rolled Steel Coil into Bay 2." */
  summary: ReactNode;
  /** Optional rows to double-check (weights, locations, totals). */
  details?: readonly ConfirmDetail[];
  /** Shown above the buttons, e.g. a weight mismatch warning. Doesn't block confirming. */
  warning?: ReactNode;
  /** Error from the last attempt, e.g. "That coil was already used." */
  error?: ReactNode;
  confirmLabel?: string;
  /**
   * True while the post is running: the confirm button shows a spinner and both buttons are disabled. Set it for
   * every post. On success close the dialog; on failure set `error` and `busy` back to false to allow a retry.
   */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The plain-English "are you sure?" shown before anything is posted. Posted records are locked, so this is the
 * last chance to catch a wrong weight or location.
 */
export function ConfirmSummary({
  open,
  title,
  summary,
  details,
  warning,
  error,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSummaryProps) {
  // Confirm fires at most once per attempt, even if the caller is slow to set `busy` or a second tap lands during
  // the close animation. It re-arms whenever the dialog is open and not busy: on opening, and when a failed post
  // finishes with the dialog still open (so the user can retry).
  const fired = useRef(false);
  useEffect(() => {
    if (open && !busy) fired.current = false;
  }, [open, busy]);

  function handleConfirm() {
    if (!open || busy || fired.current) return;
    fired.current = true;
    onConfirm();
  }

  return (
    <Dialog
      open={open}
      // Don't let a stray tap outside the dialog cancel it mid-post.
      onClose={busy ? undefined : onCancel}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle variant="h4" component="h2">
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "1.3rem", lineHeight: 1.5, mb: details?.length ? 2 : 0 }}>{summary}</Typography>
        {details && details.length > 0 && (
          <Table size="small">
            <TableBody>
              {details.map((d) => (
                <TableRow key={d.id ?? d.label}>
                  <TableCell component="th" scope="row" sx={{ color: "text.secondary", fontSize: "1.05rem", pl: 0 }}>
                    {d.label}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: "1.1rem", fontWeight: 600, pr: 0 }}>
                    {d.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {warning && (
          <Alert severity="warning" sx={{ mt: 2, fontSize: "1.05rem" }}>
            {warning}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: "1.05rem" }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button size="large" onClick={onCancel} disabled={busy} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
          Go back
        </Button>
        <BigButton onClick={handleConfirm} loading={busy}>
          {confirmLabel}
        </BigButton>
      </DialogActions>
    </Dialog>
  );
}
