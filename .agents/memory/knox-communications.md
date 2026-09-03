---
name: Knox communications send/log
description: How email+SMS sending and logging behaves in Knox — persistence on success AND failure, and the integration binding requirement.
---

# Knox communications

Email (Resend) and SMS (Twilio) are sent through the Replit connectors proxy
(`@replit/connectors-sdk`), so no API keys are handled in app code.

## Send routes persist on success AND on failure
The send endpoints log a `communications` row for both outcomes:
- success → `status: "sent"` with `providerMessageId`
- provider/connectivity failure → `status: "failed"` with `errorMessage`
- a 400 bad-input error (e.g. empty recipient) is NOT persisted

**Why:** the schema has a `failed` status and `errorMessage` column specifically
so the history is complete ("full history" requirement) — a user can see that an
attempt was made and why it didn't go through. Failure logging is best-effort: if
the insert itself throws, the original send error is still returned to the caller.

**How to apply:** any new channel/route must keep this contract — persist failed
attempts too, not just successes.

## Integration binding gotcha
A Resend/Twilio connection needs BOTH `addIntegration` (code-side wiring) AND
`proposeIntegration` (platform binding) before the credential proxy serves
secrets. If only `addIntegration` ran, the connection shows `status: not_added`
and sends fail at runtime with a 503 "not authorized / not connected" — the code
is fine, the binding is missing. Twilio also needs `TWILIO_FROM_NUMBER` set.
