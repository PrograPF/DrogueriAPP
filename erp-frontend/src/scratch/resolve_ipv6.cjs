const dns = require('dns');
dns.setServers(['8.8.8.8']);

const { Client } = require('pg');

async function main() {
  // Resolve AAAA record
  dns.resolve6('db.zlvbhkaqlauuhyyvoxlr.supabase.co', async (err, addresses) => {
    if (err) {
      console.error('Error resolving IPv6:', err);
      return;
    }
    
    const ipv6Address = addresses[0];
    console.log('Resolved IPv6 Address:', ipv6Address);
    
    // Connect using pg
    const client = new Client({
      host: ipv6Address,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'k4A0q4aqVLb4OIFU',
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client.connect();
      console.log('Connected directly to PostgreSQL via IPv6!');
      
      await client.query(`
        ALTER TABLE ordenes_compra_articulos 
        ADD COLUMN IF NOT EXISTS cantidad_recepcionada INTEGER DEFAULT 0;
      `);
      console.log('Successfully ran migration via IPv6!');
      
      await client.end();
    } catch (connectErr) {
      console.error('Connection error:', connectErr);
    }
  });
}

main();
