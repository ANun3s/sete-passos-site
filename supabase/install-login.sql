-- Generated from supabase/migrations. Run as the database owner in Supabase SQL Editor.

BEGIN;

SELECT pg_advisory_xact_lock(730071007);

CREATE SCHEMA IF NOT EXISTS sete_passos_auth;

REVOKE ALL ON SCHEMA sete_passos_auth FROM PUBLIC;

CREATE TABLE IF NOT EXISTS sete_passos_auth._migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());

DO $body$
DECLARE previous text;
BEGIN
  SELECT checksum INTO previous FROM sete_passos_auth._migrations WHERE name = '202610070001_better_auth.sql';
  IF previous IS NULL THEN
    EXECUTE $migration$create schema if not exists "sete_passos_auth";

create table "sete_passos_auth"."user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "sete_passos_auth"."session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "sete_passos_auth"."user" ("id") on delete cascade);

create table "sete_passos_auth"."account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "sete_passos_auth"."user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "sete_passos_auth"."verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "sete_passos_auth"."rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "sete_passos_auth"."session" ("userId");

create index "account_userId_idx" on "sete_passos_auth"."account" ("userId");

create index "verification_identifier_idx" on "sete_passos_auth"."verification" ("identifier");
$migration$;
    INSERT INTO sete_passos_auth._migrations(name, checksum) VALUES ('202610070001_better_auth.sql', '495960184b3a316cd5c5ebbe3aeff794745f675c6c7826078a4fb7c1c25c3d2a');
  ELSIF previous <> '495960184b3a316cd5c5ebbe3aeff794745f675c6c7826078a4fb7c1c25c3d2a' THEN
    RAISE EXCEPTION 'Applied migration changed: 202610070001_better_auth.sql';
  END IF;
END $body$;

DO $body$
DECLARE previous text;
BEGIN
  SELECT checksum INTO previous FROM sete_passos_auth._migrations WHERE name = '202610070002_auth_security.sql';
  IF previous IS NULL THEN
    EXECUTE $migration$-- Better Auth uses its own server sessions. Supabase Auth JWTs do not grant
-- access to these tables. Never expose this schema through the Data API.
REVOKE ALL ON SCHEMA sete_passos_auth FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA sete_passos_auth FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA sete_passos_auth FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sete_passos_auth REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

-- No password or login is created here. A separate server-only login can be
-- made a member of this role when the backend connection is configured.
CREATE ROLE sete_passos_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA sete_passos_auth TO sete_passos_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  sete_passos_auth."user", sete_passos_auth.account,
  sete_passos_auth.session, sete_passos_auth.verification,
  sete_passos_auth."rateLimit" TO sete_passos_backend;

ALTER TABLE sete_passos_auth."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sete_passos_auth.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE sete_passos_auth.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE sete_passos_auth.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE sete_passos_auth."rateLimit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON sete_passos_auth."user" TO sete_passos_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON sete_passos_auth.account TO sete_passos_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON sete_passos_auth.session TO sete_passos_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON sete_passos_auth.verification TO sete_passos_backend USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON sete_passos_auth."rateLimit" TO sete_passos_backend USING (true) WITH CHECK (true);

CREATE INDEX session_expiry_idx ON sete_passos_auth.session ("expiresAt");
CREATE INDEX verification_expiry_idx ON sete_passos_auth.verification ("expiresAt");
CREATE INDEX rate_limit_expiry_idx ON sete_passos_auth."rateLimit" ("lastRequest");
COMMENT ON SCHEMA sete_passos_auth IS 'Sete Passos: private Better Auth login database. Server access only; no clinical data.';
$migration$;
    INSERT INTO sete_passos_auth._migrations(name, checksum) VALUES ('202610070002_auth_security.sql', '95527e021b0d5c0b7037ad729b971183b29366759b574f066f3520a38ae03de6');
  ELSIF previous <> '95527e021b0d5c0b7037ad729b971183b29366759b574f066f3520a38ae03de6' THEN
    RAISE EXCEPTION 'Applied migration changed: 202610070002_auth_security.sql';
  END IF;
END $body$;

DO $body$
DECLARE previous text;
BEGIN
  SELECT checksum INTO previous FROM sete_passos_auth._migrations WHERE name = '20261014200652_admin_clinical_fichas.sql';
  IF previous IS NULL THEN
    EXECUTE $migration$CREATE TABLE sete_passos_auth.clinical_ficha (
  id text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES sete_passos_auth."user" (id) ON DELETE CASCADE,
  "createdBy" text REFERENCES sete_passos_auth."user" (id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  type text NOT NULL CHECK (type IN ('avaliacao-fisioterapeutica', 'proposta-tratamento', 'outro')),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND jsonb_typeof(content->'text') = 'string'),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sete_passos_auth.clinical_ficha ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON sete_passos_auth.clinical_ficha
  TO sete_passos_backend USING (true) WITH CHECK (true);
REVOKE ALL ON sete_passos_auth.clinical_ficha FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON sete_passos_auth.clinical_ficha TO sete_passos_backend;

CREATE INDEX clinical_ficha_user_created_idx
  ON sete_passos_auth.clinical_ficha ("userId", "createdAt" DESC);

COMMENT ON TABLE sete_passos_auth.clinical_ficha IS
  'Sensitive individual records. Private backend-only storage linked to Better Auth profiles.';
$migration$;
    INSERT INTO sete_passos_auth._migrations(name, checksum) VALUES ('20261014200652_admin_clinical_fichas.sql', '997c23f5ee394543a25f3d4c244ddb30d384e95d67b34dbf263b8c09be04d97e');
  ELSIF previous <> '997c23f5ee394543a25f3d4c244ddb30d384e95d67b34dbf263b8c09be04d97e' THEN
    RAISE EXCEPTION 'Applied migration changed: 20261014200652_admin_clinical_fichas.sql';
  END IF;
END $body$;

DO $body$
DECLARE previous text;
BEGIN
  SELECT checksum INTO previous FROM sete_passos_auth._migrations WHERE name = '202610160001_cpf_identifier.sql';
  IF previous IS NULL THEN
    EXECUTE $migration$ALTER TABLE sete_passos_auth."user" ADD COLUMN cpf text;
ALTER TABLE sete_passos_auth."user" ADD CONSTRAINT user_cpf_digits_check CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
CREATE UNIQUE INDEX user_cpf_unique_idx ON sete_passos_auth."user" (cpf) WHERE cpf IS NOT NULL;
$migration$;
    INSERT INTO sete_passos_auth._migrations(name, checksum) VALUES ('202610160001_cpf_identifier.sql', '57de836ac478c688bced57e884967c2ea197d665df2646c6d2e457aca9b270d9');
  ELSIF previous <> '57de836ac478c688bced57e884967c2ea197d665df2646c6d2e457aca9b270d9' THEN
    RAISE EXCEPTION 'Applied migration changed: 202610160001_cpf_identifier.sql';
  END IF;
END $body$;

COMMIT;

SELECT name, applied_at FROM sete_passos_auth._migrations ORDER BY name;
