import { Box, type BoxProps } from "@mui/material";
import { displaySign, formatMoney, formatPerLb } from "./money";

export interface MoneyTextProps extends Omit<BoxProps<"span">, "children"> {
  /** Dollars. For `perLb`, dollars per pound. */
  amount: number;
  /** Show as "$0.424/lb" instead of "$8,400.00". */
  perLb?: boolean;
  /** Color profit green and losses red. Leave off for costs and prices. */
  signColor?: boolean;
}

/** A dollar amount, formatted the same way everywhere. Tabular digits so columns of money line up. */
export function MoneyText({ amount, perLb = false, signColor = false, sx, ...props }: MoneyTextProps) {
  const sign = displaySign(amount, perLb);
  const color = signColor ? (sign > 0 ? "success.main" : sign < 0 ? "error.main" : undefined) : undefined;
  return (
    <Box
      component="span"
      sx={[{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {perLb ? formatPerLb(amount) : formatMoney(amount)}
    </Box>
  );
}
