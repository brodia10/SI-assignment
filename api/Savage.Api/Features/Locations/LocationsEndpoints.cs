namespace Savage.Api.Features.Locations;

public static class LocationsEndpoints
{
    public static RouteGroupBuilder MapLocationsEndpoints(this RouteGroupBuilder api)
    {
        // Lane A (Admin): bays, racks and bins. Any app user can read (pick lists); add .RequireAuthorization(Policies.Admin) to writes.
        var group = api.MapGroup("/locations")
            .WithTags("Locations");

        return api;
    }
}
