const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.zlvbhkaqlauuhyyvoxlr',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    // Add a JSONB column to store state change history: an array of objects
    // each containing: { estado, fecha_almacenamiento }
    await client.query(`
      ALTER TABLE ordenes_compra_articulos 
      ADD COLUMN IF NOT EXISTS historial JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Added column "historial" successfully!');

    // Let's query columns to verify
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ordenes_compra_articulos';
    `);
    console.log('Current columns in ordenes_compra_articulos:', res.rows);

  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

run();
