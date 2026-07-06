import React, { useState, useMemo, useEffect } from 'react';
import { Search, AlertCircle, Trash2, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { thStyleInformes as thStyle, tdStyleInformes as tdStyle } from '../../styles/sharedStyles';
import { formatDate } from '../../utils/dateFormatter';

const PAGE_SIZE = 50;

const DiferenciasHistorial = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('todos'); // 'todos' | 'pendiente' | 'realizado'

  const [articulosCatalog, setArticulosCatalog] = useState({});

  // Cargar catálogo de fármacos y DM para traducción en caliente
  useEffect(() => {
    const cargarCatalog = async () => {
      try {
        const { data: arts, error } = await supabase
          .from('articulos')
          .select('codigo, descripcion');
        if (error) throw error;

        const mapping = {};
        (arts || []).forEach(item => {
          if (item.codigo) {
            mapping[item.codigo.trim()] = item.descripcion;
          }
        });
        setArticulosCatalog(mapping);
      } catch (err) {
        console.error('Error al cargar catálogo de artículos:', err);
      }
    };
    cargarCatalog();
  }, []);

  useEffect(() => {
    fetchData(0, true);
  }, []);

  const fetchData = async (pageNum = 0, reset = false) => {
    setLoading(true);
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: differences, error } = await supabase
        .from('diferencias')
        .select('*, centros(nombre)')
        .order('fecha', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      const mappedData = differences.map(item => ({
        id: item.id,
        cod: item.codigo_articulo || 'S/C',
        centro: item.centros?.nombre || 'S/C',
        fecha: item.fecha,
        detalle: item.diferencia,
        inventario_realizado: item.inventario_realizado || false
      }));

      setData(prev => reset ? mappedData : [...prev, ...mappedData]);
      setHasMore(differences.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error cargando diferencias:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRealizado = async (id, currentVal) => {
    try {
      const newVal = !currentVal;
      const { error } = await supabase
        .from('diferencias')
        .update({ inventario_realizado: newVal })
        .eq('id', id);

      if (error) throw error;
      
      setData(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, inventario_realizado: newVal };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error al actualizar estado de inventario:', err);
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage);
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar este registro de diferencia para "${nombre}"?`)) return;
    try {
      const { error } = await supabase.from('diferencias').delete().eq('id', id);
      if (error) throw error;
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredData = useMemo(() => {
    let mapped = data.map(item => ({
      ...item,
      nombre: articulosCatalog[item.cod?.trim()] || 'Cargando nombre...'
    }));

    if (estadoFilter === 'pendiente') {
      mapped = mapped.filter(item => !item.inventario_realizado);
    } else if (estadoFilter === 'realizado') {
      mapped = mapped.filter(item => item.inventario_realizado);
    }

    if (!searchTerm) return mapped;
    const term = searchTerm.toLowerCase();
    return mapped.filter(item => 
      item.cod.toLowerCase().includes(term) || 
      item.nombre.toLowerCase().includes(term) || 
      item.centro.toLowerCase().includes(term) ||
      item.detalle.toLowerCase().includes(term)
    );
  }, [searchTerm, estadoFilter, data, articulosCatalog]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="informes-container"
      style={{ maxWidth: '1200px', margin: '0 auto' }}
    >
      {/* Botones de Cabecera */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <AlertCircle size={32} color="#f59e0b" />
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Historial de Diferencias</h2>
              <p style={{ color: '#94a3b8' }}>Registro de incongruencias de stock, lotes y vencimientos.</p>
            </div>
          </div>
          {onBack && (
            <button onClick={onBack} className="btn-secondary" style={{ padding: '8px 16px' }}>
              Volver al Inicio
            </button>
          )}
        </div>
        
        <div className="btn-group-responsive" style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handlePrint}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#f59e0b' }}
          >
            <Printer size={18} /> Imprimir Reporte de Diferencias
          </button>
        </div>
      </div>

      <div className="glass-card no-print" style={{ padding: '25px', marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={20} />
          <input 
            type="text"
            placeholder="Buscar por código, nombre, centro o detalle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '45px', fontSize: '1rem', width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '250px' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap' }}>Filtrar por:</label>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="input-field"
            style={{ 
              background: '#0f172a', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#cbd5e1', 
              padding: '10px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              outline: 'none',
              fontSize: '0.9rem',
              width: '100%'
            }}
          >
            <option value="todos">Todos los registros</option>
            <option value="pendiente">Pendientes de Inventario</option>
            <option value="realizado">Inventario Realizado</option>
          </select>
        </div>
      </div>

      <div className="print-container" style={{ background: 'transparent', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th style={thStyle}>CÓDIGO</th>
              <th style={thStyle}>ARTÍCULO</th>
              <th style={thStyle}>CENTRO</th>
              <th style={thStyle}>FECHA</th>
              <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">ESTADO</th>
              <th style={thStyle}>DETALLE / OBSERVACIÓN</th>
              <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={tdStyle}><span style={{ fontWeight: '700' }}>{item.cod}</span></td>
                <td style={tdStyle}>{item.nombre}</td>
                <td style={tdStyle}>{item.centro}</td>
                <td style={tdStyle}>{formatDate(item.fecha)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }} className="no-print">
                  <button 
                    onClick={() => handleToggleRealizado(item.id, item.inventario_realizado)}
                    style={{
                      background: item.inventario_realizado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${item.inventario_realizado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      color: item.inventario_realizado ? '#10b981' : '#f59e0b',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '150px',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = item.inventario_realizado ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)';
                      e.currentTarget.style.borderColor = item.inventario_realizado ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.4)';
                      e.currentTarget.style.color = item.inventario_realizado ? '#ef4444' : '#10b981';
                      e.currentTarget.innerText = item.inventario_realizado ? 'Desmarcar' : '¡Realizado!';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = item.inventario_realizado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.1)';
                      e.currentTarget.style.borderColor = item.inventario_realizado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)';
                      e.currentTarget.style.color = item.inventario_realizado ? '#10b981' : '#f59e0b';
                      e.currentTarget.innerText = item.inventario_realizado ? 'Inventario Realizado' : 'Pendiente';
                    }}
                  >
                    {item.inventario_realizado ? 'Inventario Realizado' : 'Pendiente'}
                  </button>
                </td>
                <td style={{ ...tdStyle, color: '#f59e0b', fontStyle: 'italic' }}>{item.detalle}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }} className="no-print">
                  <button onClick={() => handleDelete(item.id, item.nombre)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && !loading && (
        <div className="no-print" style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={loadMore} className="btn-secondary" style={{ padding: '10px 30px' }}>
            Cargar más registros...
          </button>
        </div>
      )}
      {loading && <p style={{ textAlign: 'center', color: '#64748b', marginTop: '20px' }}>Cargando...</p>}
    </motion.div>
  );
};

export default DiferenciasHistorial;
