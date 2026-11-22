import { createTheme } from "@mui/material/styles";

// Tuned for a field user on an iPad: large type, 48px+ touch targets, high contrast.
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1f4e79" },
    secondary: { main: "#c9601c" },
    background: { default: "#f3f5f7" },
  },
  typography: {
    fontSize: 16,
    button: { textTransform: "none", fontWeight: 600, fontSize: "1.05rem" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 48 }, sizeLarge: { minHeight: 56, fontSize: "1.15rem" } } },
    MuiInputBase: { styleOverrides: { input: { fontSize: "1.1rem" } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 56 } } },
    MuiIconButton: { styleOverrides: { root: { padding: 12 } } },
  },
});
