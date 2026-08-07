require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function test(port) {
  const client = new Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: port,
    database: 'postgres',
    user: 'postgres.zlvbhkaqlauuhyyvoxlr',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Connected successfully to Oregon pooler on port ${port}!`);
    await client.end();
  } catch (err) {
    console.log(`Failed Oregon pooler on port ${port}:`, err.message);
    try { await client.end(); } catch (e) {}
  }
}

async function main() {
  await test(5432);
  await test(6543);
}

main();
