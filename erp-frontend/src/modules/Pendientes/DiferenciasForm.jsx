import React, { useState } from 'react';
import { Save, Eraser, Package, Calendar, MessageSquare, AlertCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import useCentros from '../../hooks/useCentros';
import useArsenalLookup from '../../hooks/useArsenalLookup';
import { resolveCentroId, resolveArticuloId } from '../../utils/resolveEntities';
import { labelStyle } from '../../styles/sharedStyles';

const DiferenciasForm = ({ onBack }) => {
  const { centros } = useCentros();

  const [formData, setFormData] = useState({
    cod: '',
    fecha: new Date().toISOString().split('T')[0],
    centro: '',
    diferencia: ''
  });

  const nombreArticulo = useArsenalLookup(formData.cod);
  const [loading, setLoading] = useState(false);

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
      const centroId = await resolveCentroId(formData.centro);
      const articuloId = await resolveArticuloId(formData.cod, nombreArticulo);

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
        <div className="responsive-grid-2">
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

        <div className="responsive-grid-2">
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
              minHeight: '45px',
              display: 'flex',
              alignItems: 'center'
            }}>
              {nombreArticulo}
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

      <div className="btn-group-responsive" style={{ display: 'flex', gap: '16px', marginTop: '40px', justifyContent: 'flex-end' }}>
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

export default DiferenciasForm;
