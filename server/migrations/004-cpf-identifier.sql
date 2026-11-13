ALTER TABLE "user" ADD COLUMN cpf TEXT;
CREATE UNIQUE INDEX user_cpf_unique_idx ON "user" (cpf) WHERE cpf IS NOT NULL;
