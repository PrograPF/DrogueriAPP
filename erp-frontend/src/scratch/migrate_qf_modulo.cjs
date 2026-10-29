const { Client } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');

async function getClient() {
  const regions = ['sa-east-1', 'us-west-2', 'us-east-1', 'us-east-2', 'us-west-1'];
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const r of regions) {
      try {
        const client = new Client({
          host: `${prefix}-${r}.pooler.supabase.com`,
          port: 6543,
          database: 'postgres',
          user: 'postgres.zlvbhkaqlauuhyyvoxlr',
          password: 'k4A0q4aqVLb4OIFU',
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000
        });
        await client.connect();
        console.log(`Conectado exitosamente a PostgreSQL (${prefix}-${r})!`);
        return client;
      } catch (e) {
        // try next
      }
    }
  }
  throw new Error('No se pudo conectar a PostgreSQL en ningún host.');
}

async function run() {
  const client = await getClient();

  try {
    console.log('--- Creando tablas para el submódulo QF ---');

    await client.query(`
      -- 1. Tabla de Categorías
      CREATE TABLE IF NOT EXISTS qf_categorias_tareas (
        codigo VARCHAR(10) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT,
        color VARCHAR(30) NOT NULL,
        color_bg VARCHAR(50) NOT NULL,
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Tabla Plantilla Maestra de Tareas QF
      CREATE TABLE IF NOT EXISTS qf_tareas_plantilla (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        semana INT NOT NULL, -- 1 a 5, o 0 para tareas que aplican todas las semanas
        dia_semana INT, -- 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, NULL=Todos los días
        bloque VARCHAR(20) NOT NULL, -- 'AM', 'PM', 'DIARIO', 'PERIODICA'
        categoria_codigo VARCHAR(10) REFERENCES qf_categorias_tareas(codigo) ON UPDATE CASCADE ON DELETE SET NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        origen VARCHAR(50) DEFAULT 'Original',
        registro_evidencia TEXT,
        normativa_ref TEXT,
        es_periodica BOOLEAN DEFAULT false,
        frecuencia VARCHAR(50), -- 'Semestral', 'Anual', 'Trimestral', 'Mensual'
        meses_aplicables INT[], -- Array con números de meses (1..12)
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 3. Tabla de Registro Mensual (Historial y ejecución desde Octubre 2026)
      CREATE TABLE IF NOT EXISTS qf_tareas_registro_mensual (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plantilla_id UUID REFERENCES qf_tareas_plantilla(id) ON DELETE SET NULL,
        anio INT NOT NULL,
        mes INT NOT NULL, -- 1 a 12
        semana_mes INT NOT NULL, -- 1 a 5
        dia_semana INT, -- 1=Lunes..5=Viernes, NULL=Diario/Periódica
        fecha_programada DATE,
        bloque VARCHAR(20) NOT NULL, -- 'AM', 'PM', 'DIARIO', 'PERIODICA'
        categoria_codigo VARCHAR(10),
        titulo TEXT NOT NULL,
        descripcion TEXT,
        registro_evidencia TEXT,
        normativa_ref TEXT,
        estado VARCHAR(20) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'REALIZADA', 'NO_APLICA'
        realizado_por TEXT,
        fecha_realizacion TIMESTAMPTZ,
        comentario TEXT,
        es_periodica BOOLEAN DEFAULT false,
        orden INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Índices para búsquedas rápidas
      CREATE INDEX IF NOT EXISTS idx_qf_registro_anio_mes ON qf_tareas_registro_mensual(anio, mes);
      CREATE INDEX IF NOT EXISTS idx_qf_registro_semana ON qf_tareas_registro_mensual(anio, mes, semana_mes);
      CREATE INDEX IF NOT EXISTS idx_qf_plantilla_semana ON qf_tareas_plantilla(semana, bloque);

      -- Habilitar RLS y políticas permisivas para DrogueriAPP
      ALTER TABLE qf_categorias_tareas ENABLE ROW LEVEL SECURITY;
      ALTER TABLE qf_tareas_plantilla ENABLE ROW LEVEL SECURITY;
      ALTER TABLE qf_tareas_registro_mensual ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Permitir todo qf_categorias_tareas" ON qf_categorias_tareas;
      CREATE POLICY "Permitir todo qf_categorias_tareas" ON qf_categorias_tareas FOR ALL USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir todo qf_tareas_plantilla" ON qf_tareas_plantilla;
      CREATE POLICY "Permitir todo qf_tareas_plantilla" ON qf_tareas_plantilla FOR ALL USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir todo qf_tareas_registro_mensual" ON qf_tareas_registro_mensual;
      CREATE POLICY "Permitir todo qf_tareas_registro_mensual" ON qf_tareas_registro_mensual FOR ALL USING (true) WITH CHECK (true);
    `);

    console.log('Tablas y políticas creadas exitosamente.');

    // 2. Insertar categorías
    console.log('Insertando categorías de tareas...');
    const categorias = [
      { codigo: 'REC', nombre: 'Recepción, pedidos y distribución', color: '#0284c7', color_bg: 'rgba(2, 132, 199, 0.15)', orden: 1 },
      { codigo: 'TEM', nombre: 'Temperatura y humedad (T° y HR)', color: '#0d9488', color_bg: 'rgba(13, 148, 136, 0.15)', orden: 2 },
      { codigo: 'INV', nombre: 'Inventario y vencimientos', color: '#ea580c', color_bg: 'rgba(234, 88, 12, 0.15)', orden: 3 },
      { codigo: 'CTR', nombre: 'Estupefacientes y psicotrópicos', color: '#7c3aed', color_bg: 'rgba(124, 58, 237, 0.15)', orden: 4 },
      { codigo: 'CAL', nombre: 'Calidad / BPAD / procedimientos', color: '#2563eb', color_bg: 'rgba(37, 99, 235, 0.15)', orden: 5 },
      { codigo: 'REG', nombre: 'Farmacovigilancia y autoridad sanitaria', color: '#e11d48', color_bg: 'rgba(225, 29, 72, 0.15)', orden: 6 },
      { codigo: 'ADM', nombre: 'Administrativo y finanzas', color: '#4b5563', color_bg: 'rgba(75, 85, 99, 0.15)', orden: 7 },
      { codigo: 'EQP', nombre: 'Equipo, coordinación y capacitación', color: '#059669', color_bg: 'rgba(5, 150, 105, 0.15)', orden: 8 }
    ];

    for (const cat of categorias) {
      await client.query(`
        INSERT INTO qf_categorias_tareas (codigo, nombre, color, color_bg, orden, activo)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (codigo) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          color = EXCLUDED.color,
          color_bg = EXCLUDED.color_bg,
          orden = EXCLUDED.orden;
      `, [cat.codigo, cat.nombre, cat.color, cat.color_bg, cat.orden]);
    }
    console.log('Categorías listas.');

    // 3. Leer tareas desde el archivo Excel
    console.log('Leyendo tareas maestras desde el Excel...');
    const filePath = path.join(__dirname, '../../../TAREAS_QF_DROGUERÍA_ACTUAL.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Leer Detalle de tareas si existe para evidencia y normativa
    const detalleMap = new Map();
    const wsDetalle = workbook.getWorksheet('Detalle de tareas');
    if (wsDetalle) {
      for (let r = 5; r <= wsDetalle.rowCount; r++) {
        const row = wsDetalle.getRow(r);
        const tareaTxt = row.getCell(6).value ? String(row.getCell(6).value).trim() : '';
        if (tareaTxt) {
          detalleMap.set(tareaTxt.toLowerCase(), {
            origen: row.getCell(7).value ? String(row.getCell(7).value).trim() : 'Original',
            evidencia: row.getCell(8).value ? String(row.getCell(8).value).trim() : '',
            normativa: row.getCell(9).value ? String(row.getCell(9).value).trim() : ''
          });
        }
      }
    }

    // Helper para extraer código y texto limpio
    function parseTareaStr(raw) {
      if (!raw) return { codigo: null, titulo: '' };
      const str = String(raw).trim();
      const match = str.match(/^([A-Z]{3})\s*·\s*(.*)$/);
      if (match) {
        return { codigo: match[1], titulo: match[2].trim() };
      }
      return { codigo: null, titulo: str };
    }

    // Leer Plan Semanal (Semanas 1 a 4)
    const wsPlan = workbook.getWorksheet('Plan semanal');
    const tareasPlantilla = [];

    const weekConfigs = [
      { semana: 1, startRow: 4, label: 'RECEPCIÓN CENABAST / CRÍTICOS Y PE LISTOS' },
      { semana: 2, startRow: 10, label: 'GESTIÓN SANITARIA: CONTROLADOS, VENCIMIENTOS Y FARMACOVIGILANCIA' },
      { semana: 3, startRow: 16, label: 'CALIDAD, INVENTARIO Y PLANIFICACIÓN DE RECEPCIÓN' },
      { semana: 4, startRow: 22, label: 'RECEPCIÓN DE CENABAST' }
    ];

    for (const wc of weekConfigs) {
      // Fila Todos los días: startRow + 2
      const rowDiario = wsPlan.getRow(wc.startRow + 2);
      const valDiario = rowDiario.getCell(3).value;
      if (valDiario) {
        const strDiario = String(valDiario).trim();
        // Puede tener múltiples tareas separadas por '·'
        tareasPlantilla.push({
          semana: wc.semana,
          dia_semana: null,
          bloque: 'DIARIO',
          categoria_codigo: 'TEM', // T° y HR
          titulo: strDiario,
          descripcion: `Tarea diaria de la Semana ${wc.semana}`,
          orden: 1
        });
      }

      // Fila AM: startRow + 3 (C3=Lun, C4=Mar, C5=Mie, C6=Jue, C7=Vie)
      const rowAM = wsPlan.getRow(wc.startRow + 3);
      for (let day = 1; day <= 5; day++) {
        const cellVal = rowAM.getCell(day + 2).value;
        if (cellVal) {
          const { codigo, titulo } = parseTareaStr(cellVal);
          tareasPlantilla.push({
            semana: wc.semana,
            dia_semana: day,
            bloque: 'AM',
            categoria_codigo: codigo,
            titulo: titulo,
            descripcion: null,
            orden: 2
          });
        }
      }

      // Fila PM: startRow + 4 (C3=Lun, C4=Mar, C5=Mie, C6=Jue, C7=Vie)
      const rowPM = wsPlan.getRow(wc.startRow + 4);
      for (let day = 1; day <= 5; day++) {
        const cellVal = rowPM.getCell(day + 2).value;
        if (cellVal) {
          const { codigo, titulo } = parseTareaStr(cellVal);
          tareasPlantilla.push({
            semana: wc.semana,
            dia_semana: day,
            bloque: 'PM',
            categoria_codigo: codigo,
            titulo: titulo,
            descripcion: null,
            orden: 3
          });
        }
      }
    }

    // Leer Tareas Periódicas (Hoja 3: Periódicas)
    const wsPeriodicas = workbook.getWorksheet('Periódicas');
    if (wsPeriodicas) {
      for (let r = 5; r <= wsPeriodicas.rowCount; r++) {
        const row = wsPeriodicas.getRow(r);
        const cod = row.getCell(1).value ? String(row.getCell(1).value).trim() : null;
        const tarea = row.getCell(2).value ? String(row.getCell(2).value).trim() : null;
        const freq = row.getCell(3).value ? String(row.getCell(3).value).trim() : 'Periódica';
        if (tarea) {
          const meses = [];
          for (let m = 1; m <= 12; m++) {
            const mVal = row.getCell(m + 3).value;
            if (mVal && String(mVal).trim().toUpperCase() === 'X') {
              meses.push(m);
            }
          }

          tareasPlantilla.push({
            semana: 0, // General periódica
            dia_semana: null,
            bloque: 'PERIODICA',
            categoria_codigo: cod,
            titulo: tarea,
            descripcion: `Frecuencia: ${freq}`,
            es_periodica: true,
            frecuencia: freq,
            meses_aplicables: meses,
            orden: 10
          });
        }
      }
    }

    console.log(`Cargando ${tareasPlantilla.length} tareas a la plantilla maestra (qf_tareas_plantilla)...`);
    // Limpiar plantilla si ya existía para sincronización inicial limpia
    await client.query('DELETE FROM qf_tareas_plantilla');

    for (const t of tareasPlantilla) {
      // Buscar detalle
      let evidencia = '';
      let normativa = '';
      let origen = 'Original';

      for (const [key, val] of detalleMap.entries()) {
        if (t.titulo.toLowerCase().includes(key) || key.includes(t.titulo.toLowerCase())) {
          evidencia = val.evidencia;
          normativa = val.normativa;
          origen = val.origen;
          break;
        }
      }

      await client.query(`
        INSERT INTO qf_tareas_plantilla (
          semana, dia_semana, bloque, categoria_codigo, titulo, descripcion,
          origen, registro_evidencia, normativa_ref, es_periodica, frecuencia,
          meses_aplicables, orden, activo
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true
        );
      `, [
        t.semana,
        t.dia_semana,
        t.bloque,
        t.categoria_codigo,
        t.titulo,
        t.descripcion,
        origen,
        evidencia,
        normativa,
        t.es_periodica || false,
        t.frecuencia || null,
        t.meses_aplicables || null,
        t.orden || 0
      ]);
    }

    console.log('Plantilla maestra cargada exitosamente.');

    // 4. Función generadora de registros para un mes específico
    async function generarMes(anio, mes) {
      console.log(`Generando calendario mensual para ${anio}-${mes}...`);
      
      // Obtener plantilla activa
      const plantillasRes = await client.query(`
        SELECT * FROM qf_tareas_plantilla WHERE activo = true ORDER BY semana, dia_semana, orden
      `);
      const plantillas = plantillasRes.rows;

      // Calcular semanas del mes
      // Regla de negocio: Semana 1 comienza el 1er día del mes
      const primerDia = new Date(anio, mes - 1, 1);
      const ultimoDia = new Date(anio, mes, 0); // último día del mes
      const totalDias = ultimoDia.getDate();

      // Mapear días a semanas (bloques de 7 días o semanas lun-vie)
      // En Droguería, semana 1 = primeros 7 días o días correspondientes
      // Calculamos la fecha de lunes a viernes para cada una de las 4 o 5 semanas
      const registros = [];

      // Encontrar el lunes de la semana del 1ro de mes o el día 1
      let currentDay = new Date(primerDia);
      // Avanzar día por día del mes
      while (currentDay <= ultimoDia) {
        const diaNum = currentDay.getDate();
        const diaSemanaJs = currentDay.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
        
        // Solo lunes a viernes (1 a 5)
        if (diaSemanaJs >= 1 && diaSemanaJs <= 5) {
          // Determinar qué número de semana corresponde (Semana 1..5)
          // Semana 1: días 1 a 7 aprox, semana 2: 8 a 14, etc., o cálculo por lunes
          let semanaMes = Math.floor((diaNum - 1) / 7) + 1;
          if (semanaMes > 4) semanaMes = 4; // Por defecto el plan tiene 4 semanas maestras, semana 5 repite semana 4 o 1

          const fechaIso = currentDay.toISOString().split('T')[0];

          // Filtrar tareas de la plantilla para esta semana y día
          const tareasDia = plantillas.filter(p => !p.es_periodica && p.semana === semanaMes && (p.dia_semana === diaSemanaJs || p.dia_semana === null));

          for (const t of tareasDia) {
            registros.push({
              plantilla_id: t.id,
              anio,
              mes,
              semana_mes: semanaMes,
              dia_semana: diaSemanaJs,
              fecha_programada: fechaIso,
              bloque: t.bloque,
              categoria_codigo: t.categoria_codigo,
              titulo: t.titulo,
              descripcion: t.descripcion,
              registro_evidencia: t.registro_evidencia,
              normativa_ref: t.normativa_ref,
              es_periodica: false,
              orden: t.orden
            });
          }
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }

      // Agregar tareas periódicas que apliquen a este mes
      const tareasPeriodicas = plantillas.filter(p => p.es_periodica && p.meses_aplicables && p.meses_aplicables.includes(mes));
      for (const tp of tareasPeriodicas) {
        registros.push({
          plantilla_id: tp.id,
          anio,
          mes,
          semana_mes: 1, // Se ubican en la vista del mes
          dia_semana: null,
          fecha_programada: `${anio}-${String(mes).padStart(2, '0')}-01`,
          bloque: 'PERIODICA',
          categoria_codigo: tp.categoria_codigo,
          titulo: tp.titulo,
          descripcion: tp.descripcion,
          registro_evidencia: tp.registro_evidencia,
          normativa_ref: tp.normativa_ref,
          es_periodica: true,
          orden: tp.orden
        });
      }

      console.log(`Insertando ${registros.length} registros mensuales para ${anio}-${mes}...`);
      for (const r of registros) {
        await client.query(`
          INSERT INTO qf_tareas_registro_mensual (
            plantilla_id, anio, mes, semana_mes, dia_semana, fecha_programada,
            bloque, categoria_codigo, titulo, descripcion, registro_evidencia,
            normativa_ref, estado, es_periodica, orden
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDIENTE', $13, $14
          );
        `, [
          r.plantilla_id,
          r.anio,
          r.mes,
          r.semana_mes,
          r.dia_semana,
          r.fecha_programada,
          r.bloque,
          r.categoria_codigo,
          r.titulo,
          r.descripcion,
          r.registro_evidencia,
          r.normativa_ref,
          r.es_periodica,
          r.orden
        ]);
      }
      console.log(`Mes ${anio}-${mes} generado con éxito.`);
    }

    // Limpiar y generar Octubre y Noviembre 2026
    await client.query('DELETE FROM qf_tareas_registro_mensual');
    await generarMes(2026, 10);
    await generarMes(2026, 11);

    console.log('=== Migración y carga inicial finalizada con éxito ===');
  } catch (err) {
    console.error('Error durante la migración:', err);
  } finally {
    await client.end();
  }
}

run();
