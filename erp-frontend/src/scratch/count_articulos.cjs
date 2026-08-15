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

async function checkTotalArticulos() {
  const { count, error } = await supabase
    .from('articulos')
    .select('*', { count: 'exact', head: true });

  console.log('Total real de artículos en la tabla articulos:', count);
}

checkTotalArticulos();
