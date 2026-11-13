CREATE TABLE clinical_ficha (
  id TEXT NOT NULL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  createdBy TEXT REFERENCES "user" (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  type TEXT NOT NULL CHECK (type IN ('avaliacao-fisioterapeutica', 'proposta-tratamento', 'outro')),
  content TEXT NOT NULL CHECK (json_valid(content)),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX clinical_ficha_user_created_idx ON clinical_ficha (userId, createdAt DESC);
