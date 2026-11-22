import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { type FormEvent, useState } from "react";
import { BigButton } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";
import { type Supplier, useQuickAddSupplier } from "./api";

interface QuickAddSupplierDialogProps {
  onAdded: (supplier: Supplier) => void;
  onClose: () => void;
}

/**
 * Add a supplier by name while standing at their yard. An admin can review it later. If the name is already on
 * file, the API hands back that supplier instead of making a duplicate.
 */
export function QuickAddSupplierDialog({ onAdded, onClose }: QuickAddSupplierDialogProps) {
  const [name, setName] = useState("");
  const add = useQuickAddSupplier();
  const trimmed = name.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed.length < 2 || add.isPending) return;
    add.mutate(trimmed, { onSuccess: onAdded });
  }

  return (
    <Dialog open onClose={add.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle variant="h4" component="h2">
          Add a new supplier
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Type the name as it appears on their paperwork. An admin can tidy it up later.
          </Typography>
          <TextField
            autoFocus
            label="Supplier name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200, autoCapitalize: "words" } }}
          />
          {add.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {add.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="large" onClick={onClose} disabled={add.isPending} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
            Cancel
          </Button>
          <BigButton type="submit" disabled={trimmed.length < 2} loading={add.isPending}>
            Add supplier
          </BigButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
