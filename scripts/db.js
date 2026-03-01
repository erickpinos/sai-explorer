import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Helper function to execute SQL queries
export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

// Helper function to execute a query and return rows
export async function sql(strings, ...values) {
  // Convert template literal to parameterized query
  let text = '';
  const params = [];
  
  strings.forEach((string, i) => {
    text += string;
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  });
  
  const result = await pool.query(text, params);
  return result.rows;
}

export { pool };
