import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';

const ConfigModule = () => {
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newCentro, setNewCentro] = useState('');

  useEffect(() => {
    fetchCentros();
  }, []);

  const fetchCentros = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('centros')
        .select('*')
        .order('nombre');
      if (error) throw error;
      setCentros(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCentro.trim()) return;
    try {
      const { error } = await supabase
        .from('centros')
        .insert([{ nombre: newCentro.toUpperCase().trim() }]);
      if (error) throw error;
      setNewCentro('');
      fetchCentros();
    } catch (err) {
      alert('Error al añadir: ' + err.message);
    }
  };

  const handleUpdate = async (id) => {
    if (!editValue.trim()) return;
    try {
      const { error } = await supabase
        .from('centros')
        .update({ nombre: editValue.toUpperCase().trim() })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      fetchCentros();
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el centro "${nombre}"? Esta acción podría afectar registros históricos.`)) return;
    try {
      const { error } = await supabase.from('centros').delete().eq('id', id);
      if (error) throw error;
      fetchCentros();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      style={{ maxWidth: '800px', margin: '0 auto' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Settings size={32} color="#3b82f6" />
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Configuración del Sistema</h2>
            <p style={{ color: '#94a3b8' }}>Gestión de Centros de Salud y parámetros globales.</p>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '30px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MapPin size={20} color="#3b82f6" /> Gestión de Centros
        </h3>

        {/* Formulario Añadir */}
        <div className="btn-group-responsive" style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <input 
            type="text" 
            placeholder="Nombre del nuevo centro..." 
            className="input-field"
            value={newCentro}
            onChange={(e) => setNewCentro(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
            <Plus size={20} /> Añadir Centro
          </button>
        </div>

        {/* Lista de Centros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <p>Cargando centros...</p>
          ) : (
            centros.map(centro => (
              <div key={centro.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {editingId === centro.id ? (
                  <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                    <input 
                      className="input-field" 
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleUpdate(centro.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Save size={20} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontWeight: '500' }}>{centro.nombre}</span>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <button 
                        onClick={() => { setEditingId(centro.id); setEditValue(centro.nombre); }}
                        style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(centro.id, centro.nombre)}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ConfigModule;
