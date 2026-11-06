const { Client } = require('pg');

async function connect(host) {
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.zlvbhkaqlauuhyyvoxlr',
    password: 'k4A0q4aqVLb4OIFU',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

async function run() {
  const regions = ['sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2','ca-central-1','eu-west-1','eu-west-2','eu-central-1','ap-south-1','ap-southeast-1','ap-southeast-2','ap-northeast-1'];
  let client;
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const r of regions) {
      try {
        client = await connect(`${prefix}-${r}.pooler.supabase.com`);
        console.log('Conectado a', prefix, r);
        break;
      } catch (e) { client = null; }
    }
    if (client) break;
  }
  if (!client) {
    console.error('No se pudo conectar a ningún pooler.');
    process.exitCode = 1;
    return;
  }

  try {
    console.log('Aplicando columnas a ordenes_compra...');
    await client.query(`
      ALTER TABLE ordenes_compra
        ADD COLUMN IF NOT EXISTS plazo_aceptacion_dias INTEGER,
        ADD COLUMN IF NOT EXISTS plazo_entrega_dias INTEGER,
        ADD COLUMN IF NOT EXISTS tipo_plazo_entrega TEXT;
    `);

    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Schema reloaded successfully.');

    const res = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ordenes_compra'
        AND column_name IN ('plazo_aceptacion_dias', 'plazo_entrega_dias', 'tipo_plazo_entrega')
      ORDER BY column_name;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error('Error en migración:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();

