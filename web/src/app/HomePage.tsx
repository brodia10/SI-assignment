import { Alert, Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { Link } from "react-router";
import { PageHeader } from "../components";
import { laneIcons } from "./laneIcons";
import type { Lane } from "./navigation";

/** Big tiles for every screen this user can open: one tap to start any job. */
export function HomePage({ lanes }: { lanes: readonly Lane[] }) {
  if (lanes.length === 0)
    return (
      <Alert severity="warning" sx={{ fontSize: "1.1rem" }}>
        Your account doesn't have a role this app recognizes yet. Ask an admin to set your role.
      </Alert>
    );

  return (
    <>
      <PageHeader title="What do you need to do?" />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
        }}
      >
        {lanes.map((lane) => {
          const Icon = laneIcons[lane.id];
          return (
            <Card key={lane.id} variant="outlined" sx={{ borderWidth: 2 }}>
              <CardActionArea component={Link} to={lane.path} sx={{ height: "100%" }}>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 2.5, p: 3, minHeight: 128 }}>
                  <Icon color="primary" sx={{ fontSize: 56 }} />
                  <Box>
                    <Typography variant="h4" component="h2">
                      {lane.label}
                    </Typography>
                    <Typography color="text.secondary">{lane.description}</Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </>
  );
}
