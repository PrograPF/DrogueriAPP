import React, { useState, useEffect } from 'react';
import { Save, Eraser, Package, Calendar, MessageSquare, AlertCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import arsenalData from '../arsenal.json';

const DiferenciasForm = ({ onBack }) => {
  const [centros] = useState([
    "ANGELMO", "ANTONIO VARAS", "ASISTE-CPU", "C. ALERCE", 
    "CARMELA CARVAJAL", "CEAPS", "CECOSF ALERCE NORTE", 
    "CECOSF LAWEN", "CECOSF PUERTA SUR", "CLINICA MOVIL", 
    "ESR", "LAB. CLINICO", "ORL", "PADRE HURTADO", 
    "SAPU PH", "SAR ALERCE", "UAPO", "UAPORRINO"
  ]);

  const [formData, setFormData] = useState({
    cod: '',
    nombreArticulo: 'Esperando código...',
    fecha: new Date().toISOString().split('T')[0],
    centro: '',
    diferencia: ''
  });

  const [loading, setLoading] = useState(false);

  // Auto-rellenado usando el Arsenal
  useEffect(() => {
    if (formData.cod) {
      const nombre = arsenalData[formData.cod];
      setFormData(prev => ({ 
        ...prev, 
        nombreArticulo: nombre || 'Código no encontrado en arsenal' 
      }));
    } else {
      setFormData(prev => ({ ...prev, nombreArticulo: 'Esperando código...' }));
    }
  }, [formData.cod]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.cod || !formData.centro || !formData.diferencia) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      // 1. Asegurar que el centro existe y obtener su ID
      let { data: centros, error: centroError } = await supabase
        .from('centros')
        .select('id')
        .eq('nombre', formData.centro);
      
      let centroId;
      if (centroError || !centros || centros.length === 0) {
        const { data: newCentro, error: insCentroErr } = await supabase
          .from('centros')
          .insert([{ nombre: formData.centro }])
          .select()
          .single();
        if (insCentroErr) throw insCentroErr;
        centroId = newCentro.id;
      } else {
        centroId = centros[0].id;
      }

      // 2. Asegurar que el artículo existe y obtener su ID
      let { data: articulos, error: artError } = await supabase
        .from('articulos')
        .select('id')
        .eq('codigo', formData.cod);
      
      let articuloId;
      if (artError || !articulos || articulos.length === 0) {
        const { data: newArt, error: insArtErr } = await supabase
          .from('articulos')
          .insert([{ codigo: formData.cod, nombre: formData.nombreArticulo }])
          .select()
          .single();
        if (insArtErr) throw insArtErr;
        articuloId = newArt.id;
      } else {
        articuloId = articulos[0].id;
      }

      // 3. Insertar la diferencia con los IDs resueltos
      const { error } = await supabase
        .from('diferencias')
        .insert([{
          articulo_id: articuloId,
          centro_id: centroId,
          fecha: formData.fecha,
          diferencia: formData.diferencia
        }]);

      if (error) throw error;
      alert('Diferencia registrada exitosamente en Supabase');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      cod: '',
      nombreArticulo: 'Esperando código...',
      fecha: new Date().toISOString().split('T')[0],
      centro: '',
      diferencia: ''
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-card"
      style={{ maxWidth: '700px', margin: '0 auto', padding: '30px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={32} color="#f59e0b" />
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Ingreso de Diferencias</h2>
        </div>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 16px' }}>
          Volver
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}><Package size={16} /> Código del Producto</label>
            <input 
              name="cod"
              value={formData.cod}
              onChange={handleChange}
              className="input-field" 
              placeholder="Ej: 1227" 
            />
          </div>
          <div>
            <label style={labelStyle}><Calendar size={16} /> Fecha</label>
            <input 
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleChange}
              className="input-field" 
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          <div>
            <label style={labelStyle}><MapPin size={16} /> Centro</label>
            <select 
              name="centro"
              value={formData.centro}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Seleccione centro...</option>
              {centros.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nombre del Artículo (Auto)</label>
            <div style={{ 
              padding: '12px 16px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '8px', 
              color: formData.cod ? '#3b82f6' : '#64748b',
              fontWeight: '600',
              border: '1px dashed var(--border-color)',
              minHeight: '45px'
            }}>
              {formData.nombreArticulo}
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}><MessageSquare size={16} /> Detalle de Diferencia / Observación</label>
          <textarea 
            name="diferencia"
            value={formData.diferencia}
            onChange={handleChange}
            className="input-field" 
            placeholder="Escriba aquí las incongruencias encontradas (lote, vencimiento, cantidad, etc.)..." 
            style={{ minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '40px', justifyContent: 'flex-end' }}>
        <button onClick={handleClear} className="btn-secondary">
          <Eraser size={20} /> Limpiar
        </button>
        <button onClick={handleSave} className="btn-primary" style={{ minWidth: '200px' }}>
          <Save size={20} /> Guardar Diferencia
        </button>
      </div>
    </motion.div>
  );
};

const labelStyle = {
  fontSize: '0.85rem',
  fontWeight: '600',
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px'
};

export default DiferenciasForm;
