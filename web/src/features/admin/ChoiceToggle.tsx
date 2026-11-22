import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { type ReactNode, useId } from "react";

export interface Choice<T> {
  value: T;
  label: string;
}

interface ChoiceToggleProps<T extends string | boolean> {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  helperText?: ReactNode;
  disabled?: boolean;
}

/** Pick one of a few options with big side-by-side buttons: one tap, no dropdown to open. */
export function ChoiceToggle<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
  helperText,
  disabled,
}: ChoiceToggleProps<T>) {
  const labelId = useId();
  return (
    <Stack spacing={1}>
      <Typography id={labelId} variant="h6" component="span">
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        color="primary"
        value={value}
        disabled={disabled}
        aria-labelledby={labelId}
        // Tapping the selected option again would clear it; a choice is always required here.
        onChange={(_, next: T | null) => next !== null && onChange(next)}
      >
        {options.map((o) => (
          <ToggleButton key={String(o.value)} value={o.value} sx={{ minHeight: 56, fontSize: "1.1rem" }}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {helperText && <Typography color="text.secondary">{helperText}</Typography>}
    </Stack>
  );
}

export const activeChoices: readonly Choice<boolean>[] = [
  { value: true, label: "Active" },
  { value: false, label: "Turned off" },
];
