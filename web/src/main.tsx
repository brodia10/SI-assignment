import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App";
import { CrashScreen } from "./app/CrashScreen";
import { AuthProvider } from "./auth/AuthProvider";
import { theme } from "./theme";

// A data router, so screens can ask before leaving a draft (useBlocker). One catch-all route keeps the app's
// nested <Routes> working as they are.
const router = createBrowserRouter([
  {
    path: "*",
    errorElement: <CrashScreen />,
    element: (
      <AuthProvider>
        <App />
      </AuthProvider>
    ),
  },
]);

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

// biome-ignore lint/style/noNonNullAssertion: index.html always has #root
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
