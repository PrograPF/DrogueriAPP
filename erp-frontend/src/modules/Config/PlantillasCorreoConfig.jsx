import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Mail, Plus, Edit2, Trash2, X, Save, RefreshCw, 
  HelpCircle, Copy, Check, FileText
} from 'lucide-react';

const PlantillasCorreoConfig = () => {
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [copiadoTag, setCopiadoTag] = useState('');

  const formVacio = {
    titulo: '',
    asunto: '',
    con_copia: '',
    cuerpo: ''
  };
  const [form, setForm] = useState(formVacio);

  const tagsDisponibles = [
    { tag: '{numero_oc}', desc: 'N° de la Orden de Compra (ej: OC-2026-001)' },
    { tag: '{proveedor}', desc: 'Nombre de la empresa proveedora' },
    { tag: '{solicitud_compra}', desc: 'N° de Solicitud de Compra (ej: S-1234)' },
    { tag: '{tipo_oc}', desc: 'Tipo de OC (ej: AG, SE, CM, L1, etc.)' },
    { tag: '{fecha_tope_aceptacion}', desc: 'Fecha tope para que el proveedor acepte' },
    { tag: '{fecha_tope_entrega}', desc: 'Fecha tope de entrega conforme en bodega' },
    { tag: '{fecha_tope_multa}', desc: 'Fecha máxima permitida con aplicación de multa' }
  ];

  const cargarPlantillas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('plantillas_correo')
        .select('*')
        .order('id', { ascending: true });

      if (err) {
        if (err.code === '42P01') {
          setError('La tabla "plantillas_correo" aún no existe en Supabase. Por favor ejecuta el código SQL en el editor de Supabase.');
        } else {
          setError(err.message);
        }
        setPlantillas([]);
      } else {
        setPlantillas(data || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPlantillas();
  }, [cargarPlantillas]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formVacio);
    setShowModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({
      titulo: p.titulo || '',
      asunto: p.asunto || '',
      con_copia: p.con_copia || '',
      cuerpo: p.cuerpo || ''
    });
    setShowModal(true);
  };

  const copiarTag = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiadoTag(tag);
    setTimeout(() => setCopiadoTag(''), 2000);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.asunto.trim() || !form.cuerpo.trim()) {
      alert('Por favor completa el Título, Asunto y Cuerpo del correo.');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        asunto: form.asunto.trim(),
        con_copia: form.con_copia.trim(),
        cuerpo: form.cuerpo.trim()
      };

      if (editando) {
        const { error: err } = await supabase
          .from('plantillas_correo')
          .update(payload)
          .eq('id', editando.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('plantillas_correo')
          .insert([payload]);
        if (err) throw err;
      }

      setShowModal(false);
      setForm(formVacio);
      setEditando(null);
      await cargarPlantillas();
    } catch (err) {
      alert('Error al guardar tipo de correo: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (p) => {
    if (!window.confirm(`¿Estás seguro de eliminar el tipo de correo "${p.titulo}"?`)) return;
    try {
      const { error: err } = await supabase
        .from('plantillas_correo')
        .delete()
        .eq('id', p.id);
      if (err) throw err;
      await cargarPlantillas();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '30px' }}>
      {/* Cabecera de la sección */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
            <Mail size={22} color="#38bdf8" /> Tipos y Plantillas de Correo para Proveedores
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Configura los correos automáticos predefinidos que se enviarán vía Outlook Web desde Seguimiento de OC.
          </p>
        </div>

        <button 
          onClick={abrirNuevo} 
          className="btn-primary" 
          style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Crear Nuevo Tipo de Correo
        </button>
      </div>

      {/* Guía de variables dinámicas */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '25px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: '700', fontSize: '0.9rem', marginBottom: '8px' }}>
          <HelpCircle size={18} /> Variables dinámicas automáticas:
        </div>
        <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 10px 0' }}>
          Puedes escribir estas etiquetas dentro del Asunto o del Cuerpo. Al enviar el correo desde una OC, se reemplazarán automáticamente por los datos reales de esa compra:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {tagsDisponibles.map(t => (
            <button
              key={t.tag}
              type="button"
              onClick={() => copiarTag(t.tag)}
              title={`${t.desc} (Clic para copiar)`}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'monospace'
              }}
            >
              {copiadoTag === t.tag ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {t.tag}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de error / carga */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px auto' }} />
          Cargando tipos de correo...
        </div>
      ) : plantillas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <FileText size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>No hay tipos de correo registrados aún.</p>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: '#475569' }}>
            Crea tu primera plantilla para comenzar a enviar correos rápidos desde Seguimiento de OC.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {plantillas.map(p => (
            <div 
              key={p.id}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: '700' }}>
                    {p.titulo}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '4px', fontWeight: '600' }}>
                    Asunto: <span style={{ color: '#cbd5e1', fontWeight: '400' }}>{p.asunto}</span>
                  </div>
                  {p.con_copia && (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                      Con copia (CC): <span style={{ color: '#e2e8f0' }}>{p.con_copia}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => abrirEditar(p)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Editar plantilla"
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(p)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Eliminar plantilla"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Vista previa del cuerpo */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.82rem',
                color: '#94a3b8',
                whiteSpace: 'pre-wrap',
                maxHeight: '110px',
                overflowY: 'auto'
              }}>
                {p.cuerpo}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CREAR / EDITAR TIPO DE CORREO */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '25px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={20} color="#38bdf8" />
                {editando ? 'Editar Tipo de Correo' : 'Crear Nuevo Tipo de Correo'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  Título del Tipo de Correo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Aviso de Envío de OC, Consulta de Despacho..."
                  className="input-field"
                  style={{ width: '100%' }}
                  value={form.titulo}
                  onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                  Este título aparecerá en el menú desplegable al enviar un correo desde Seguimiento de OC.
                </small>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  Asunto del Correo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ORDEN DE COMPRA {numero_oc} - DROGUERÍA"
                  className="input-field"
                  style={{ width: '100%' }}
                  value={form.asunto}
                  onChange={e => setForm(prev => ({ ...prev, asunto: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  Correos con Copia (CC) - Opcional
                </label>
                <input
                  type="text"
                  placeholder="ej: adquisiciones@salud.cl, bodega@salud.cl"
                  className="input-field"
                  style={{ width: '100%' }}
                  value={form.con_copia}
                  onChange={e => setForm(prev => ({ ...prev, con_copia: e.target.value }))}
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                  Separa múltiples correos con comas o puntos y coma.
                </small>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                  Cuerpo del Correo *
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder={`Estimados {proveedor},\n\nJunto con saludar, informamos que la OC {numero_oc} tiene fecha de entrega pactada para el {fecha_tope_entrega}...\n\nSaludos cordiales,\nDroguería`}
                  className="input-field"
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem', lineHeight: 1.5 }}
                  value={form.cuerpo}
                  onChange={e => setForm(prev => ({ ...prev, cuerpo: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn-secondary"
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={guardando}
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Tipo de Correo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantillasCorreoConfig;
