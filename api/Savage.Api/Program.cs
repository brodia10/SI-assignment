using Microsoft.EntityFrameworkCore;
using Savage.Api.Auth;
using Savage.Api.Data;
using Savage.Api.Features.Me;

var builder = WebApplication.CreateBuilder(args);

// Runs as a normal Kestrel app locally; inside AWS Lambda (function URL) this swaps in the Lambda host.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql => sql.EnableRetryOnFailure()));

builder.Services.AddFirebaseAuth(builder.Configuration);
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

var api = app.MapGroup("/api");
api.MapMeEndpoints();

app.Run();

// Lets the integration tests start the app with WebApplicationFactory<Program>.
public partial class Program;
