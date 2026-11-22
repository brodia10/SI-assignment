import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { type ReactNode, useState } from "react";
import { BigButton, ConfirmSummary } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";
import { activeText, changeDetails, cleanName } from "./adminText";
import { activeChoices, type Choice, ChoiceToggle } from "./ChoiceToggle";

export interface NameKindValues<K extends string> {
  name: string;
  kind: K;
  isActive: boolean;
}

interface NameKindDialogProps<K extends string> {
  /** e.g. "location" or "vendor". */
  noun: string;
  kindLabel: string;
  /** Matches the API's limit for this record type. */
  maxNameLength: number;
  kinds: readonly Choice<K>[];
  /** The record being edited, or undefined to add a new one. */
  existing?: NameKindValues<K>;
  defaultKind: K;
  /** A note at the top of the form, e.g. "A purchaser added this in the field." */
  notice?: ReactNode;
  /** Shown in the confirmation, e.g. "3 items are still in Bay 2." */
  confirmWarning?: (values: NameKindValues<K>) => ReactNode;
  /** Let the admin save without changes (e.g. to mark a purchaser's vendor as checked). */
  allowUnchanged?: boolean;
  busy: boolean;
  error: string | undefined;
  onSave: (values: NameKindValues<K>) => void;
  /** Clears the last save error, so it doesn't greet the admin on the next attempt. */
  onResetError: () => void;
  onClose: () => void;
}

/**
 * Add or edit a simple record that has a name, a kind and an on/off switch (locations, vendors). Fill in the form,
 * then confirm the plain-English summary before anything is saved.
 */
export function NameKindDialog<K extends string>({
  noun,
  kindLabel,
  maxNameLength,
  kinds,
  existing,
  defaultKind,
  notice,
  confirmWarning,
  allowUnchanged = false,
  busy,
  error,
  onSave,
  onResetError,
  onClose,
}: NameKindDialogProps<K>) {
  const [values, setValues] = useState<NameKindValues<K>>(
    () => existing ?? { name: "", kind: defaultKind, isActive: true },
  );
  const [confirming, setConfirming] = useState(false);

  const name = cleanName(values.name);
  const kindName = (k: K) => kinds.find((c) => c.value === k)?.label ?? k;
  const details = changeDetails([
    { label: "Name", before: existing?.name, after: name },
    { label: kindLabel, before: existing && kindName(existing.kind), after: kindName(values.kind) },
    { label: "Status", before: existing && activeText(existing.isActive), after: activeText(values.isActive) },
  ]);
  const canReview = name !== "" && (details.length > 0 || allowUnchanged);
  const summary = existing
    ? details.length > 0
      ? `Save changes to “${existing.name}”?`
      : `Mark “${name}” as checked?`
    : `Add the ${noun} “${name}”?`;

  return (
    <>
      <Dialog open={!confirming} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle variant="h4" component="h2">
          {existing ? `Edit ${noun}` : `Add a ${noun}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {notice && (
              <Alert severity="info" sx={{ fontSize: "1.05rem" }}>
                {notice}
              </Alert>
            )}
            <TextField
              label="Name"
              value={values.name}
              autoComplete="off"
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              slotProps={{ htmlInput: { maxLength: maxNameLength } }}
            />
            <ChoiceToggle
              label={kindLabel}
              value={values.kind}
              options={kinds}
              onChange={(kind) => setValues({ ...values, kind })}
            />
            {existing && (
              <ChoiceToggle
                label="Status"
                value={values.isActive}
                options={activeChoices}
                onChange={(isActive) => setValues({ ...values, isActive })}
                helperText={`A turned-off ${noun} stays on old records but isn't offered in pick lists.`}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
            Cancel
          </Button>
          <BigButton disabled={!canReview} onClick={() => setConfirming(true)}>
            Review and save
          </BigButton>
        </DialogActions>
      </Dialog>

      <ConfirmSummary
        open={confirming}
        title={existing ? `Save ${noun}?` : `Add ${noun}?`}
        summary={summary}
        details={details}
        warning={confirmWarning?.(values)}
        error={error}
        busy={busy}
        confirmLabel="Save"
        onConfirm={() => onSave({ ...values, name })}
        onCancel={() => {
          setConfirming(false);
          onResetError();
        }}
      />
    </>
  );
}
