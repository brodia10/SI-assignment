import AddIcon from "@mui/icons-material/Add";
import { Chip, Stack } from "@mui/material";
import { useState } from "react";
import { BigButton } from "../../components";
import { AdminList } from "./AdminList";
import { useSaveVendor, useVendors, type Vendor } from "./adminApi";
import { num, type VendorKind } from "./adminText";
import type { Choice } from "./ChoiceToggle";
import { NameKindDialog } from "./NameKindDialog";

const kindChoices: readonly Choice<VendorKind>[] = [
  { value: "Supplier", label: "We buy from them" },
  { value: "Customer", label: "We sell to them" },
  { value: "Both", label: "Both" },
];

const kindText: Record<string, string> = { Supplier: "Supplier", Customer: "Customer", Both: "Supplier and customer" };

export function VendorsTab() {
  const vendors = useVendors();
  const save = useSaveVendor();
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);

  const close = () => {
    setEditing(null);
    save.reset();
  };
  const existing = editing !== "new" ? editing : null;
  // Vendors a purchaser quick-added in the field come first, so the admin checks them.
  const sorted =
    vendors.data && [...vendors.data].sort((a, b) => Number(b.addedByPurchaser) - Number(a.addedByPurchaser));

  return (
    <Stack spacing={2}>
      <BigButton startIcon={<AddIcon />} onClick={() => setEditing("new")} sx={{ alignSelf: "flex-start" }}>
        Add vendor
      </BigButton>
      <AdminList
        isPending={vendors.isPending}
        error={vendors.error}
        onRetry={() => vendors.refetch()}
        emptyText="No vendors yet. Add the suppliers you buy from and the customers you sell to."
        rows={sorted?.map((v) => ({
          id: v.id,
          primary: v.name,
          secondary: kindText[v.kind] ?? v.kind,
          chips: (
            <>
              {v.addedByPurchaser && <Chip color="warning" label="Added in the field: check it" />}
              {!v.isActive && <Chip label="Turned off" />}
            </>
          ),
          muted: !v.isActive,
          onClick: () => setEditing(v),
        }))}
      />
      {editing && (
        <NameKindDialog
          noun="vendor"
          maxNameLength={200}
          kindLabel="Do we buy from them or sell to them?"
          kinds={kindChoices}
          defaultKind="Supplier"
          existing={
            existing
              ? { name: existing.name, kind: existing.kind as VendorKind, isActive: existing.isActive }
              : undefined
          }
          notice={
            existing?.addedByPurchaser &&
            "A purchaser added this vendor while writing an order. Check the name and kind, then save to mark it checked."
          }
          allowUnchanged={existing?.addedByPurchaser}
          busy={save.isPending}
          error={save.error?.message}
          onResetError={save.reset}
          onSave={(body) => save.mutate({ id: existing ? num(existing.id) : undefined, body }, { onSuccess: close })}
          onClose={close}
        />
      )}
    </Stack>
  );
}
