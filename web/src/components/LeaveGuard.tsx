import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { BIG_TOUCH_TARGET } from "../theme";
import { BigButton } from "./BigButton";
import { type Draft, firstDirty, shouldBlock } from "./leaveRules";

/** A leave that isn't a navigation, e.g. Sign out. `label` names it on the dialog: "Sign out". */
interface PendingLeave {
  leave: () => void;
  label: string;
}

interface LeaveGuardApi {
  register: (id: string, draft: Draft | null) => void;
  confirmLeave: (leave: () => void, label: string) => void;
}

const LeaveGuardContext = createContext<LeaveGuardApi | null>(null);

/**
 * Asks before throwing away a half-built PO, work order or sales order: on in-app navigation (nav, logo, back
 * swipe) and on Sign out (via `useConfirmLeave`). Desktop browsers also get their own prompt on reload or closing
 * the tab; Safari on iPad ignores that one.
 * Drafts are kept in a ref, not state, so a screen that posts and then navigates in the same tick (sales does)
 * isn't blocked by a stale "dirty" value.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const drafts = useRef(new Map<string, Draft>());
  const [pending, setPending] = useState<PendingLeave | null>(null);

  const dirtyDraft = useCallback(() => firstDirty(drafts.current.values()), []);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldBlock(drafts.current.values(), currentLocation.pathname, nextLocation.pathname),
  );

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!dirtyDraft()) return;
        event.preventDefault();
        // Older desktop browsers only prompt when returnValue is set.
        event.returnValue = "";
      },
      [dirtyDraft],
    ),
  );

  const api = useMemo<LeaveGuardApi>(
    () => ({
      register: (id, draft) => {
        if (draft) drafts.current.set(id, draft);
        else drafts.current.delete(id);
      },
      confirmLeave: (leave, label) => {
        if (dirtyDraft()) setPending({ leave, label });
        else leave();
      },
    }),
    [dirtyDraft],
  );

  function stay() {
    if (blocker.state === "blocked") blocker.reset();
    setPending(null);
  }

  function leave() {
    if (blocker.state === "blocked") blocker.proceed();
    if (pending) {
      setPending(null);
      pending.leave();
    }
  }

  return (
    <LeaveGuardContext.Provider value={api}>
      {children}
      <LeaveDialog
        open={blocker.state === "blocked" || pending !== null}
        what={dirtyDraft()?.what ?? "screen"}
        action={pending?.label}
        onStay={stay}
        onLeave={leave}
      />
    </LeaveGuardContext.Provider>
  );
}

interface LeaveDialogProps {
  open: boolean;
  what: string;
  /** Set for a leave that isn't a navigation ("Sign out"); otherwise the dialog says "Leave". */
  action?: string;
  onStay: () => void;
  onLeave: () => void;
}

function LeaveDialog({ open, what, action, onStay, onLeave }: LeaveDialogProps) {
  return (
    <Dialog open={open} onClose={onStay} fullWidth maxWidth="sm">
      <DialogTitle variant="h4" component="h2">
        {action ? `${action}?` : `Leave this ${what}?`}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "1.3rem", lineHeight: 1.5 }}>
          The {what} you're writing hasn't been saved and will be lost.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button size="large" color="error" onClick={onLeave} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
          {action ?? "Leave"} and lose it
        </Button>
        {/* Staying is the safe choice, so it's the big one. */}
        <BigButton onClick={onStay}>Keep editing</BigButton>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Marks this screen's draft as worth protecting while `dirty` is true. Set it false as soon as the post starts or
 * succeeds, so moving on to the "posted" screen isn't blocked. Does nothing outside a LeaveGuardProvider (tests).
 */
export function useLeaveGuard(dirty: boolean, what: string) {
  const api = useContext(LeaveGuardContext);
  const id = useId();
  // Layout effects, so the flag is current before any click or post callback can navigate.
  useLayoutEffect(() => {
    api?.register(id, { dirty, what });
  }, [api, id, dirty, what]);
  useLayoutEffect(() => () => api?.register(id, null), [api, id]);
}

/** For leaving without navigating, e.g. `confirmLeave(signOut, "Sign out")`. Runs it at once if nothing is unsaved. */
export function useConfirmLeave(): (leave: () => void, label: string) => void {
  const api = useContext(LeaveGuardContext);
  return useCallback((leave: () => void, label: string) => (api ? api.confirmLeave(leave, label) : leave()), [api]);
}
