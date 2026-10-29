import { supabase } from '../../../supabaseClient';

/**
 * Servicio para gestión de Tareas QF y Calendario
 */
export const qfService = {
  // 1. Obtener todas las categorías activas
  async getCategorias() {
    const { data, error } = await supabase
      .from('qf_categorias_tareas')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // 2. Obtener registros de un mes específico (o generarlo si no existe)
  async getTareasMes(anio, mes) {
    // Verificar si ya existen registros para este año y mes
    const { data: existentes, error: errorCheck } = await supabase
      .from('qf_tareas_registro_mensual')
      .select('*')
      .eq('anio', anio)
      .eq('mes', mes)
      .order('semana_mes', { ascending: true })
      .order('dia_semana', { ascending: true, nullsFirst: false })
      .order('orden', { ascending: true });

    if (errorCheck) throw errorCheck;

    if (existentes && existentes.length > 0) {
      return existentes;
    }

    // Si no existen y es de Octubre 2026 en adelante, generarlo automáticamente
    if (anio > 2026 || (anio === 2026 && mes >= 10)) {
      return await this.generarMesAutomatico(anio, mes);
    }

    return [];
  },

  // 3. Generar automáticamente un mes nuevo a partir de la plantilla maestra
  async generarMesAutomatico(anio, mes) {
    const { data: plantillas, error: errorP } = await supabase
      .from('qf_tareas_plantilla')
      .select('*')
      .eq('activo', true)
      .order('semana', { ascending: true })
      .order('dia_semana', { ascending: true })
      .order('orden', { ascending: true });

    if (errorP) throw errorP;
    if (!plantillas || plantillas.length === 0) return [];

    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const registros = [];

    let currentDay = new Date(primerDia);
    while (currentDay <= ultimoDia) {
      const diaNum = currentDay.getDate();
      const diaSemanaJs = currentDay.getDay(); // 1=Lun..5=Vie
      
      if (diaSemanaJs >= 1 && diaSemanaJs <= 5) {
        // Semana del mes calculada desde el día 1
        let semanaMes = Math.floor((diaNum - 1) / 7) + 1;
        if (semanaMes > 4) semanaMes = 4; // 4 semanas base del plan

        const fechaIso = currentDay.toISOString().split('T')[0];

        const tareasDia = plantillas.filter(p => 
          !p.es_periodica && 
          p.semana === semanaMes && 
          (p.dia_semana === diaSemanaJs || p.dia_semana === null)
        );

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
            estado: 'PENDIENTE',
            es_periodica: false,
            orden: t.orden
          });
        }
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Tareas periódicas del mes
    const tareasPeriodicas = plantillas.filter(p => 
      p.es_periodica && 
      p.meses_aplicables && 
      p.meses_aplicables.includes(mes)
    );

    for (const tp of tareasPeriodicas) {
      registros.push({
        plantilla_id: tp.id,
        anio,
        mes,
        semana_mes: 1,
        dia_semana: null,
        fecha_programada: `${anio}-${String(mes).padStart(2, '0')}-01`,
        bloque: 'PERIODICA',
        categoria_codigo: tp.categoria_codigo,
        titulo: tp.titulo,
        descripcion: tp.descripcion,
        registro_evidencia: tp.registro_evidencia,
        normativa_ref: tp.normativa_ref,
        estado: 'PENDIENTE',
        es_periodica: true,
        orden: tp.orden
      });
    }

    if (registros.length > 0) {
      const { data: insertados, error: errorInsert } = await supabase
        .from('qf_tareas_registro_mensual')
        .insert(registros)
        .select('*');

      if (errorInsert) throw errorInsert;
      return insertados || [];
    }

    return [];
  },

  // 4. Actualizar estado y comentario de una tarea mensual
  async updateTareaRegistro(id, updates) {
    const { data, error } = await supabase
      .from('qf_tareas_registro_mensual')
      .update({
        estado: updates.estado,
        realizado_por: updates.realizado_por,
        fecha_realizacion: updates.estado === 'REALIZADA' ? (updates.fecha_realizacion || new Date().toISOString()) : null,
        comentario: updates.comentario,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // 5. Agregar una tarea directa al mes activo
  async addTareaMesDirecta(tareaData) {
    const { data, error } = await supabase
      .from('qf_tareas_registro_mensual')
      .insert([tareaData])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // 6. Eliminar una tarea de un mes específico
  async deleteTareaMes(id) {
    const { error } = await supabase
      .from('qf_tareas_registro_mensual')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // 7. Obtener la plantilla maestra de tareas
  async getPlantillaTareas() {
    const { data, error } = await supabase
      .from('qf_tareas_plantilla')
      .select('*')
      .eq('activo', true)
      .order('semana', { ascending: true })
      .order('dia_semana', { ascending: true, nullsFirst: false })
      .order('bloque', { ascending: true })
      .order('orden', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // 8. Crear tarea en la plantilla maestra
  async createTareaPlantilla(tareaData) {
    const { data, error } = await supabase
      .from('qf_tareas_plantilla')
      .insert([tareaData])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // 9. Actualizar tarea en la plantilla maestra
  async updateTareaPlantilla(id, updates) {
    const { data, error } = await supabase
      .from('qf_tareas_plantilla')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // 10. Desactivar / Eliminar tarea de la plantilla maestra
  async deleteTareaPlantilla(id) {
    const { error } = await supabase
      .from('qf_tareas_plantilla')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
