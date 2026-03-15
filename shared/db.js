import { neon } from '@neondatabase/serverless';

let _sql;

if (process.env.VERCEL) {
  // Production: Neon serverless
  const queryFn = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  _sql = async (strings, ...values) => {
    const rows = await queryFn(strings, ...values);
    return { rows };
  };
} else {
  // Local: pg Pool with lazy init so dotenv is loaded before pool creation
  const { default: pkg } = await import('pg');
  const { Pool } = pkg;
  let _pool = null;
  const getPool = () => {
    if (!_pool) {
      _pool = new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    return _pool;
  };
  _sql = async (strings, ...values) => {
    let text = '';
    const params = [];
    strings.forEach((str, i) => {
      text += str;
      if (i < values.length) { params.push(values[i]); text += `$${params.length}`; }
    });
    const result = await getPool().query(text, params);
    return { rows: result.rows };
  };
}

export const sql = _sql;
