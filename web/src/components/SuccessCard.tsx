import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface SuccessCardProps {
  /** What just happened, e.g. "PO #2201 received". */
  title: string;
  /** One line under the title, e.g. "Tag each piece with its number below." */
  subtitle?: ReactNode;
  /** Optional body, e.g. the list of new tags. */
  children?: ReactNode;
  /** The next steps: the main one first as a BigButton, then the alternatives. */
  actions: ReactNode;
}

/**
 * The screen after anything is posted (PO, receipt, work order): a green check, what happened, anything to write
 * down, and what to do next. One layout everywhere, so "it worked" always looks the same.
 */
export function SuccessCard({ title, subtitle, children, actions }: SuccessCardProps) {
  return (
    <Card variant="outlined" sx={{ maxWidth: 720, mx: "auto", borderWidth: 2, borderColor: "success.main" }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 72 }} />
            <Typography variant="h2" component="h1">
              {title}
            </Typography>
            {subtitle && <Typography sx={{ fontSize: "1.2rem" }}>{subtitle}</Typography>}
          </Stack>
          {children}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            useFlexGap
            sx={{ justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}
          >
            {actions}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
