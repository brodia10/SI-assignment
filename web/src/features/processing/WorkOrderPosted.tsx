import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { BigButton, MoneyText, SuccessCard } from "../../components";
import type { PostedWorkOrder } from "./api";
import { formatLbs } from "./workOrderDraft";

/** After posting: the new tags, big enough to copy onto the material, and a way to run the next one. */
export function WorkOrderPosted({ posted, onAnother }: { posted: PostedWorkOrder; onAnother: () => void }) {
  const navigate = useNavigate();
  return (
    <SuccessCard
      title={`Work order #${posted.number} posted`}
      subtitle={`${posted.inputTag} is used up. Tag each new piece with its number below.`}
      actions={
        <>
          <BigButton onClick={onAnother}>Process another item</BigButton>
          <BigButton variant="outlined" onClick={() => navigate("/")}>
            Home
          </BigButton>
        </>
      }
    >
      <Paper variant="outlined" component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {posted.outputs.map((o, i) => (
          <Stack
            component="li"
            key={o.id}
            direction="row"
            spacing={3}
            sx={{ alignItems: "center", px: 2.5, py: 2, borderTop: i > 0 ? 1 : 0, borderColor: "divider" }}
          >
            <Typography sx={{ fontSize: "2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {o.tag}
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 600 }}>
                {o.productName} {o.isScrap && <Chip size="small" label="Scrap" sx={{ ml: 1 }} />}
              </Typography>
              <Typography color="text.secondary">
                {formatLbs(o.weightLbs)} · {o.locationName}
              </Typography>
            </Box>
            <MoneyText amount={o.totalCost} sx={{ fontSize: "1.1rem" }} />
          </Stack>
        ))}
      </Paper>
    </SuccessCard>
  );
}
