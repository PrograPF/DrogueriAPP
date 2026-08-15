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

async function check972() {
  console.log('--- Buscando código exacto 972 o similar ---');
  const { data: exact, error: err1 } = await supabase
    .from('articulos')
    .select('*')
    .or('codigo.eq.972,codigo.eq.0972,codigo.eq.00972,codigo.ilike.%972%');

  console.log('Resultados en articulos:', exact);

  const { data: vars, error: err2 } = await supabase
    .from('articulos_variantes')
    .select('*')
    .or('codigo_articulo.eq.972,codigo_articulo.ilike.%972%');

  console.log('Resultados en articulos_variantes:', vars);
}

check972();
