const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected directly to PostgreSQL on port 5432!');
    
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
    try { await client.end(); } catch (e) {}
  }
}

main();
