import { Alert, Stack } from "@mui/material";
import { formatMoney, PageHeader, PickList, type PickOption } from "../../components";
import type { InputOption } from "./api";
import { formatLbs } from "./workOrderDraft";

interface PickInputStepProps {
  inputs: readonly InputOption[];
  /** Why the purchaser is back here, e.g. "C-1001 was already processed…". */
  notice?: string | null;
  onPick: (inputItemId: number) => void;
}

/** Step 1: which in-stock item is going on the line. One tap moves on. */
export function PickInputStep({ inputs, notice, onPick }: PickInputStepProps) {
  const options: PickOption<number>[] = inputs.map((i) => ({
    id: i.id,
    value: i.id,
    label: `${i.tag} · ${i.productName}`,
    secondary: `${formatLbs(i.weightLbs)} · ${i.locationName} · ${formatMoney(i.totalCost)}`,
    searchText: `${i.tag} ${i.locationName}`,
  }));

  return (
    <Stack spacing={2}>
      <PageHeader title="Processing" subtitle="Run a work order: one item in, many items out." />
      {notice && (
        <Alert severity="warning" sx={{ fontSize: "1.1rem" }}>
          {notice}
        </Alert>
      )}
      <PickList
        label="Which item are you processing?"
        options={options}
        value={null}
        onChange={onPick}
        emptyText="Nothing is in stock. Receive a purchase order first."
      />
    </Stack>
  );
}
