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
  if (!client) { console.error('No se pudo conectar a ningún pooler.'); process.exitCode = 1; return; }
  try {
    await client.query(`
      ALTER TABLE solicitudes_compra
        ADD COLUMN IF NOT EXISTS tipo_oc TEXT DEFAULT 'AG',
        ADD COLUMN IF NOT EXISTS fecha_tope_aceptacion DATE,
        ADD COLUMN IF NOT EXISTS fecha_tope_entrega DATE,
        ADD COLUMN IF NOT EXISTS fecha_tope_multa DATE;
    `);
    await client.query(`
      ALTER TABLE ordenes_compra
        ADD COLUMN IF NOT EXISTS fecha_tope_aceptacion DATE,
        ADD COLUMN IF NOT EXISTS fecha_tope_entrega DATE,
        ADD COLUMN IF NOT EXISTS fecha_tope_multa DATE;
    `);
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    const res = await client.query(`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_name IN ('solicitudes_compra','ordenes_compra')
        AND (column_name LIKE 'fecha_tope%' OR column_name = 'tipo_oc')
      ORDER BY table_name, column_name;
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
