const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.enbezuxcljmdsmtzqktp:RifxMarketing2026!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function main() {
  console.log('Connecting to PostgreSQL to recreate service_pricing table...');
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('Connected successfully!');
    
    console.log('Dropping existing service_pricing table...');
    await client.query('DROP TABLE IF EXISTS service_pricing CASCADE;');
    console.log('Table dropped.');
    
    console.log('Reading migration SQL...');
    const sqlPath = path.join(__dirname, '..', 'supabase-migration-pricing-guard.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main();
