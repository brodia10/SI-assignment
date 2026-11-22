import { Alert } from "@mui/material";
import { PageHeader } from "../components";

/** Stand-in content for a lane's screen until that lane is built. Delete it from the page when you start. */
export function LanePlaceholder({ title, subtitle, lane }: { title: string; subtitle: string; lane: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Alert severity="info" sx={{ fontSize: "1.1rem" }}>
        This screen is coming in {lane}.
      </Alert>
    </>
  );
}
