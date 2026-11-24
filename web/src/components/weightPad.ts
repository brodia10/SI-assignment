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

/**
 * What the pad shows, plus whether it's still a value that came from outside (a default price, the PO weight).
 * While `prefilled`, the first digit or "." replaces the value instead of adding to it, like a calculator.
 */
export interface PadState {
  text: string;
  prefilled: boolean;
}

/** The starting state for a parent's value: a non-empty value counts as prefilled. */
export function padStateFor(value: number | null | undefined, options: PadOptions = defaultPadOptions): PadState {
  const text = numberToPadText(value, options);
  return { text, prefilled: text !== "" };
}

/**
 * Applies one key press to the pad state. On a prefilled value a digit or "." starts over, while back and clear
 * work on the value as shown. After any key the value is the user's own, so later keys append.
 */
export function pressPadKey(state: PadState, key: PadKey, options: PadOptions = defaultPadOptions): PadState {
  // Only a key that would start a new value replaces (not ".", when decimals aren't allowed).
  const replaces = state.prefilled && key !== "back" && key !== "clear" && applyPadKey("", key, options) !== "";
  return { text: applyPadKey(replaces ? "" : state.text, key, options), prefilled: false };
}

/**
 * The pad state given the parent's value. Returns the same object while the value agrees with what's shown (so
 * React can skip the update, and the parent echoing a key press back changes nothing). A value that replaces the
 * text (prefill, product picked, form reset) is marked prefilled.
 */
export function syncPadState(state: PadState, value: number | null, options: PadOptions = defaultPadOptions): PadState {
  const text = syncPadText(state.text, value, options);
  return text === state.text ? state : { text, prefilled: text !== "" };
}

/** Text for the big display: thousands separators, keeping a typed trailing "." or zeros ("1,250.5", "40,000."). */
export function formatPadText(text: string): string {
  if (text === "") return "0";
  const [whole, fraction] = text.split(".");
  const groupedWhole = whole === "" ? "0" : Number(whole).toLocaleString("en-US");
  return fraction === undefined ? groupedWhole : `${groupedWhole}.${fraction}`;
}
