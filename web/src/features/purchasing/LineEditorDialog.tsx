import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { BigButton, MoneyText, PickList, WeightInput } from "../../components";
import type { PadOptions } from "../../components/weightPad";
import { BIG_TOUCH_TARGET, TOUCH_TARGET } from "../../theme";
import type { Product } from "./api";
import { formatBuyPrice, formatLbs } from "./format";
import { lineTotal } from "./poMath";

/** A PO line being written on the New PO screen. `key` is local only; the API assigns real ids. */
export interface LineDraft {
  key: string;
  productId: number;
  productName: string;
  weightLbs: number;
  pricePerLb: number;
  grade: string;
}

// Same limits as the API: 2 decimals and up to 999,999.99 lbs; $/lb with 4 decimals and up to $999.9999.
const pricePad: PadOptions = { maxDecimals: 4, maxWholeDigits: 3 };
const MAX_GRADE_LENGTH = 50;
const twoColumns = { display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } } as const;

// Local keys for React lists. (crypto.randomUUID needs HTTPS, which a dev server on the LAN doesn't have.)
let lineCounter = 0;
const nextLineKey = () => `line-${++lineCounter}`;

interface LineEditorDialogProps {
  products: readonly Product[];
  /** The line being changed, or undefined to add a new one. */
  line?: LineDraft;
  onSave: (line: LineDraft) => void;
  onClose: () => void;
}

/**
 * Add or change one product on the PO: tap the product, punch in the weight, and the $/lb fills in from the
 * product's default (the purchaser can change it). Once a product is picked the list folds down to one row, so
 * the weight and price pads sit side by side on an iPad without scrolling. Mounted fresh each time it opens, so its
 * state starts clean.
 */
export function LineEditorDialog({ products, line, onSave, onClose }: LineEditorDialogProps) {
  const [productId, setProductId] = useState<number | null>(line?.productId ?? null);
  const [weightLbs, setWeightLbs] = useState<number | null>(line?.weightLbs ?? null);
  const [pricePerLb, setPricePerLb] = useState<number | null>(line?.pricePerLb ?? null);
  const [grade, setGrade] = useState(line?.grade ?? "");
  const [choosingProduct, setChoosingProduct] = useState(line === undefined);

  const product = products.find((p) => p.id === productId) ?? null;
  const defaultPrice = product?.defaultBuyPricePerLb ?? null;

  function pickProduct(id: number) {
    setProductId(id);
    setChoosingProduct(false);
    // A new product brings its default price. Switching products replaces whatever price was there, because
    // a price typed for steel is almost certainly wrong for aluminum.
    if (id !== productId) setPricePerLb(products.find((p) => p.id === id)?.defaultBuyPricePerLb ?? null);
  }

  const ready = product !== null && weightLbs !== null && weightLbs > 0 && pricePerLb !== null;

  function save() {
    if (!ready) return;
    onSave({
      key: line?.key ?? nextLineKey(),
      productId: product.id,
      productName: product.name,
      weightLbs,
      pricePerLb,
      grade: grade.trim(),
    });
  }

  const priceHelp =
    product === null
      ? "Pick the product first."
      : defaultPrice === null
        ? `${product.name} has no default price. Enter what you agreed.`
        : pricePerLb === defaultPrice
          ? "Filled in from the product's price."
          : `The product's price is ${formatBuyPrice(defaultPrice)}.`;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle variant="h4" component="h2">
        {line ? "Change this product" : "Add a product"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {choosingProduct || product === null ? (
            <PickList
              label="What did you grade?"
              options={products.map((p) => ({
                id: p.id,
                value: p.id,
                label: p.name,
                secondary:
                  p.defaultBuyPricePerLb === null ? "No default price" : formatBuyPrice(p.defaultBuyPricePerLb),
              }))}
              value={productId}
              onChange={pickProduct}
              emptyText="No products are set up yet. Ask an admin to add them."
            />
          ) : (
            <Box sx={twoColumns}>
              <Paper
                variant="outlined"
                sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1, minHeight: TOUCH_TARGET + 8 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {defaultPrice === null ? "No default price" : formatBuyPrice(defaultPrice)}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => setChoosingProduct(true)}
                  aria-label={`Change product (${product.name})`}
                >
                  Change
                </Button>
              </Paper>
              <TextField
                label="Grade (optional)"
                placeholder="e.g. Prime, #1, Secondary"
                value={grade}
                onChange={(e) => setGrade(e.target.value.slice(0, MAX_GRADE_LENGTH))}
              />
            </Box>
          )}
          {/* Two equal columns from 600px up, so the pads are the same size and their keys line up. */}
          <Box sx={twoColumns}>
            <WeightInput dense label="Weight" value={weightLbs} onChange={setWeightLbs} />
            <WeightInput
              dense
              label="Price"
              unit="$/lb"
              unitSpoken="dollars per pound"
              padOptions={pricePad}
              value={pricePerLb}
              onChange={setPricePerLb}
              helperText={priceHelp}
              disabled={product === null}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        <Box sx={{ px: 1 }}>
          {ready ? (
            <Typography sx={{ fontSize: "1.2rem" }}>
              {formatLbs(weightLbs)} × {formatBuyPrice(pricePerLb)} ={" "}
              <MoneyText amount={lineTotal({ weightLbs, pricePerLb })} sx={{ fontWeight: 700 }} />
            </Typography>
          ) : (
            <Typography color="text.secondary">Pick the product and enter the weight.</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
            Cancel
          </Button>
          <BigButton onClick={save} disabled={!ready}>
            {line ? "Save" : "Add to PO"}
          </BigButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
