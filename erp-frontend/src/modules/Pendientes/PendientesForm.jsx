import React, { useState, useEffect } from 'react';
import { Save, Eraser, Package, ClipboardList, Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import arsenalData from '../arsenal.json';

const PendientesForm = ({ onBack }) => {
  const [centros, setCentros] = useState([
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
    stock: 0,
    consumo: 0,
    pedido: 0,
    entrega: 0
  });

  const [pendiente, setPendiente] = useState(0);
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

  // Cálculo automático del pendiente
  useEffect(() => {
    const calc = formData.pedido - formData.entrega;
    setPendiente(calc > 0 ? calc : 0);
  }, [formData.pedido, formData.entrega]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.cod || !formData.centro) {
      alert('Por favor complete Código y Centro');
      return;
    }

    setLoading(true);
    try {
      // Regla de Negocio: Buscar si ya existe el mismo artículo para el mismo centro
      const { data: existingEntries } = await supabase
        .from('pendientes')
        .select('id')
        .eq('cod', formData.cod)
        .eq('centro', formData.centro);

      const payload = {
        cod: formData.cod,
        nombre_articulo: formData.nombreArticulo,
        fecha: formData.fecha,
        centro: formData.centro,
        stock: parseInt(formData.stock),
        consumo: parseInt(formData.consumo),
        pedido: parseInt(formData.pedido),
        entrega: parseInt(formData.entrega),
        pendiente: pendiente
      };

      if (existingEntries && existingEntries.length > 0) {
        // Reemplazamos el registro más antiguo/existente (mantenemos la última necesidad)
        const idToReplace = existingEntries[0].id;
        const { error } = await supabase
          .from('pendientes')
          .update(payload)
          .eq('id', idToReplace);
        
        if (error) throw error;
        alert(`Registro actualizado exitosamente para ${formData.centro}`);
      } else {
        // Insertamos uno nuevo
        const { error } = await supabase
          .from('pendientes')
          .insert([payload]);
        
        if (error) throw error;
        alert('Datos guardados exitosamente en Supabase.');
      }
    } catch (err) {
      console.error('Error en Supabase:', err);
      alert('Error al guardar: ' + err.message);
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
      stock: 0,
      consumo: 0,
      pedido: 0,
      entrega: 0
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="glass-card"
      style={{ maxWidth: '900px', margin: '0 auto', padding: '30px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ClipboardList size={32} color="#3b82f6" />
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Ingreso de Datos Pendientes</h2>
        </div>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 16px' }}>
          Volver
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        {/* Lado Izquierdo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <label style={labelStyle}>Nombre del Artículo (Auto)</label>
            <div style={{ 
              padding: '12px 16px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '8px', 
              color: formData.cod ? '#3b82f6' : '#64748b',
              fontWeight: '600',
              border: '1px dashed var(--border-color)'
            }}>
              {formData.nombreArticulo}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={labelStyle}>Stock Actual</label>
              <input 
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                className="input-field" 
              />
            </div>
            <div>
              <label style={labelStyle}>Consumo</label>
              <input 
                type="number"
                name="consumo"
                value={formData.consumo}
                onChange={handleChange}
                className="input-field" 
              />
            </div>
          </div>
        </div>

        {/* Lado Derecho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
          <div>
            <label style={labelStyle}><MapPin size={16} /> Centro</label>
            <select 
              name="centro"
              value={formData.centro}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Seleccione un centro...</option>
              {centros.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={labelStyle}>Pedido</label>
              <input 
                type="number"
                name="pedido"
                value={formData.pedido}
                onChange={handleChange}
                className="input-field" 
              />
            </div>
            <div>
              <label style={labelStyle}>Entrega</label>
              <input 
                type="number"
                name="entrega"
                value={formData.entrega}
                onChange={handleChange}
                className="input-field" 
              />
            </div>
          </div>

          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginTop: '10px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '0.9rem', color: '#10b981', display: 'block', marginBottom: '4px' }}>CANTIDAD PENDIENTE</span>
            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{pendiente}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '40px', justifyContent: 'flex-end' }}>
        <button onClick={handleClear} className="btn-secondary">
          <Eraser size={20} /> Limpiar Todo
        </button>
        <button onClick={handleSave} className="btn-primary" style={{ minWidth: '200px' }}>
          <Save size={20} /> Guardar Registro
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

export default PendientesForm;
