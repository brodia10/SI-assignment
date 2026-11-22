// Keystroke logic for the on-screen weight number pad. Kept pure (string in, string out) so it can be
// unit-tested and so the typed value is never rounded by floating point while the user is typing.

export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back" | "clear";

export interface PadOptions {
  /** Most digits allowed after the decimal point. 0 means whole pounds only. */
  maxDecimals: number;
  /** Most digits allowed before the decimal point (6 → up to 999,999 lbs). */
  maxWholeDigits: number;
}

export const defaultPadOptions: PadOptions = { maxDecimals: 2, maxWholeDigits: 6 };

/** Applies one key press to the current text and returns the new text. Invalid presses are ignored. */
export function applyPadKey(text: string, key: PadKey, options: PadOptions = defaultPadOptions): string {
  if (key === "clear") return "";
  if (key === "back") return text.slice(0, -1);

  const [whole, fraction] = text.split(".");

  if (key === ".") {
    if (options.maxDecimals === 0 || fraction !== undefined) return text;
    return text === "" ? "0." : `${text}.`;
  }

  // A digit.
  if (fraction !== undefined) {
    return fraction.length < options.maxDecimals ? text + key : text;
  }
  if (whole === "0") return key; // replace a lone leading zero instead of making "05"
  return whole.length < options.maxWholeDigits ? text + key : text;
}

/** The number the text represents, or null when nothing usable has been typed. */
export function padTextToNumber(text: string): number | null {
  if (text === "" || text === ".") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** A number coming in from outside (e.g. the PO weight as the starting value) as pad text. */
export function numberToPadText(value: number | null | undefined, options: PadOptions = defaultPadOptions): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "";
  // Round to the allowed decimals, then drop trailing zeros ("40000.00" → "40000").
  return String(Number(value.toFixed(options.maxDecimals)));
}

/**
 * What the pad should show given the parent's value. Keeps the current text while it means the same number (so
 * "12." or "0.0" mid-typing survive), otherwise switches to the parent's value (form reset, prefill, rejected key).
 */
export function syncPadText(text: string, value: number | null, options: PadOptions = defaultPadOptions): string {
  return padTextToNumber(text) === value ? text : numberToPadText(value, options);
}

/** Text for the big display: thousands separators, keeping a typed trailing "." or zeros ("1,250.5", "40,000."). */
export function formatPadText(text: string): string {
  if (text === "") return "0";
  const [whole, fraction] = text.split(".");
  const groupedWhole = whole === "" ? "0" : Number(whole).toLocaleString("en-US");
  return fraction === undefined ? groupedWhole : `${groupedWhole}.${fraction}`;
}
