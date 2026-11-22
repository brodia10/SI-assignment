import { createTheme } from "@mui/material/styles";

/** Smallest comfortable touch target on an iPad (Apple's guideline is 44pt; we round up). */
export const TOUCH_TARGET = 48;
/** Primary actions (BigButton, number pad keys) are larger still. */
export const BIG_TOUCH_TARGET = 64;

// Tuned for a field user on an iPad: large type, 48px+ touch targets, high contrast,
// and visible focus so a keyboard-paired iPad still shows where you are.
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1f4e79" },
    secondary: { main: "#c9601c" },
    background: { default: "#f3f5f7" },
    text: { primary: "#14202b", secondary: "#46525e" },
  },
  typography: {
    fontSize: 16,
    h1: { fontSize: "2.25rem", fontWeight: 700 },
    h2: { fontSize: "1.9rem", fontWeight: 700 },
    h3: { fontSize: "1.6rem", fontWeight: 700 },
    h4: { fontSize: "1.45rem", fontWeight: 700 },
    h5: { fontSize: "1.25rem", fontWeight: 600 },
    h6: { fontSize: "1.125rem", fontWeight: 600 },
    body1: { fontSize: "1.125rem" },
    body2: { fontSize: "1rem" },
    button: { textTransform: "none", fontWeight: 600, fontSize: "1.1rem" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Keep iOS from resizing text on rotation and from flashing a grey box on every tap.
        body: { WebkitTextSizeAdjust: "100%", WebkitTapHighlightColor: "transparent" },
        ":focus-visible": { outline: "3px solid #c9601c", outlineOffset: 2 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET, paddingInline: 20 },
        sizeLarge: { minHeight: 56, fontSize: "1.2rem" },
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET } } },
    MuiToggleButton: { styleOverrides: { root: { minHeight: TOUCH_TARGET, fontSize: "1.05rem" } } },
    MuiTab: { styleOverrides: { root: { minHeight: TOUCH_TARGET, fontSize: "1.05rem" } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 56 } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: TOUCH_TARGET } } },
    MuiCheckbox: { styleOverrides: { root: { padding: 12 } } },
    MuiRadio: { styleOverrides: { root: { padding: 12 } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiInputBase: {
      styleOverrides: {
        // 16px+ prevents iOS zoom-on-focus; 1.15rem is easier to read at arm's length.
        input: { fontSize: "1.15rem", minHeight: 28 },
      },
    },
    MuiDialogActions: { styleOverrides: { root: { padding: 16, gap: 8 } } },
  },
});
