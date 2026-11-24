import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useId, useState } from "react";
import { BIG_TOUCH_TARGET, TOUCH_TARGET } from "../theme";
import {
  defaultPadOptions,
  formatPadText,
  type PadKey,
  type PadOptions,
  padStateFor,
  padTextToNumber,
  pressPadKey,
  syncPadState,
} from "./weightPad";

export interface WeightInputProps {
  /** The number (pounds by default), or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  /** Shown under the keys (so pads side by side line up), e.g. "PO weight: 40,000 lbs". Red when `error` is set. */
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  /** Defaults to up to 2 decimals, max 999,999. */
  padOptions?: PadOptions;
  /** Unit shown after the number. Defaults to "lbs"; use "$/lb" (with maxDecimals 3) for a price pad. */
  unit?: string;
  /** How a screen reader says the unit. Defaults to "pounds" for "lbs", otherwise the unit itself. */
  unitSpoken?: string;
  /** Smaller keys (still 56px) and display, so two pads fit side by side in a dialog on an iPad. */
  dense?: boolean;
}

/** Key height for `dense` pads: smaller than BIG_TOUCH_TARGET, still well over the 48px minimum. */
const DENSE_KEY = 56;

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
  dense = false,
}: WeightInputProps) {
  // The pad keeps its own text so in-progress input like "12." or "0.0" isn't lost to number conversion, and
  // remembers whether the value came from outside: then the first digit replaces it instead of adding to it.
  const [pad, setPad] = useState(() => padStateFor(value, padOptions));
  const { text, prefilled } = pad;
  const labelId = useId();

  // The parent owns the value. Whenever it disagrees with what the pad shows (a form reset, the PO weight filled in,
  // a product's default price), show the parent's value as a prefill. "12." and "12" agree, so typing isn't
  // disturbed. syncPadState returns the same object when nothing changed, so this can't loop.
  useEffect(() => {
    setPad(syncPadState(pad, value, padOptions));
  }, [pad, value, padOptions]);

  function press(key: PadKey) {
    const next = pressPadKey(pad, key, padOptions);
    if (next.text === text && next.prefilled === prefilled) return;
    setPad(next);
    if (next.text !== text) onChange(padTextToNumber(next.text));
  }

  const showPrefill = prefilled && text !== "";

  return (
    <Stack role="group" aria-labelledby={labelId} spacing={dense ? 1 : 1.5} sx={{ width: "100%", maxWidth: 420 }}>
      <Typography id={labelId} variant="h6" component="span">
        {label}
      </Typography>
      <Paper
        variant="outlined"
        role="status"
        aria-live="polite"
        aria-label={`${label}: ${text === "" ? "empty" : `${formatPadText(text)} ${unitSpoken}`}${showPrefill ? ", tap a number to replace it" : ""}`}
        sx={{
          px: dense ? 2 : 3,
          py: dense ? 1.5 : 2,
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
            fontSize: dense ? "2rem" : "2.5rem",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: text === "" ? "text.disabled" : "text.primary",
            // A prefilled value looks selected, like highlighted text: the next digit replaces it.
            px: 1,
            borderRadius: 1,
            bgcolor: showPrefill ? (t) => alpha(t.palette.primary.main, 0.14) : "transparent",
          }}
        >
          {formatPadText(text)}
        </Typography>
        <Typography component="span" sx={{ fontSize: dense ? "1.25rem" : "1.5rem" }} color="text.secondary">
          {unit}
        </Typography>
      </Paper>
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
              sx={{
                minHeight: dense ? DENSE_KEY : BIG_TOUCH_TARGET,
                fontSize: dense ? "1.5rem" : "1.75rem",
                fontWeight: 600,
              }}
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
      {helperText && (
        <Typography color={error ? "error" : "text.secondary"} sx={{ px: 1 }}>
          {helperText}
        </Typography>
      )}
    </Stack>
  );
}
