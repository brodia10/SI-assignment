import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useState } from "react";
import { BigButton, WeightInput } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";

/** Prices are stored with up to 4 decimals ($0.5525/lb); nobody quotes more than $999/lb. */
const pricePad = { maxDecimals: 4, maxWholeDigits: 3 };

interface PriceDialogProps {
  productName: string;
  /** The current price, or null when there isn't one yet. */
  initial: number | null;
  onSave: (pricePerLb: number) => void;
  onCancel: () => void;
}

/** Change the $/lb for one product on the order, with the number pad. Mount it only while open. */
export function PriceDialog({ productName, initial, onSave, onCancel }: PriceDialogProps) {
  const [price, setPrice] = useState<number | null>(initial);

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle variant="h4" component="h2">
        Price for {productName}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", justifyContent: "center" }}>
        <WeightInput
          label="Sell price"
          unit="$/lb"
          unitSpoken="dollars per pound"
          padOptions={pricePad}
          value={price}
          onChange={setPrice}
          helperText="Applies to every item of this product on the order."
        />
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button size="large" onClick={onCancel} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
          Cancel
        </Button>
        <BigButton disabled={price === null} onClick={() => price !== null && onSave(price)}>
          Use this price
        </BigButton>
      </DialogActions>
    </Dialog>
  );
}
