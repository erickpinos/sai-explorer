import { neon } from '@neondatabase/serverless';

const queryFn = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

// Wrap neon's tagged template to return { rows } like @vercel/postgres did
export async function sql(strings, ...values) {
  const rows = await queryFn(strings, ...values);
  return { rows };
}
