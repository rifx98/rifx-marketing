const { Client } = require('pg');

const connectionString = 'postgresql://postgres:RifxMarketing2026!@db.enbezuxcljmdsmtzqktp.supabase.co:5432/postgres';

async function main() {
  console.log('Testing direct connection to Supabase DB...');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await client.end();
  }
}

main();
