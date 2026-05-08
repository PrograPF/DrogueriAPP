import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, Package, MapPin, TrendingUp, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';

const InformesModule = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Carga de datos reales desde Supabase
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pendientes, error } = await supabase
        .from('pendientes')
        .select('*, articulos(codigo, nombre), centros(nombre)')
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      // Adaptamos nombres de columnas de Supabase a los usados en el componente
      const mappedData = pendientes.map(item => ({
        id: item.id,
        cod: item.articulos?.codigo || 'S/C',
        nombre: item.articulos?.nombre || 'Desconocido',
        centro: item.centros?.nombre || 'S/C',
        cantidad: item.pendiente,
        fecha: item.fecha
      }));

      setData(mappedData);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado y Cálculos
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.cod.toLowerCase().includes(term) || 
      item.nombre.toLowerCase().includes(term) || 
      item.centro.toLowerCase().includes(term)
    );
  }, [searchTerm, data]);

  // Cálculo del total acumulado para el producto buscado (si se busca por código o nombre)
  const totalPendienteProducto = useMemo(() => {
    // Solo mostrar total acumulado si hay un término de búsqueda que no sea un centro
    if (!searchTerm) return null;
    
    // Si el término coincide con un centro, no mostramos el "Total por Producto" de forma global,
    // a menos que también coincida con un producto.
    const uniqueCodes = [...new Set(filteredData.map(item => item.cod))];
    
    if (uniqueCodes.length === 1) {
      const total = filteredData.reduce((sum, item) => sum + item.cantidad, 0);
      return {
        nombre: filteredData[0].nombre,
        total
      };
    }
    return null;
  }, [filteredData, searchTerm]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="informes-container"
      style={{ maxWidth: '1100px', margin: '0 auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <FileText size={32} color="#3b82f6" />
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Módulo de Informes</h2>
          <p style={{ color: '#94a3b8' }}>Visualización y búsqueda de artículos pendientes por centro.</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="glass-card" style={{ padding: '25px', marginBottom: '30px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
          <input 
            type="text"
            placeholder="Buscar por código, nombre o centro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '45px', fontSize: '1rem' }}
          />
        </div>
      </div>

      {/* Resumen de Producto (Si aplica) */}
      {totalPendienteProducto && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
            padding: '25px',
            borderRadius: '16px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Pendiente Global</span>
            <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', marginTop: '5px' }}>{totalPendienteProducto.nombre}</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6' }}>{totalPendienteProducto.total}</span>
            <span style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8' }}>Unidades en total</span>
          </div>
        </motion.div>
      )}

      {/* Tabla de Resultados */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} /> Resultados de búsqueda
          </h4>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{filteredData.length} registros encontrados</span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={thStyle}>CÓDIGO</th>
                <th style={thStyle}>DESCRIPCIÓN</th>
                <th style={thStyle}>CENTRO / DESTINO</th>
                <th style={thStyle}>FECHA</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>CANTIDAD</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map((item, index) => (
                <tr key={item.id} style={{ 
                  borderBottom: index !== filteredData.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  transition: 'background 0.2s'
                }} className="table-row-hover">
                  <td style={tdStyle}>
                    <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem' }}>
                      {item.cod}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#f8fafc', fontWeight: '500' }}>{item.nombre}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                      <MapPin size={14} /> {item.centro}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.85rem' }}>{item.fecha}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#10b981', fontSize: '1.1rem' }}>
                    {item.cantidad}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    <Package size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                    <p>No se encontraron registros que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .table-row-hover:hover {
          background: rgba(255,255,255,0.02);
        }
        th { letter-spacing: 0.5px; }
      `}</style>
    </motion.div>
  );
};

const thStyle = {
  padding: '16px 20px',
  fontSize: '0.75rem',
  fontWeight: '700',
  color: '#64748b',
  textTransform: 'uppercase'
};

const tdStyle = {
  padding: '16px 20px',
  fontSize: '0.95rem'
};

export default InformesModule;
