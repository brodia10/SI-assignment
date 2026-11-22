import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useId, useState } from "react";
import { BIG_TOUCH_TARGET, TOUCH_TARGET } from "../theme";
import {
  applyPadKey,
  defaultPadOptions,
  formatPadText,
  numberToPadText,
  type PadKey,
  type PadOptions,
  padTextToNumber,
  syncPadText,
} from "./weightPad";

export interface WeightInputProps {
  /** The number (pounds by default), or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  /** Shown under the display, e.g. "PO weight: 40,000 lbs". Turns red when `error` is set. */
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  /** Defaults to up to 2 decimals, max 999,999. */
  padOptions?: PadOptions;
  /** Unit shown after the number. Defaults to "lbs"; use "$/lb" (with maxDecimals 3) for a price pad. */
  unit?: string;
  /** How a screen reader says the unit. Defaults to "pounds" for "lbs", otherwise the unit itself. */
  unitSpoken?: string;
}

const keys: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/**
 * Enter a weight (or, with `unit`, any number such as a $/lb price) with an on-screen number pad: no keyboard popping up and covering the screen, no letters, and
 * digits big enough to read while standing next to the material.
 */
export function WeightInput({
  value,
  onChange,
  label = "Weight",
  helperText,
  error = false,
  disabled = false,
  padOptions = defaultPadOptions,
  unit = "lbs",
  unitSpoken = unit === "lbs" ? "pounds" : unit,
}: WeightInputProps) {
  // The pad keeps its own text so in-progress input like "12." or "0.0" isn't lost to number conversion.
  const [text, setText] = useState(() => numberToPadText(value, padOptions));
  const labelId = useId();

  // The parent owns the value. Whenever it disagrees with what the pad shows (a form reset, the PO weight filled in,
  // or the parent rejecting a key press), show the parent's value. "12." and "12" agree, so typing isn't disturbed.
  // Setting the same string is a no-op, so this can't loop.
  useEffect(() => {
    setText(syncPadText(text, value, padOptions));
  }, [text, value, padOptions]);

  function press(key: PadKey) {
    const next = applyPadKey(text, key, padOptions);
    if (next === text) return;
    setText(next);
    onChange(padTextToNumber(next));
  }

  return (
    <Stack role="group" aria-labelledby={labelId} spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
      <Typography id={labelId} variant="h6" component="span">
        {label}
      </Typography>
      <Paper
        variant="outlined"
        role="status"
        aria-live="polite"
        aria-label={`${label}: ${text === "" ? "empty" : `${formatPadText(text)} ${unitSpoken}`}`}
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: 1,
          borderWidth: 2,
          borderColor: error ? "error.main" : "divider",
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: "2.5rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: text === "" ? "text.disabled" : "text.primary",
          }}
        >
          {formatPadText(text)}
        </Typography>
        <Typography component="span" sx={{ fontSize: "1.5rem" }} color="text.secondary">
          {unit}
        </Typography>
      </Paper>
      {helperText && (
        <Typography color={error ? "error" : "text.secondary"} sx={{ px: 1 }}>
          {helperText}
        </Typography>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
        {keys.map((key) => {
          const isDisabled = disabled || (key === "." && padOptions.maxDecimals === 0);
          return (
            <Button
              key={key}
              variant="outlined"
              disabled={isDisabled}
              onClick={() => press(key)}
              aria-label={key === "back" ? "Delete last digit" : key === "." ? "Decimal point" : key}
              sx={{ minHeight: BIG_TOUCH_TARGET, fontSize: "1.75rem", fontWeight: 600 }}
            >
              {key === "back" ? <BackspaceOutlinedIcon fontSize="large" /> : key}
            </Button>
          );
        })}
        <Button
          variant="text"
          color="inherit"
          disabled={disabled || text === ""}
          onClick={() => press("clear")}
          sx={{ gridColumn: "1 / -1", minHeight: TOUCH_TARGET }}
        >
          Clear
        </Button>
      </Box>
    </Stack>
  );
}
