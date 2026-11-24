import { Button, Snackbar } from "@mui/material";
import { useRef } from "react";
import { BIG_TOUCH_TARGET } from "../theme";

/** What was just removed: the row's own key (so each removal gets a fresh 5 seconds) and what to say. */
export interface Removal {
  key: number | string;
  message: string;
}

export interface UndoSnackbarProps {
  /** E.g. { key: 3, message: "Removed Aluminum Sheet" }. Null hides the bar. */
  removal: Removal | null;
  onUndo: () => void;
  onClose: () => void;
}

/**
 * "Removed Aluminum Sheet · Undo" for about 5 seconds after a row is deleted. Keeps removing to one tap (no
 * "are you sure?") while still letting a mis-tap be taken back.
 */
export function UndoSnackbar({ removal, onUndo, onClose }: UndoSnackbarProps) {
  // Keep showing the last message while the bar slides away.
  const last = useRef<Removal | null>(null);
  if (removal) last.current = removal;
  const shown = removal ?? last.current;

  return (
    <Snackbar
      key={shown?.key}
      open={removal !== null}
      autoHideDuration={5000}
      onClose={(_, reason) => {
        // A tap elsewhere on the screen shouldn't hide the only way to undo.
        if (reason !== "clickaway") onClose();
      }}
      message={shown?.message}
      slotProps={{ content: { sx: { fontSize: "1.1rem" } } }}
      action={
        <Button color="inherit" size="large" onClick={onUndo} sx={{ minHeight: BIG_TOUCH_TARGET, fontWeight: 700 }}>
          Undo
        </Button>
      }
    />
  );
}

/** Puts a removed row back where it was (or at the end, if the list has since got shorter). */
export function insertAt<T>(list: readonly T[], item: T, index: number): T[] {
  const at = Math.min(Math.max(index, 0), list.length);
  return [...list.slice(0, at), item, ...list.slice(at)];
}
