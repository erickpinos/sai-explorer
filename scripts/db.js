import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a pool for local Postgres
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
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
