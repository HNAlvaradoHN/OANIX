# vault-recovery-broker

Edge Function for OANIX V2 email recovery.

- `status`: reports whether recovery is prepared for the authenticated user.
- `register`: stores/rotates the server-encrypted recovery envelope for the same vault key; an existing envelope cannot be replaced with a different key.
- `recover`: returns the recovered vault key only to a JWT whose most recent AMR method is a recent email OTP.

The production function must keep JWT verification enabled. The service-role key and recovery root secret never belong in the client bundle.
