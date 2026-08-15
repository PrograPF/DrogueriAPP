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

async function testNewSearch() {
  console.log('--- Probando carga por bloques de todo el catálogo ---');
  let allArts = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: chunk, error: chunkErr } = await supabase
      .from('articulos')
      .select('*')
      .range(from, from + step - 1)
      .order('descripcion');

    if (chunkErr) throw chunkErr;

    if (chunk && chunk.length > 0) {
      allArts = allArts.concat(chunk);
      from += step;
      if (chunk.length < step) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Total de artículos cargados: ${allArts.length}`);

  const qStock = '972';
  const filtered = allArts
    .filter(art => (
      art.codigo?.toLowerCase().includes(qStock) || 
      art.descripcion?.toLowerCase().includes(qStock)
    ))
    .sort((a, b) => {
      const codeA = (a.codigo || '').toLowerCase().trim();
      const codeB = (b.codigo || '').toLowerCase().trim();
      const descA = (a.descripcion || '').toLowerCase().trim();
      const descB = (b.descripcion || '').toLowerCase().trim();

      if (codeA === qStock && codeB !== qStock) return -1;
      if (codeB === qStock && codeA !== qStock) return 1;

      if (codeA.startsWith(qStock) && !codeB.startsWith(qStock)) return -1;
      if (codeB.startsWith(qStock) && !codeA.startsWith(qStock)) return 1;

      if (descA.startsWith(qStock) && !descB.startsWith(qStock)) return -1;
      if (descB.startsWith(qStock) && !descA.startsWith(qStock)) return 1;

      return 0;
    });

  console.log('Resultados del buscador ordenados:');
  filtered.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [Código: ${item.codigo}] ${item.descripcion}`);
  });
}

testNewSearch();
