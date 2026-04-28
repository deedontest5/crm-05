## Diagnosis: This is a Microsoft 365 permission problem, not wrong sender routing

### What the code is actually doing (verified from logs)

The send-campaign-email log line confirms the routing:
```
Sending campaign email from user mailbox: deepak.dongare@realthingks.com (shared mailbox: crm@realthingks.com)
User mailbox send denied for deepak.dongare@realthingks.com; retrying via shared mailbox crm@realthingks.com
```

So:
1. The function **first tries the logged-in user's mailbox** (`deepak.dongare@realthingks.com`) — exactly what you want. Microsoft Graph rejects it with `ErrorAccessDenied`.
2. It then **falls back to the shared mailbox** (`crm@realthingks.com`). Microsoft Graph rejects that too with `ErrorAccessDenied`.
3. The user-facing error message only shows the *last* attempted sender (`crm@realthingks.com`), which makes it look like the wrong mailbox was used. That's a UX bug in the message, not a routing bug.

### Real root cause

The Azure AD app registration backing this integration does **not** have `Mail.Send` Application permission granted for either mailbox. Without that:
- Per-user sends from `deepak.dongare@…` get 403.
- Shared-mailbox sends from `crm@…` get 403 too.

This must be fixed by the Microsoft 365 admin in Entra/Azure portal — no code change can grant permission.

### Fixes (code)

1. **Make the error message accurate** — in `supabase/functions/send-campaign-email/index.ts` lines 647–650, build the message from BOTH attempts so the user can see what was tried. Example:
   > Microsoft 365 denied mailbox send access. Tried user mailbox `deepak.dongare@realthingks.com` and shared mailbox `crm@realthingks.com`. Ask your admin to grant the Azure app `Mail.Send` Application permission (with admin consent) for the sender mailbox.

   Track both attempts with a small `attemptedMailboxes: string[]` array populated where each `sendEmailViaGraph` call is made.

2. **Surface a clear admin checklist in the toast** — when `errorCode === "ErrorAccessDenied"`, append a link/hint pointing to the Azure portal area (Entra → App registrations → API permissions). Keep the message short; the audit log already stores the raw Graph response.

3. **Add an explicit opt-out for the shared-mailbox fallback** (optional config). New env: `AZURE_DISABLE_SHARED_FALLBACK=true`. When set, the fallback block at lines 612–634 is skipped and the user mailbox failure is reported directly. Useful when the shared mailbox isn't licensed for sending — avoids a misleading second 403 in the log.

### Fixes (admin/Microsoft 365 — informational, not code)

In Entra admin center → App registrations → (the app whose `AZURE_EMAIL_CLIENT_ID` is in Supabase secrets):
- API permissions → add **Microsoft Graph → Application permissions → `Mail.Send`** → Grant admin consent.
- Then restrict the app to specific mailboxes via an **Application Access Policy** (PowerShell `New-ApplicationAccessPolicy`) so the app can ONLY send as `deepak.dongare@realthingks.com`, `crm@realthingks.com`, and any other approved senders. This is the secure pattern Microsoft documents for client-credentials Mail.Send.
- Confirm both mailboxes have valid Exchange Online licenses.

After admin consent + access policy, re-test from the Reply modal.

### Verification

- After grant: send a reply → Graph returns 202 → `email_send_log.delivery_status = 'sent'`, `sender_email = deepak.dongare@realthingks.com`.
- Without grant: the new error message clearly names BOTH mailboxes and the required `Mail.Send` permission, removing the confusion that prompted this report.

### Out of Scope

- No DB schema changes.
- No UI redesign — only the toast/error string changes.
- No change to `azure-email.ts` (works correctly today).
- Follow-up runner (`campaign-follow-up-runner`) still uses the shared mailbox by design for unattended automation — out of scope for this fix.

### Files to edit

- `supabase/functions/send-campaign-email/index.ts` — track `attemptedMailboxes`, rebuild `userFacingError` (lines 593–650), optional env-gated fallback.
- (Optional) `src/components/campaigns/EmailComposeModal.tsx` — when `errorCode === "ErrorAccessDenied"`, render the multi-line admin hint inside the existing `Send results` panel instead of as a single line.
