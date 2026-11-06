const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase
    .from('solicitudes_compra')
    .select('id, numero_solicitud, plazo_aceptacion_dias, plazo_entrega_dias, tipo_plazo_entrega')
    .limit(3);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Resultados desde Supabase en vivo:');
    console.table(data);
  }
}
run();

