import AddIcon from "@mui/icons-material/Add";
import { Chip, Stack } from "@mui/material";
import { useNavigate } from "react-router";
import { BigButton } from "../../components";
import { AdminList } from "./AdminList";
import { useProducts } from "./adminApi";
import { pricesText } from "./adminText";

export function ProductsTab() {
  const products = useProducts();
  const navigate = useNavigate();

  return (
    <Stack spacing={2}>
      <BigButton
        onClick={() => navigate("/admin/products/new")}
        startIcon={<AddIcon />}
        sx={{ alignSelf: "flex-start" }}
      >
        Add product
      </BigButton>
      <AdminList
        isPending={products.isPending}
        error={products.error}
        onRetry={() => products.refetch()}
        emptyText="No products yet. Add what you buy and sell, with a price for each."
        rows={products.data?.map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: pricesText(p.defaultBuyPricePerLb, p.defaultSellPricePerLb),
          chips: (
            <>
              {p.isScrap && <Chip color="secondary" variant="outlined" label="Scrap" />}
              {!p.isActive && <Chip label="Turned off" />}
            </>
          ),
          muted: !p.isActive,
          onClick: () => navigate(`/admin/products/${p.id}`),
        }))}
      />
    </Stack>
  );
}
