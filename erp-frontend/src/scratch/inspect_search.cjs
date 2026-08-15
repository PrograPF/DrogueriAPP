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

async function inspectSearch() {
  const { data: artsData, error } = await supabase
    .from('articulos')
    .select('*')
    .range(0, 9999)
    .order('descripcion');

  console.log('Total artículos cargados en Inventario:', artsData.length);

  const query = '972';
  const filtrados = artsData.filter(art => {
    return (
      art.codigo?.toLowerCase().includes(query) || 
      art.descripcion?.toLowerCase().includes(query)
    );
  });

  console.log('Artículos encontrados con query "972":', filtrados.map(a => ({ codigo: a.codigo, descripcion: a.descripcion })));
}

inspectSearch();
