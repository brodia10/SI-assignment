import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { auth } from "../lib/firebase";

type Me = components["schemas"]["MeResponse"];

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notInvited"; firebaseUser: User; signOut: () => Promise<void> }
  | { status: "signedIn"; me: Me; signOut: () => Promise<void> };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  const meQuery = useQuery({
    queryKey: ["me", firebaseUser?.uid],
    enabled: !!firebaseUser,
    retry: false,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/me");
      if (response.status === 403) return null; // valid Firebase login, but not invited to this app
      if (!data) throw new Error(`Couldn't load your account (${response.status})`);
      return data;
    },
  });

  const queryClient = useQueryClient();
  // Drop every cached query, so the next person on a shared iPad never sees the previous user's data.
  const doSignOut = async () => {
    await signOut(auth);
    queryClient.clear();
  };

  let state: AuthState;
  if (firebaseUser === undefined || (firebaseUser && meQuery.isPending)) state = { status: "loading" };
  else if (!firebaseUser) state = { status: "signedOut" };
  else if (!meQuery.data) state = { status: "notInvited", firebaseUser, signOut: doSignOut };
  else state = { status: "signedIn", me: meQuery.data, signOut: doSignOut };

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
