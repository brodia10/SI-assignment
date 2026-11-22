import { Button, type ButtonProps } from "@mui/material";
import { BIG_TOUCH_TARGET } from "../theme";

export type BigButtonProps = Omit<ButtonProps, "size">;

/**
 * The main action on a screen ("Receive PO", "Confirm"). Big enough to hit with a gloved thumb.
 * Pass `loading` while a request is in flight: the button is disabled, so a double tap can't post twice.
 */
export function BigButton({ variant = "contained", sx, ...props }: BigButtonProps) {
  return (
    <Button
      variant={variant}
      size="large"
      sx={[
        { minHeight: BIG_TOUCH_TARGET, px: 4, fontSize: "1.25rem", borderRadius: 3 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
}
