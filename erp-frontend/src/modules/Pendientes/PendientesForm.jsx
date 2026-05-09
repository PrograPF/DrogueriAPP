import React, { useState, useEffect } from 'react';
import { Save, Eraser, Package, ClipboardList, Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import useCentros from '../../hooks/useCentros';
import useArsenalLookup from '../../hooks/useArsenalLookup';

const PendientesForm = ({ onBack }) => {
  const { centros } = useCentros();

  const [formData, setFormData] = useState({
    cod: '',
    fecha: new Date().toISOString().split('T')[0],
    centro: '',
    stock: 0,
    consumo: 0,
    pedido: 0,
    entrega: 0
  });

  const nombreArticulo = useArsenalLookup(formData.cod);
  const [pendiente, setPendiente] = useState(0);
  const [loading, setLoading] = useState(false);

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
      // 1. Asegurar que el centro existe y obtener su ID
      let { data: centroData, error: centroError } = await supabase
        .from('centros')
        .select('id')
        .eq('nombre', formData.centro)
        .single();
      
      let centroId;
      if (centroError || !centroData) {
        const { data: newCentro, error: insCentroErr } = await supabase
          .from('centros')
          .insert([{ nombre: formData.centro }])
          .select()
          .single();
        if (insCentroErr) throw insCentroErr;
        centroId = newCentro.id;
      } else {
        centroId = centroData.id;
      }

      // 2. Asegurar que el artículo existe y obtener su ID
      let { data: artData, error: artError } = await supabase
        .from('articulos')
        .select('id')
        .eq('codigo', formData.cod)
        .single();
      
      let articuloId;
      if (artError || !artData) {
        const { data: newArt, error: insArtErr } = await supabase
          .from('articulos')
          .insert([{ codigo: formData.cod, nombre: nombreArticulo }])
          .select()
          .single();
        if (insArtErr) throw insArtErr;
        articuloId = newArt.id;
      } else {
        articuloId = artData.id;
      }

      // 3. Obtener el registro vigente actual para este artículo/centro
      const { data: currentVigente } = await supabase
        .from('pendientes')
        .select('id, fecha')
        .eq('articulo_id', articuloId)
        .eq('centro_id', centroId)
        .eq('es_vigente', true)
        .maybeSingle();

      let shouldBeVigente = true;

      if (currentVigente) {
        const existingDate = new Date(currentVigente.fecha);
        const newDate = new Date(formData.fecha);

        if (newDate >= existingDate) {
          // El nuevo es más reciente: archivamos el anterior
          await supabase
            .from('pendientes')
            .update({ es_vigente: false })
            .eq('id', currentVigente.id);
          shouldBeVigente = true;
        } else {
          // El nuevo es más antiguo: se guarda directamente como historial
          shouldBeVigente = false;
        }
      }

      // 4. Insertar el nuevo registro con la vigencia calculada
      const { error } = await supabase
        .from('pendientes')
        .insert([{
          articulo_id: articuloId,
          centro_id: centroId,
          fecha: formData.fecha,
          stock: parseInt(formData.stock),
          consumo: parseInt(formData.consumo),
          pedido: parseInt(formData.pedido),
          entrega: parseInt(formData.entrega),
          es_vigente: shouldBeVigente
        }]);
      
      if (error) throw error;
      
      if (shouldBeVigente) {
        alert('Registro guardado como VIGENTE (el más reciente).');
      } else {
        alert('Registro guardado como HISTORIAL (ya existe uno con fecha posterior).');
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
              {nombreArticulo}
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
