import SearchIcon from "@mui/icons-material/Search";
import {
  Checkbox,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import type { SellableItem } from "./salesApi";
import { formatLbs } from "./salesOrderDraft";

interface ItemChecklistProps {
  label: string;
  items: readonly SellableItem[];
  selectedIds: readonly number[];
  onToggle: (item: SellableItem) => void;
  /** A filter box appears once there are more items than this. */
  filterThreshold?: number;
}

/**
 * Tap items to put them on the order (several at once, unlike PickList). Grouped by product so the purchaser finds
 * "the slit coils in Rack 4" quickly; picked items stay visible while filtering.
 */
export function ItemChecklist({ label, items, selectedIds, onToggle, filterThreshold = 8 }: ItemChecklistProps) {
  const [filter, setFilter] = useState("");
  const labelId = useId();
  const needle = filter.trim().toLowerCase();
  const showFilter = items.length > filterThreshold;
  const visible =
    showFilter && needle
      ? items.filter(
          (i) =>
            selectedIds.includes(i.id) || `${i.tag} ${i.productName} ${i.locationName}`.toLowerCase().includes(needle),
        )
      : items;

  const groups = new Map<string, SellableItem[]>();
  for (const item of visible) groups.set(item.productName, [...(groups.get(item.productName) ?? []), item]);

  return (
    <Stack spacing={1.5}>
      <Typography id={labelId} variant="h6" component="h2">
        {label}
      </Typography>
      {showFilter && (
        <TextField
          placeholder="Type a tag, product or location"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {visible.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">
            {items.length === 0 ? "Nothing is in stock right now." : `Nothing matches “${filter.trim()}”.`}
          </Typography>
        ) : (
          <List disablePadding aria-labelledby={labelId}>
            {[...groups].map(([product, group]) => (
              <li key={product}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ fontSize: "1rem", fontWeight: 700, bgcolor: "background.default" }}>
                    {product} · {group.length} in stock
                  </ListSubheader>
                  {group.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    return (
                      <ListItemButton
                        key={item.id}
                        role="checkbox"
                        aria-checked={checked}
                        selected={checked}
                        onClick={() => onToggle(item)}
                        divider
                        sx={{ minHeight: 64 }}
                      >
                        <ListItemIcon sx={{ minWidth: 56 }}>
                          <Checkbox
                            edge="start"
                            checked={checked}
                            tabIndex={-1}
                            disableRipple
                            slotProps={{ input: { "aria-hidden": true } }}
                            sx={{ "& .MuiSvgIcon-root": { fontSize: 32 } }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.tag}
                          secondary={`${formatLbs(item.weightLbs)} · ${item.locationName}`}
                          slotProps={{ primary: { sx: { fontSize: "1.15rem", fontWeight: checked ? 700 : 500 } } }}
                        />
                      </ListItemButton>
                    );
                  })}
                </ul>
              </li>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  );
}
