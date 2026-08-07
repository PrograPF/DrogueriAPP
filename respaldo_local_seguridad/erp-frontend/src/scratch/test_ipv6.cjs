const { Client } = require('pg');

async function main() {
  console.log('Connecting directly to raw IPv6 address...');
  const client = new Client({
    host: '2600:1f18:16e0:2801:eb73:dd4e:3523:291b',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('SUCCESS: Connected to PostgreSQL using raw IPv6!');
    const res = await client.query('SELECT version();');
    console.log('Version:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('IPv6 Connection failed:', err.message);
    try { await client.end(); } catch (e) {}
  }
}

main();
