const { Client } = require('pg');

const client = new Client({
  host: '44.238.118.41',
  port: 6543,
  database: 'postgres',
  user: 'postgres.zlvbhkaqlauuhyyvoxlr',
  password: 'k4A0q4aqVLb4OIFU',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL database pooler via IPv4 (Oregon)!');
  
  try {
    // Add column if it doesn't exist
    await client.query(`
      ALTER TABLE ordenes_compra_articulos 
      ADD COLUMN IF NOT EXISTS cantidad_recepcionada INTEGER DEFAULT 0;
    `);
    console.log('Successfully added cantidad_recepcionada column to ordenes_compra_articulos!');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await client.end();
  }
}

main();
