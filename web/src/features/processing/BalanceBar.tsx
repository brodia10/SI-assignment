import { Box, Paper, Typography } from "@mui/material";
import { formatLbs, type WeightBalance } from "./workOrderDraft";

const look = {
  empty: { color: "divider", text: "text.primary" },
  under: { color: "warning.main", text: "warning.dark" },
  exact: { color: "success.main", text: "success.dark" },
  over: { color: "error.main", text: "error.main" },
} as const;

function message(balance: WeightBalance): string {
  const left = formatLbs(Math.abs(balance.remainingLbs));
  switch (balance.state) {
    case "empty":
      return "Add an output for each piece that comes off the line.";
    case "under":
      return `${left} not accounted for. Add the rest, or post anyway if it's trim loss.`;
    case "exact":
      return "Balanced: the outputs match the input weight.";
    case "over":
      return `The outputs are ${left} heavier than the input. Fix a weight before posting.`;
  }
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Input vs. outputs, always in view while the purchaser adds outputs. Red blocks posting; amber only warns. */
export function BalanceBar({ balance }: { balance: WeightBalance }) {
  const { color, text } = look[balance.state];
  const over = balance.state === "over";
  return (
    <Paper
      variant="outlined"
      role="status"
      aria-live="polite"
      sx={{ position: "sticky", top: 72, zIndex: 1, p: 2, mb: 2, borderWidth: 3, borderColor: color }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
        <Stat label="Input" value={formatLbs(balance.inputLbs)} />
        <Stat label="Outputs" value={formatLbs(balance.outputLbs)} />
        <Stat
          label={over ? "Over by" : "Left"}
          value={formatLbs(Math.abs(balance.remainingLbs))}
          color={balance.state === "empty" ? undefined : text}
        />
      </Box>
      <Typography sx={{ mt: 1, textAlign: "center", fontWeight: 600, color: text }}>{message(balance)}</Typography>
    </Paper>
  );
}
