import createClient, { type Middleware } from "openapi-fetch";
import { auth } from "../lib/firebase";
import type { paths } from "./schema";

/** Attaches the signed-in user's Firebase ID token to every API request. */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = await auth.currentUser?.getIdToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_BASE_URL });
api.use(authMiddleware);
