const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) {
    env[key] = valParts.join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(`
      id,
      numero_oc,
      proveedor,
      estado,
      estado_recepcion,
      ordenes_compra_articulos (
        id,
        codigo_articulo,
        cantidad,
        estado_recepcion
      )
    `);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- ORDENES DE COMPRA EN BASE DE DATOS ---');
  console.log(JSON.stringify(data, null, 2));
}

main();
