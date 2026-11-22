using Savage.Api.Domain;

namespace Savage.Api.Data;

/// <summary>
/// Master data from the assignment's example scenario. Seeded through the migration (HasData)
/// with fixed IDs, so every database (local, test, RDS) starts the same. Admin can edit it in the app.
/// Nothing here touches a sequence, so the first real PO is still #2201.
/// Properties return fresh instances, so a caller can't accidentally mutate the shared seed.
/// </summary>
public static class ReferenceData
{
    public static class ProductIds
    {
        public const int HotRolledSteelCoil = 1;
        public const int AluminumSheet = 2;
        public const int SlitCoil12In = 3;
        public const int SteelScrap = 4;
    }

    public static class LocationIds
    {
        public const int Bay1 = 1;
        public const int Bay2 = 2;
        public const int Rack1 = 3;
        public const int Rack2 = 4;
        public const int Rack3 = 5;
        public const int Rack4 = 6;
        public const int ScrapBin = 7;
    }

    public static class VendorIds
    {
        public const int Supplier = 1;
        public const int Customer = 2;
    }

    public static Product[] Products =>
    [
        new() { Id = ProductIds.HotRolledSteelCoil, Name = "Hot-Rolled Steel Coil", DefaultBuyPricePerLb = 0.42m },
        new() { Id = ProductIds.AluminumSheet, Name = "Aluminum Sheet", DefaultBuyPricePerLb = 1.35m },
        new() { Id = ProductIds.SlitCoil12In, Name = "12\" Slit Coil", DefaultSellPricePerLb = 0.55m },
        new() { Id = ProductIds.SteelScrap, Name = "Steel Scrap", IsScrap = true, DefaultSellPricePerLb = 0.15m },
    ];

    public static Location[] Locations =>
    [
        new() { Id = LocationIds.Bay1, Name = "Bay 1", Kind = LocationKind.Bay },
        new() { Id = LocationIds.Bay2, Name = "Bay 2", Kind = LocationKind.Bay },
        new() { Id = LocationIds.Rack1, Name = "Rack 1", Kind = LocationKind.Rack },
        new() { Id = LocationIds.Rack2, Name = "Rack 2", Kind = LocationKind.Rack },
        new() { Id = LocationIds.Rack3, Name = "Rack 3", Kind = LocationKind.Rack },
        new() { Id = LocationIds.Rack4, Name = "Rack 4", Kind = LocationKind.Rack },
        new() { Id = LocationIds.ScrapBin, Name = "Scrap Bin", Kind = LocationKind.Bin },
    ];

    public static Vendor[] Vendors =>
    [
        new() { Id = VendorIds.Supplier, Name = "Great Lakes Steel Supply", Kind = VendorKind.Supplier },
        new() { Id = VendorIds.Customer, Name = "Buckeye Fabrication", Kind = VendorKind.Customer },
    ];
}
