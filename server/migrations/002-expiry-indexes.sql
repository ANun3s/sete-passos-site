-- Application-owned additive indexes; core schema is the untouched CLI output in 001.
CREATE INDEX "session_expiresAt_idx" ON "session" ("expiresAt");
CREATE INDEX "verification_expiresAt_idx" ON "verification" ("expiresAt");
CREATE INDEX "rateLimit_lastRequest_idx" ON "rateLimit" ("lastRequest");
