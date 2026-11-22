import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import {
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type ReactNode, useId, useState } from "react";

export interface PickOption<T> {
  /** Stable, unique key for the row, usually the record's id. */
  id: string | number;
  value: T;
  label: string;
  /** A second line, e.g. "40,000 lbs · Bay 2". */
  secondary?: ReactNode;
  /** Extra text the filter box matches, e.g. the tag "C-1001" when it's only shown in `secondary`. */
  searchText?: string;
  disabled?: boolean;
}

export interface PickListProps<T> {
  options: readonly PickOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Heading above the list, e.g. "Which location?". */
  label?: string;
  /** Shown when there are no options. */
  emptyText?: string;
  /** A filter box appears once there are more options than this. */
  filterThreshold?: number;
  /** Compare values that aren't primitives (e.g. objects). Defaults to ===. */
  isEqual?: (a: T, b: T) => boolean;
}

/**
 * Tap one option from a list instead of typing. Large rows, a check on the selected one, and a filter box only
 * when the list is long enough to need it.
 */
export function PickList<T>({
  options,
  value,
  onChange,
  label,
  emptyText = "Nothing to pick from yet.",
  filterThreshold = 8,
  isEqual = Object.is,
}: PickListProps<T>) {
  const [filter, setFilter] = useState("");
  const labelId = useId();
  const showFilter = options.length > filterThreshold;
  const needle = filter.trim().toLowerCase();
  const isSelected = (o: PickOption<T>) => value !== null && isEqual(o.value, value);
  const matches = (o: PickOption<T>) => `${o.label} ${o.searchText ?? ""}`.toLowerCase().includes(needle);
  // The selected option stays visible while filtering, so the user can always see what they picked.
  const visible = showFilter && needle ? options.filter((o) => isSelected(o) || matches(o)) : options;

  return (
    <Stack spacing={1.5}>
      {label && (
        <Typography id={labelId} variant="h6" component="h2">
          {label}
        </Typography>
      )}
      {showFilter && (
        <TextField
          placeholder="Type to narrow the list"
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
      <Paper variant="outlined">
        {visible.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">
            {options.length === 0 ? emptyText : `Nothing matches “${filter.trim()}”.`}
          </Typography>
        ) : (
          // Plain buttons with aria-pressed: honest semantics for tap-to-pick, without promising listbox arrow keys.
          <List disablePadding aria-labelledby={label ? labelId : undefined}>
            {visible.map((option, i) => {
              const selected = isSelected(option);
              return (
                <ListItemButton
                  key={option.id}
                  aria-pressed={selected}
                  selected={selected}
                  disabled={option.disabled}
                  divider={i < visible.length - 1}
                  onClick={() => onChange(option.value)}
                  sx={{ minHeight: 64, py: 1.5 }}
                >
                  <ListItemText
                    primary={option.label}
                    secondary={option.secondary}
                    slotProps={{ primary: { sx: { fontSize: "1.15rem", fontWeight: selected ? 700 : 500 } } }}
                  />
                  {selected && (
                    <ListItemIcon sx={{ minWidth: 0, ml: 2 }}>
                      <CheckCircleIcon color="primary" fontSize="large" />
                    </ListItemIcon>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Paper>
    </Stack>
  );
}
