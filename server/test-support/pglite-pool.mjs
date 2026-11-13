export function memoryPool(pg) {
  const client = {
    query: async (sql, params) => {
      const result = params?.length ? await pg.query(sql, params) : (await pg.exec(sql)).at(-1);
      return { ...result, command: sql.trim().split(/\s/)[0].toUpperCase(), rowCount: result.affectedRows || 0 };
    },
    release() {}, on() {}, off() {}, removeListener() {},
  };
  return { connect: async () => client, end: async () => pg.close() };
}

