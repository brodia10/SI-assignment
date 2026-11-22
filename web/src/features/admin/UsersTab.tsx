import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { BigButton, ConfirmSummary } from "../../components";
import { BIG_TOUCH_TARGET } from "../../theme";
import { AdminList } from "./AdminList";
import { type User, useInviteUser, useNewSetPasswordLink, useUpdateUser, useUsers } from "./adminApi";
import { activeText, changeDetails, num, type UserRole, userChangeSummary } from "./adminText";
import { activeChoices, type Choice, ChoiceToggle } from "./ChoiceToggle";
import { SetPasswordLinkDialog } from "./SetPasswordLinkDialog";

const roleChoices: readonly Choice<UserRole>[] = [
  { value: "Purchaser", label: "Purchaser" },
  { value: "Admin", label: "Admin" },
];

const roleHelp: Record<UserRole, string> = {
  Purchaser: "Purchasing, receiving, processing and sales.",
  Admin: "Everything a purchaser does, plus prices, reports and users.",
};

export function UsersTab() {
  const auth = useAuth();
  const myId = auth.status === "signedIn" ? num(auth.me.id) : null;
  const users = useUsers();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);

  return (
    <Stack spacing={2}>
      <BigButton startIcon={<PersonAddIcon />} onClick={() => setInviting(true)} sx={{ alignSelf: "flex-start" }}>
        Invite someone
      </BigButton>
      <AdminList
        isPending={users.isPending}
        error={users.error}
        onRetry={() => users.refetch()}
        emptyText="No users yet."
        rows={users.data?.map((u) => ({
          id: u.id,
          primary: u.email,
          secondary: roleHelp[u.role as UserRole] ?? u.role,
          chips: (
            <>
              {num(u.id) === myId && <Chip variant="outlined" label="You" />}
              <Chip color={u.role === "Admin" ? "primary" : "default"} label={u.role} />
              {!u.isActive && <Chip label="Turned off" />}
            </>
          ),
          muted: !u.isActive,
          onClick: () => setEditing(u),
        }))}
      />

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onInvited={(email, l) => {
            setInviting(false);
            setLink({ email, link: l });
          }}
        />
      )}
      {editing && (
        <UserDialog
          user={editing}
          isMe={num(editing.id) === myId}
          onClose={() => setEditing(null)}
          onLink={(l) => {
            setEditing(null);
            setLink({ email: editing.email, link: l });
          }}
        />
      )}
      {link && <SetPasswordLinkDialog email={link.email} link={link.link} onClose={() => setLink(null)} />}
    </Stack>
  );
}

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (email: string, link: string) => void;
}) {
  const invite = useInviteUser();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Purchaser");
  const [confirming, setConfirming] = useState(false);
  const cleanEmail = email.trim().toLowerCase();
  // A light check so an obvious slip is caught here; the API has the final say.
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  return (
    <>
      <Dialog open={!confirming} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle variant="h4" component="h2">
          Invite someone
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              label="Their email address"
              type="email"
              value={email}
              autoComplete="off"
              autoCapitalize="none"
              onChange={(e) => setEmail(e.target.value)}
              slotProps={{ htmlInput: { inputMode: "email", maxLength: 256 } }}
            />
            <ChoiceToggle
              label="What will they do?"
              value={role}
              options={roleChoices}
              onChange={setRole}
              helperText={roleHelp[role]}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
            Cancel
          </Button>
          <BigButton disabled={!looksLikeEmail} onClick={() => setConfirming(true)}>
            Review and invite
          </BigButton>
        </DialogActions>
      </Dialog>
      <ConfirmSummary
        open={confirming}
        title="Invite?"
        summary={`Invite ${cleanEmail} as ${role === "Admin" ? "an Admin" : "a Purchaser"}? You'll get a link to send them so they can set a password.`}
        error={invite.error?.message}
        busy={invite.isPending}
        confirmLabel="Invite"
        onConfirm={() =>
          invite.mutate(
            { body: { email: cleanEmail, role } },
            { onSuccess: (r) => onInvited(r.user.email, r.setPasswordLink) },
          )
        }
        onCancel={() => {
          setConfirming(false);
          invite.reset();
        }}
      />
    </>
  );
}

function UserDialog({
  user,
  isMe,
  onClose,
  onLink,
}: {
  user: User;
  isMe: boolean;
  onClose: () => void;
  onLink: (link: string) => void;
}) {
  const update = useUpdateUser();
  const newLink = useNewSetPasswordLink();
  const [role, setRole] = useState<UserRole>(user.role as UserRole);
  const [isActive, setIsActive] = useState(user.isActive);
  const [confirming, setConfirming] = useState(false);

  const details = changeDetails([
    { label: "Role", before: user.role, after: role },
    { label: "Status", before: activeText(user.isActive), after: activeText(isActive) },
  ]);

  return (
    <>
      <Dialog open={!confirming} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle variant="h4" component="h2" sx={{ overflowWrap: "anywhere" }}>
          {user.email}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {isMe && (
              <Alert severity="info" sx={{ fontSize: "1.05rem" }}>
                This is you. To change your own role or turn off your account, ask another admin.
              </Alert>
            )}
            <ChoiceToggle
              label="Role"
              value={role}
              options={roleChoices}
              onChange={setRole}
              disabled={isMe}
              helperText={roleHelp[role]}
            />
            <ChoiceToggle
              label="Account"
              value={isActive}
              options={activeChoices}
              onChange={setIsActive}
              disabled={isMe}
              helperText="A turned-off account can still sign in to Firebase, but the app refuses everything it asks for."
            />
            {user.isActive && (
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  size="large"
                  loading={newLink.isPending}
                  onClick={() => newLink.mutate(num(user.id), { onSuccess: onLink })}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Make a new set-password link
                </Button>
                {newLink.error && <Alert severity="error">{newLink.error.message}</Alert>}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="large" onClick={onClose} sx={{ minHeight: BIG_TOUCH_TARGET, px: 4 }}>
            Close
          </Button>
          {!isMe && (
            <BigButton disabled={details.length === 0} onClick={() => setConfirming(true)}>
              Review and save
            </BigButton>
          )}
        </DialogActions>
      </Dialog>
      <ConfirmSummary
        open={confirming}
        title="Save changes?"
        summary={userChangeSummary(user.email, user, role, isActive)}
        details={details}
        error={update.error?.message}
        busy={update.isPending}
        confirmLabel="Save"
        onConfirm={() => update.mutate({ id: num(user.id), body: { role, isActive } }, { onSuccess: onClose })}
        onCancel={() => {
          setConfirming(false);
          update.reset();
        }}
      />
    </>
  );
}
