const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.zlvbhkaqlauuhyyvoxlr',
  password: 'k4A0q4aqVLb4OIFU',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL!');
  
  try {
    // 1. Add columns to ordenes_compra_articulos
    await client.query(`
      ALTER TABLE ordenes_compra_articulos 
      ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Pendiente',
      ADD COLUMN IF NOT EXISTS fecha_almacenamiento TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('Columns added/checked successfully!');
    
    // 2. Fetch table details to verify
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ordenes_compra_articulos';
    `);
    console.log('Columns in ordenes_compra_articulos:', res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
