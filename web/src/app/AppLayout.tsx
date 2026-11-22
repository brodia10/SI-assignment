import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { laneIcons } from "./laneIcons";
import type { Lane } from "./navigation";

const drawerWidth = 260;

interface AppLayoutProps {
  lanes: readonly Lane[];
  email: string;
  role: string;
  onSignOut: () => void;
}

/**
 * Top bar + side nav around every signed-in screen. The nav stays open on a landscape iPad (1024px+; an iPad Air
 * is 1180 wide) and becomes a slide-out drawer in portrait, so the content keeps the full width.
 */
export function AppLayout({ lanes, email, role, onSignOut }: AppLayoutProps) {
  const theme = useTheme();
  const permanent = useMediaQuery(theme.breakpoints.up(1024));
  const [open, setOpen] = useState(false);

  const nav = (
    <List component="nav" aria-label="Main" sx={{ px: 1, py: 2 }}>
      {lanes.map((lane) => {
        const Icon = laneIcons[lane.id];
        return (
          <ListItemButton
            key={lane.id}
            component={NavLink}
            to={lane.path}
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 60,
              "&.active": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "& .MuiListItemIcon-root": { color: "inherit" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 48 }}>
              <Icon fontSize="large" />
            </ListItemIcon>
            <ListItemText
              primary={lane.label}
              slotProps={{ primary: { sx: { fontSize: "1.2rem", fontWeight: 600 } } }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64 } }}>
          {!permanent && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <MenuIcon fontSize="large" />
            </IconButton>
          )}
          <Typography
            variant="h5"
            component={Link}
            to="/"
            sx={{ color: "inherit", textDecoration: "none", fontWeight: 700, mr: "auto" }}
          >
            SI Metals
          </Typography>
          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
            <Typography sx={{ fontSize: "1rem", lineHeight: 1.2 }}>{email}</Typography>
            <Typography sx={{ fontSize: "0.875rem", opacity: 0.8, lineHeight: 1.2 }}>{role}</Typography>
          </Box>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={onSignOut}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={permanent ? "permanent" : "temporary"}
        open={permanent || open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: permanent ? drawerWidth : undefined,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64 } }} />
        {nav}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3, md: 4 } }}>
        <Toolbar sx={{ minHeight: { xs: 64 } }} />
        <Outlet />
      </Box>
    </Box>
  );
}
