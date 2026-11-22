import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { Link } from "react-router";
import { BigButton, MoneyText, PageHeader } from "../../components";
import type { PostedWorkOrder } from "./api";
import { formatLbs } from "./workOrderDraft";

/** After posting: the new tags, big enough to copy onto the material, and a way to run the next one. */
export function WorkOrderPosted({ posted, onAnother }: { posted: PostedWorkOrder; onAnother: () => void }) {
  return (
    <Stack spacing={2}>
      <PageHeader
        title={`Work order #${posted.number} posted`}
        subtitle={`${posted.inputTag} is used up. Tag the new items:`}
      />
      <Stack spacing={1.5}>
        {posted.outputs.map((o) => (
          <Card key={o.id} variant="outlined">
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", minWidth: 140 }}>
                {o.tag}
              </Typography>
              <Stack sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="h6" component="span">
                  {o.productName} {o.isScrap && <Chip size="small" label="Scrap" sx={{ ml: 1 }} />}
                </Typography>
                <Typography color="text.secondary">
                  {formatLbs(o.weightLbs)} · {o.locationName}
                </Typography>
              </Stack>
              <MoneyText amount={o.totalCost} sx={{ fontSize: "1.25rem", fontWeight: 600 }} />
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
        <BigButton onClick={onAnother}>Process another item</BigButton>
        <Button component={Link} to="/" size="large">
          Done
        </Button>
      </Stack>
    </Stack>
  );
}
