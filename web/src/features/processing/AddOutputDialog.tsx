import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import { BigButton, PickList, type PickOption, WeightInput } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";
import type { LocationOption, ProductOption } from "./api";
import { type DraftOutput, formatLbs } from "./workOrderDraft";

/** Most identical outputs in one go. Plenty for "four slit coils"; more can be added again. */
const MAX_COPIES = 20;

interface AddOutputDialogProps {
  products: readonly ProductOption[];
  locations: readonly LocationOption[];
  /** Input weight not yet used by outputs. Offered as a one-tap weight when positive. */
  remainingLbs: number;
  /** How many more outputs the work order can take. */
  room: number;
  onAdd: (entry: Omit<DraftOutput, "key">, count: number) => void;
  onClose: () => void;
}

/**
 * Add one output, or several identical ones ("4 × 9,900 lbs into Rack 4"). Mount it only while open, so it starts
 * empty every time.
 */
export function AddOutputDialog({ products, locations, remainingLbs, room, onAdd, onClose }: AddOutputDialogProps) {
  const [productId, setProductId] = useState<number | null>(null);
  const [weightLbs, setWeightLbs] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [count, setCount] = useState(1);
  const countLabelId = useId();
  const maxCount = Math.max(1, Math.min(MAX_COPIES, room));

  const productOptions: PickOption<number>[] = products.map((p) => ({
    id: p.id,
    value: p.id,
    label: p.name,
    secondary: p.isScrap ? "Scrap: carries $0 cost" : undefined,
  }));
  const locationOptions: PickOption<number>[] = locations.map((l) => ({
    id: l.id,
    value: l.id,
    label: l.name,
    secondary: l.kind,
  }));

  const ready = productId !== null && weightLbs !== null && weightLbs > 0 && locationId !== null && count <= room;

  function add() {
    if (!ready) return;
    onAdd({ productId, weightLbs, locationId }, count);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="body">
      <DialogTitle variant="h4" component="h2">
        Add output
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <Stack spacing={3}>
            <PickList
              label="What came off the line?"
              options={productOptions}
              value={productId}
              onChange={setProductId}
            />
            <PickList
              label="Where is it going?"
              options={locationOptions}
              value={locationId}
              onChange={setLocationId}
            />
          </Stack>
          <Stack spacing={2} sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}>
            <WeightInput label={count > 1 ? "Weight of each" : "Weight"} value={weightLbs} onChange={setWeightLbs} />
            {remainingLbs > 0 && (
              <Button
                variant="outlined"
                onClick={() => {
                  setWeightLbs(remainingLbs);
                  setCount(1);
                }}
              >
                Use what's left: {formatLbs(remainingLbs)}
              </Button>
            )}
            <Stack spacing={1}>
              <Typography variant="h6" component="span" id={countLabelId}>
                How many like this?
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }} aria-labelledby={countLabelId}>
                <IconButton
                  aria-label="One fewer"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  disabled={count <= 1}
                  sx={{ border: 1, borderColor: "divider", width: BIG_TOUCH_TARGET, height: BIG_TOUCH_TARGET }}
                >
                  <RemoveIcon fontSize="large" />
                </IconButton>
                <Typography
                  role="status"
                  aria-live="polite"
                  sx={{ fontSize: "2rem", fontWeight: 700, minWidth: 48, textAlign: "center" }}
                >
                  {count}
                </Typography>
                <IconButton
                  aria-label="One more"
                  onClick={() => setCount((c) => Math.min(maxCount, c + 1))}
                  disabled={count >= maxCount}
                  sx={{ border: 1, borderColor: "divider", width: BIG_TOUCH_TARGET, height: BIG_TOUCH_TARGET }}
                >
                  <AddIcon fontSize="large" />
                </IconButton>
              </Stack>
              {count > 1 && weightLbs !== null && weightLbs > 0 && (
                <Typography color="text.secondary">
                  {count} × {formatLbs(weightLbs)} = {formatLbs((Math.round(weightLbs * 100) * count) / 100)}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
          Cancel
        </Button>
        <BigButton onClick={add} disabled={!ready}>
          {count > 1 ? `Add ${count} outputs` : "Add output"}
        </BigButton>
      </DialogActions>
    </Dialog>
  );
}
