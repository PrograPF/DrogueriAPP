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
  const regions = ['us-east-1', 'sa-east-1', 'us-east-2', 'us-west-1', 'us-west-2'];
  let client;
  for (const prefix of ['aws-1', 'aws-0']) {
    for (const r of regions) {
      try {
        client = await connect(`${prefix}-${r}.pooler.supabase.com`);
        console.log('Conectado exitosamente a', prefix, r);
        break;
      } catch (e) {
        client = null;
      }
    }
    if (client) break;
  }

  if (!client) {
    console.error('No se pudo conectar a PostgreSQL.');
    process.exit(1);
  }

  try {
    console.log('Aplicando políticas RLS para ordenes_compra_comentarios...');
    await client.query(`
      DROP POLICY IF EXISTS "Permitir actualización de comentarios" ON ordenes_compra_comentarios;
      CREATE POLICY "Permitir actualización de comentarios" ON ordenes_compra_comentarios
        FOR UPDATE USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir eliminación de comentarios" ON ordenes_compra_comentarios;
      CREATE POLICY "Permitir eliminación de comentarios" ON ordenes_compra_comentarios
        FOR DELETE USING (true);
    `);

    console.log('Aplicando políticas RLS para articulos_variantes_comentarios...');
    await client.query(`
      DROP POLICY IF EXISTS "Permitir actualización pública de comentarios de variantes" ON articulos_variantes_comentarios;
      CREATE POLICY "Permitir actualización pública de comentarios de variantes" ON articulos_variantes_comentarios
        FOR UPDATE USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir eliminación pública de comentarios de variantes" ON articulos_variantes_comentarios;
      CREATE POLICY "Permitir eliminación pública de comentarios de variantes" ON articulos_variantes_comentarios
        FOR DELETE USING (true);
    `);

    console.log('Políticas RLS aplicadas con éxito!');

    // Verificar las políticas actuales
    const res = await client.query(`
      SELECT tablename, policyname, cmd, roles 
      FROM pg_policies 
      WHERE tablename IN ('ordenes_compra_comentarios', 'articulos_variantes_comentarios');
    `);
    console.log('Políticas vigentes:', res.rows);

  } catch (err) {
    console.error('Error aplicando políticas:', err);
  } finally {
    await client.end();
  }
}

run();
