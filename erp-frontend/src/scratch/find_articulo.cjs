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

async function findArticulo() {
  const { data, error } = await supabase
    .from('articulos')
    .select('codigo, descripcion')
    .ilike('descripcion', '%ACIDO FOLICO%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Resultados encontrados:', JSON.stringify(data, null, 2));
}

findArticulo();
