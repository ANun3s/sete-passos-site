import { randomUUID } from 'node:crypto';

const pgSchema = 'sete_passos_auth';

function isMissingFichaTable(error) {
  return error?.code === '42P01' || (error?.code === 'SQLITE_ERROR' && /no such table: clinical_ficha/u.test(error.message || ''));
}

function parseContent(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.text !== 'string') return { text: '', answers: {} };
  const answers = data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) ? data.answers : {};
  return { text: data.text, answers };
}

export async function listAdminUsers({ db, pool }) {
  const users = pool
    ? (await pool.query(`SELECT id, name, cpf, "createdAt" FROM ${pgSchema}."user" ORDER BY "createdAt" DESC`)).rows
    : db.prepare('SELECT id, name, cpf, createdAt FROM "user" ORDER BY createdAt DESC').all();
  const sessions = pool
    ? (await pool.query(`SELECT "userId", "expiresAt" FROM ${pgSchema}.session WHERE "expiresAt" > $1`, [new Date()])).rows
    : db.prepare('SELECT userId, expiresAt FROM "session" WHERE julianday(expiresAt) > julianday(\'now\')').all();
  const activeCounts = new Map();
  for (const session of sessions) activeCounts.set(session.userId, (activeCounts.get(session.userId) || 0) + 1);

  let fichas = [];
  let fichasStorageAvailable = true;
  try {
    fichas = pool
      ? (await pool.query(`SELECT id, "userId", title, type, content, "createdAt" FROM ${pgSchema}.clinical_ficha ORDER BY "createdAt" DESC`)).rows
      : db.prepare('SELECT id, userId, title, type, content, createdAt FROM clinical_ficha ORDER BY createdAt DESC').all();
  } catch (error) {
    if (!isMissingFichaTable(error)) throw error;
    fichasStorageAvailable = false;
  }

  const byUser = new Map();
  for (const ficha of fichas) {
    const list = byUser.get(ficha.userId) || [];
    const content = parseContent(ficha.content);
    list.push({
      title: ficha.title,
      type: ficha.type,
      content: content.text,
      answers: content.answers,
      createdAt: ficha.createdAt,
    });
    byUser.set(ficha.userId, list);
  }
  return {
    fichasStorageAvailable,
    users: users.map(user => ({
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      createdAt: user.createdAt,
      activeSessions: activeCounts.get(user.id) || 0,
      fichas: byUser.get(user.id) || [],
    })),
  };
}

export async function createAdminFicha({ db, pool, userId, title, type, content, fields = {}, createdBy }) {
  const id = randomUUID();
  const user = pool
    ? (await pool.query(`SELECT id FROM ${pgSchema}."user" WHERE id = $1 LIMIT 1`, [userId])).rows[0]
    : db.prepare('SELECT id FROM "user" WHERE id = ? LIMIT 1').get(userId);
  if (!user) return null;
  // Keep the proposal discriminator in the structured payload because the
  // existing SQLite and PostgreSQL constraints only allow the original types.
  const storageType = type === 'proposta-tratamento' ? 'outro' : type;
  const answers = type === 'proposta-tratamento' ? { ...fields, _formType: type } : fields;
  const serialized = JSON.stringify({ text: content, answers });
  if (pool) {
    const result = await pool.query(
      `INSERT INTO ${pgSchema}.clinical_ficha (id, "userId", "createdBy", title, type, content) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING title, type, content, "createdAt"`,
      [id, user.id, createdBy, title, storageType, serialized],
    );
    const record = result.rows[0];
    const parsed = parseContent(record.content);
    return { title: record.title, type, content: parsed.text, createdAt: record.createdAt };
  }
  db.prepare('INSERT INTO clinical_ficha (id, userId, createdBy, title, type, content) VALUES (?, ?, ?, ?, ?, ?)').run(id, user.id, createdBy, title, storageType, serialized);
  const record = db.prepare('SELECT title, type, content, createdAt FROM clinical_ficha WHERE id = ?').get(id);
  const parsed = parseContent(record.content);
  return { title: record.title, type, content: parsed.text, createdAt: record.createdAt };
}
