import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BigButton, ConfirmSummary, WeightInput } from "../../components";
import type { PadOptions } from "../../components/weightPad";
import { type Product, useProducts, useSaveProduct } from "./adminApi";
import { changeDetails, cleanName, num, type ProductForm, productRows, productSummary } from "./adminText";
import { activeChoices, ChoiceToggle } from "./ChoiceToggle";

// Up to $999.999/lb. Three decimals matches how $/lb is shown everywhere ("$0.424/lb").
// Defined once: WeightInput re-syncs whenever this object changes identity.
const pricePad: PadOptions = { maxDecimals: 3, maxWholeDigits: 3 };

const scrapChoices = [
  { value: false, label: "No" },
  { value: true, label: "Yes, it's scrap" },
] as const;

const blank: ProductForm = { name: "", isScrap: false, buyPrice: null, sellPrice: null, isActive: true };

const backLink = (
  <Button component={Link} to="/admin/products" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
    All products
  </Button>
);

/** /admin/products/new and /admin/products/:id */
export function ProductEditor() {
  const { id } = useParams();
  const products = useProducts();

  if (id === undefined) return <ProductFormView />;
  if (products.isPending)
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );

  const existing = products.data?.find((p) => num(p.id) === Number(id));
  if (!existing)
    return (
      <Stack spacing={2}>
        {backLink}
        <Alert severity="warning" sx={{ fontSize: "1.05rem" }}>
          {products.error?.message ?? "That product wasn't found."}
        </Alert>
      </Stack>
    );
  return <ProductFormView key={id} existing={existing} />;
}

function ProductFormView({ existing }: { existing?: Product }) {
  const navigate = useNavigate();
  const save = useSaveProduct();
  const [form, setForm] = useState<ProductForm>(() =>
    existing
      ? {
          name: existing.name,
          isScrap: existing.isScrap,
          buyPrice: num(existing.defaultBuyPricePerLb),
          sellPrice: num(existing.defaultSellPricePerLb),
          isActive: existing.isActive,
        }
      : blank,
  );
  const [confirming, setConfirming] = useState(false);

  const name = cleanName(form.name);
  const details = changeDetails(productRows(form, existing));
  const canReview = name !== "" && details.length > 0;

  function confirm() {
    save.mutate(
      {
        id: existing && num(existing.id),
        body: {
          name,
          isScrap: form.isScrap,
          defaultBuyPricePerLb: form.buyPrice,
          defaultSellPricePerLb: form.sellPrice,
          isActive: form.isActive,
        },
      },
      { onSuccess: () => navigate("/admin/products") },
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      {backLink}
      <Typography variant="h3" component="h2">
        {existing ? existing.name : "New product"}
      </Typography>

      <TextField
        label="Product name"
        placeholder='e.g. 12" Slit Coil'
        value={form.name}
        autoComplete="off"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />

      <ChoiceToggle
        label="Is this scrap?"
        value={form.isScrap}
        options={scrapChoices}
        onChange={(isScrap) => setForm({ ...form, isScrap })}
        helperText="Scrap from a work order carries no cost. The good pieces carry the whole cost."
      />

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <WeightInput
            label="Buy price"
            unit="$/lb"
            unitSpoken="dollars per pound"
            padOptions={pricePad}
            value={form.buyPrice}
            onChange={(buyPrice) => setForm({ ...form, buyPrice })}
            helperText="Fills in on new purchase orders. Clear it for no default."
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <WeightInput
            label="Sell price"
            unit="$/lb"
            unitSpoken="dollars per pound"
            padOptions={pricePad}
            value={form.sellPrice}
            onChange={(sellPrice) => setForm({ ...form, sellPrice })}
            helperText="Fills in on new sales orders. Clear it for no default."
          />
        </Paper>
      </Box>

      {existing && (
        <ChoiceToggle
          label="Status"
          value={form.isActive}
          options={activeChoices}
          onChange={(isActive) => setForm({ ...form, isActive })}
          helperText="A turned-off product stays on old orders and in inventory, but isn't offered for new ones."
        />
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 2 }}>
        <BigButton disabled={!canReview} onClick={() => setConfirming(true)}>
          Review and save
        </BigButton>
        <Button size="large" component={Link} to="/admin/products">
          Cancel
        </Button>
      </Stack>

      <ConfirmSummary
        open={confirming}
        title={existing ? "Save product?" : "Add product?"}
        summary={productSummary(form, existing)}
        details={details}
        error={save.error?.message}
        busy={save.isPending}
        confirmLabel="Save"
        onConfirm={confirm}
        onCancel={() => {
          setConfirming(false);
          save.reset();
        }}
      />
    </Stack>
  );
}
