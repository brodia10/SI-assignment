using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Features.Locations;
using Savage.Api.Features.Me;
using Savage.Api.Features.Processing;
using Savage.Api.Features.Products;
using Savage.Api.Features.Purchasing;
using Savage.Api.Features.Receiving;
using Savage.Api.Features.Reports;
using Savage.Api.Features.Sales;
using Savage.Api.Features.Users;
using Savage.Api.Features.Vendors;

var builder = WebApplication.CreateBuilder(args);

// Runs as a normal Kestrel app locally; inside AWS Lambda (function URL) this swaps in the Lambda host.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure()));

builder.Services.AddFirebaseAuth(builder.Configuration);
builder.Services.AddUsersFeature();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (args.Contains("seed-demo-users"))
{
    await DemoUserSeeder.RunAsync(app.Services);
    return;
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi().AllowAnonymous();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous().ExcludeFromDescription();

// One endpoint group per feature. Every group needs an app user (fallback policy); Users and Reports are admin-only.
var api = app.MapGroup("/api");
api.MapMeEndpoints();
api.MapProductsEndpoints();
api.MapVendorsEndpoints();
api.MapLocationsEndpoints();
api.MapUsersEndpoints();
api.MapPurchasingEndpoints();
api.MapReceivingEndpoints();
api.MapProcessingEndpoints();
api.MapSalesEndpoints();
api.MapReportsEndpoints();

app.Run();

// Lets the integration tests start the app with WebApplicationFactory<Program>.
public partial class Program;
