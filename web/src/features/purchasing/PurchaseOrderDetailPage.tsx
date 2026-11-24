import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import TimelineIcon from "@mui/icons-material/Timeline";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { canAccess, toRole } from "../../app/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { ActionBar, BigButton, MoneyText, PageHeader } from "../../components";
import { type PurchaseOrder, type PurchaseOrderLine, type ReceivedLineItem, usePurchaseOrder } from "./api";
import { formatBuyPrice, formatLbs, purchaseOrderStatusChip } from "./format";
import { backTarget, receivedItemStatus, receivedItemText } from "./poDetail";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dayAndTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** /purchasing/:id — read-only: what was ordered and, once received, the tag and location each line became. */
export function PurchaseOrderDetailPage() {
  const id = Number(useParams().id);
  const back = backTarget(useLocation().state);
  const po = usePurchaseOrder(id);
  const auth = useAuth();
  // The trace screen lives in Reports, so only show its link to people who can open it (admins).
  const canTrace = auth.status === "signedIn" && canAccess(toRole(auth.me.role), "reports");

  return (
    <>
      <Box sx={{ mb: 1 }}>
        <Button component={Link} to={back.path} startIcon={<ArrowBackIcon />}>
          {back.label}
        </Button>
      </Box>
      {!Number.isInteger(id) || id <= 0 ? (
        <LoadError message="That isn't a purchase order." back={back} />
      ) : po.isPending ? (
        <CircularProgress sx={{ display: "block", mx: "auto", my: 6 }} />
      ) : po.isError ? (
        <LoadError message={po.error.message} back={back} onRetry={() => po.refetch()} />
      ) : (
        <Detail po={po.data} canTrace={canTrace} />
      )}
    </>
  );
}

interface LoadErrorProps {
  message: string;
  back: { path: string; label: string };
  onRetry?: () => void;
}

function LoadError({ message, back, onRetry }: LoadErrorProps) {
  const navigate = useNavigate();
  return (
    <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
      <Alert
        severity="error"
        sx={{ fontSize: "1.1rem", alignSelf: "stretch" }}
        action={onRetry && <Button onClick={onRetry}>Try again</Button>}
      >
        {message}
      </Alert>
      <BigButton variant="outlined" onClick={() => navigate(back.path)}>
        {back.label}
      </BigButton>
    </Stack>
  );
}

function Detail({ po, canTrace }: { po: PurchaseOrder; canTrace: boolean }) {
  const navigate = useNavigate();
  const chip = purchaseOrderStatusChip[po.status];
  const isOpen = po.status === "Open";

  return (
    <>
      <PageHeader
        title={`PO #${po.number}`}
        subtitle={po.vendorName}
        action={<Chip label={chip.label} color={chip.color} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />}
      />

      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: "1.1rem" }}>
          Written {day.format(new Date(po.createdAt))} by {po.createdByEmail}
        </Typography>
        {po.receivedAt && (
          <Typography sx={{ fontSize: "1.1rem" }}>
            Received {dayAndTime.format(new Date(po.receivedAt))}
            {po.receivedByEmail && ` by ${po.receivedByEmail}`}
          </Typography>
        )}
      </Stack>

      <Paper variant="outlined" component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {po.lines.map((line, i) => (
          <LineRow key={line.id} line={line} first={i === 0} canTrace={canTrace} />
        ))}
        <Stack
          component="li"
          direction="row"
          spacing={2}
          sx={{ px: 2.5, py: 2, borderTop: 2, borderColor: "divider", alignItems: "baseline" }}
        >
          <Typography sx={{ flexGrow: 1, fontSize: "1.25rem", fontWeight: 700 }}>
            Total · {formatLbs(po.totalWeightLbs)}
          </Typography>
          <MoneyText amount={po.total} sx={{ fontSize: "1.5rem", fontWeight: 800 }} />
        </Stack>
      </Paper>

      {isOpen && (
        <ActionBar>
          <BigButton onClick={() => navigate(`/receiving/${po.id}`)}>Receive it now</BigButton>
        </ActionBar>
      )}
    </>
  );
}

function LineRow({ line, first, canTrace }: { line: PurchaseOrderLine; first: boolean; canTrace: boolean }) {
  return (
    <Box component="li" sx={{ px: 2.5, py: 2, borderTop: first ? 0 : 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "baseline" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.25rem", fontWeight: 700 }}>{line.productName}</Typography>
            {line.grade && <Chip label={`Grade ${line.grade}`} size="small" />}
          </Stack>
          <Typography color="text.secondary">
            {formatLbs(line.weightLbs)} at {formatBuyPrice(line.pricePerLb)}
          </Typography>
        </Box>
        <MoneyText amount={line.lineTotal} sx={{ fontSize: "1.25rem", fontWeight: 700 }} />
      </Stack>
      {line.receivedItems.length > 0 && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {line.receivedItems.map((item) => (
            <ReceivedItemRow key={item.inventoryItemId} item={item} canTrace={canTrace} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** The tag to look up: big, like on the "PO received" screen, with where the piece is now and what it cost. */
function ReceivedItemRow({ item, canTrace }: { item: ReceivedLineItem; canTrace: boolean }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        rowGap: 1,
        px: 2,
        py: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
        {item.tag}
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={{ fontSize: "1.1rem" }}>{receivedItemText(item)}</Typography>
        <Typography color="text.secondary">
          Cost <MoneyText amount={item.totalCost} />
        </Typography>
      </Box>
      <Chip label={receivedItemStatus[item.status].label} color={receivedItemStatus[item.status].color} />
      {canTrace && (
        <Button
          component={Link}
          to={`/reports/lineage/${item.inventoryItemId}`}
          variant="outlined"
          startIcon={<TimelineIcon />}
        >
          Trace
        </Button>
      )}
    </Stack>
  );
}
