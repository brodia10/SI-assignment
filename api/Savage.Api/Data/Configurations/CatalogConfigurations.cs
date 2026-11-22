using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Savage.Api.Domain;

namespace Savage.Api.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> e)
    {
        e.Property(p => p.Name).HasMaxLength(200);
        e.HasIndex(p => p.Name).IsUnique();
        e.Property(p => p.DefaultBuyPricePerLb).HasPrecision(18, 4);
        e.Property(p => p.DefaultSellPricePerLb).HasPrecision(18, 4);
        e.HasData(ReferenceData.Products);
    }
}

public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> e)
    {
        e.Property(v => v.Name).HasMaxLength(200);
        e.HasIndex(v => v.Name).IsUnique();
        e.HasData(ReferenceData.Vendors);
    }
}

public class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> e)
    {
        e.Property(l => l.Name).HasMaxLength(100);
        e.HasIndex(l => l.Name).IsUnique();
        e.HasData(ReferenceData.Locations);
    }
}
