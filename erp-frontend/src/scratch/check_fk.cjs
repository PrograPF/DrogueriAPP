const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) env[key] = valParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkArticulos() {
  const { data: arts } = await supabase.from('articulos').select('codigo, descripcion').limit(5);
  console.log('Articulos sample:', arts);

  const { data: vars } = await supabase.from('articulos_variantes').select('codigo_articulo, lote, cantidad').limit(5);
  console.log('Variantes sample:', vars);
}

checkArticulos();
