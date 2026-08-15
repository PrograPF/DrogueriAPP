const dns = require('dns');
dns.setServers(['8.8.8.8']);
dns.setDefaultResultOrder('ipv4first');

const { Client } = require('pg');

const regions = [
  'sa-east-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
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

async function testAndMigrate(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.zlvbhkaqlauuhyyvoxlr',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000
  });

  try {
    await client.connect();
    console.log(`SUCCESS: Connected to pooler in region ${region}!`);
    
    // Add historial_cambios JSONB column
    await client.query(`
      ALTER TABLE ordenes_compra_articulos 
      ADD COLUMN IF NOT EXISTS historial_cambios JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Successfully added historial_cambios column!');
    
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ordenes_compra_articulos';
    `);
    console.log('Columns now:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
    
    await client.end();
    return true;
  } catch (err) {
    try { await client.end(); } catch(e) {}
    return false;
  }
}

async function main() {
  for (const region of regions) {
    const ok = await testAndMigrate(region);
    if (ok) {
      console.log('Migration completed successfully in region:', region);
      return;
    }
  }
  console.log('Could not connect to any pooler directly.');
}

main();
