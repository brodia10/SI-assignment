import AddIcon from "@mui/icons-material/Add";
import { Chip, Stack } from "@mui/material";
import { useState } from "react";
import { BigButton } from "../../components";
import { AdminList } from "./AdminList";
import { type Location, useLocations, useSaveLocation } from "./adminApi";
import { type LocationKind, locationKinds, num } from "./adminText";
import { NameKindDialog } from "./NameKindDialog";

const kindChoices = locationKinds.map((k) => ({ value: k, label: k }));

function itemsText(count: number) {
  return count === 0 ? "Empty" : count === 1 ? "1 item in stock" : `${count} items in stock`;
}

export function LocationsTab() {
  const locations = useLocations();
  const save = useSaveLocation();
  const [editing, setEditing] = useState<Location | "new" | null>(null);

  const close = () => {
    setEditing(null);
    save.reset();
  };
  const existing = editing !== "new" ? editing : null;

  return (
    <Stack spacing={2}>
      <BigButton startIcon={<AddIcon />} onClick={() => setEditing("new")} sx={{ alignSelf: "flex-start" }}>
        Add location
      </BigButton>
      <AdminList
        isPending={locations.isPending}
        error={locations.error}
        onRetry={() => locations.refetch()}
        emptyText="No locations yet. Add the bays, racks and bins where material is stored."
        rows={locations.data?.map((l) => ({
          id: l.id,
          primary: l.name,
          secondary: `${l.kind} · ${itemsText(num(l.itemsInStock))}`,
          chips: !l.isActive && <Chip label="Turned off" />,
          muted: !l.isActive,
          onClick: () => setEditing(l),
        }))}
      />
      {editing && (
        <NameKindDialog
          noun="location"
          maxNameLength={100}
          kindLabel="What kind of place is it?"
          kinds={kindChoices}
          defaultKind="Bay"
          existing={
            existing
              ? { name: existing.name, kind: existing.kind as LocationKind, isActive: existing.isActive }
              : undefined
          }
          confirmWarning={(v) => {
            const count = existing ? num(existing.itemsInStock) : 0;
            return existing?.isActive && !v.isActive && count > 0
              ? `${itemsText(count)} here. They stay here, but no new material can be put away in ${existing.name}.`
              : undefined;
          }}
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
