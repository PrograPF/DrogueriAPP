const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valParts] = line.trim().split('=');
  if (key) {
    env[key] = valParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('ordenes_compra_articulos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log('Columns found in record:', data[0] ? Object.keys(data[0]) : 'No records found');
  if (data[0]) {
    console.log('Sample record:', data[0]);
  }
}

main();
