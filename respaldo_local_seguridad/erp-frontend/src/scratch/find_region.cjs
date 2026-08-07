const dns = require('dns');
dns.setServers(['8.8.8.8']);
dns.setDefaultResultOrder('ipv4first');

const { Client } = require('pg');

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3'
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.zlvbhkaqlauuhyyvoxlr',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000
  });

  try {
    await client.connect();
    console.log(`SUCCESS: Connected to pooler in region ${region}!`);
    
    // Run the migration since we connected successfully!
    await client.query(`
      ALTER TABLE ordenes_compra_articulos 
      ADD COLUMN IF NOT EXISTS cantidad_recepcionada INTEGER DEFAULT 0;
    `);
    console.log('Successfully ran migration on the successful connection!');
    
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed region ${region}: ${err.message}`);
    try { await client.end(); } catch(e) {}
    return false;
  }
}

async function main() {
  for (const region of regions) {
    const ok = await testRegion(region);
    if (ok) {
      console.log('Migration completed successfully!');
      break;
    }
  }
}

main();
