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

async function checkColumns() {
  const { data: oc } = await supabase.from('ordenes_compra').select('*').limit(1);
  console.log('Columnas de ordenes_compra:', oc ? Object.keys(oc[0]) : 'Sin datos');

  const { data: ocArts } = await supabase.from('ordenes_compra_articulos').select('*').limit(1);
  console.log('Columnas de ordenes_compra_articulos:', ocArts ? Object.keys(ocArts[0]) : 'Sin datos');

  const { data: revs } = await supabase.from('revisiones_bodega').select('*').limit(1);
  console.log('Columnas de revisiones_bodega:', revs ? Object.keys(revs[0]) : 'Sin datos');
}

checkColumns();
