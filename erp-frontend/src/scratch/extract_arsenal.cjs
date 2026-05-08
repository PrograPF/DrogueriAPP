const fs = require('fs');

const csvPath = 'c:/Users/Pablo/Desktop/PENDIENTES PEDIDOS CESFAM/arsenal.csv';
const outputPath = 'c:/Users/Pablo/Desktop/PENDIENTES PEDIDOS CESFAM/erp-frontend/src/modules/arsenal.json';

try {
    const buffer = fs.readFileSync(csvPath);
    let content;
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf8');
    }

    const lines = content.split('\n');
    const headerRow = lines[0].split(',');
    
    // Improved column detection
    const codeIdx = headerRow.findIndex(h => h.toLowerCase().includes('c') && h.toLowerCase().includes('digo'));
    const nameIdx = headerRow.findIndex(h => h.toLowerCase().includes('art') && h.toLowerCase().includes('culo'));

    console.log(`Detected columns: Code=${codeIdx}, Name=${nameIdx}`);

    const arsenal = {};
    
    // Robust CSV parsing for simple cases (one level of quotes)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let columns = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                columns.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        columns.push(current);

        if (columns.length > Math.max(codeIdx, nameIdx)) {
            let code = columns[codeIdx].replace(/"/g, '').trim();
            let name = columns[nameIdx].replace(/"/g, '').trim();
            
            if (code && name && !isNaN(code)) {
                arsenal[code] = name;
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(arsenal, null, 2));
    console.log(`Successfully extracted ${Object.keys(arsenal).length} items.`);

} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
