// Small helpers for reading API responses in the sales and reports screens.

/**
 * The API's OpenAPI doc types every number as `number | string`, because ASP.NET accepts numeric strings on input.
 * It always *sends* plain JSON numbers, so responses can be read as numbers. `ApiNumbers<T>` narrows a generated
 * response type accordingly, all the way down.
 */
export type ApiNumbers<T> = [number] extends [T]
  ? [string] extends [T]
    ? Deep<Exclude<T, string>>
    : Deep<T>
  : Deep<T>;

type Deep<T> = T extends readonly (infer U)[]
  ? ApiNumbers<U>[]
  : T extends object
    ? { [K in keyof T]: ApiNumbers<T[K]> }
    : T;

/** A failed API call, with a message a purchaser can read. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/** Resolves to the response body, or throws an ApiError with the server's explanation. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<ApiNumbers<T>> {
  const { data, error, response } = await request;
  if (!response.ok || data === undefined) throw new ApiError(response.status, problemMessage(error, response.status));
  return data as ApiNumbers<T>;
}

/**
 * Picks the most useful sentence out of an error body: the first validation message, else the ProblemDetails
 * `detail`, else its `title`.
 */
export function problemMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const problem = body as { errors?: unknown; detail?: unknown; title?: unknown };
    if (problem.errors && typeof problem.errors === "object") {
      const first = Object.values(problem.errors as Record<string, unknown>).flat()[0];
      if (typeof first === "string" && first) return first;
    }
    if (typeof problem.detail === "string" && problem.detail) return problem.detail;
    if (typeof problem.title === "string" && problem.title) return problem.title;
  }
  if (status === 403) return "Your account isn't allowed to do that.";
  if (status === 404) return "That record wasn't found.";
  return `Something went wrong (error ${status}). Try again.`;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
