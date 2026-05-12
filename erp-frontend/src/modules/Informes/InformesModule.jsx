import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, Package, MapPin, Trash2, Filter, History, CheckCircle2, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';

const PAGE_SIZE = 50;

const InformesModule = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setData([]);
    setPage(0);
    setHasMore(true);
    fetchData(0, true);
  }, [showHistory]);

  const fetchData = async (pageNum = 0, reset = false) => {
    setLoading(true);
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('pendientes')
        .select('*, articulos(codigo, nombre), centros(nombre)')
        .order('fecha', { ascending: false })
        .range(from, to);

      if (!showHistory) {
        query = query.eq('es_vigente', true);
      }

      const { data: pendientes, error } = await query;
      if (error) throw error;
      
      const mappedData = pendientes.map(item => ({
        id: item.id,
        cod: item.articulos?.codigo || 'S/C',
        nombre: item.articulos?.nombre || 'Desconocido',
        centro: item.centros?.nombre || 'S/C',
        cantidad: item.pendiente,
        fecha: item.fecha,
        esVigente: item.es_vigente
      }));

      setData(prev => reset ? mappedData : [...prev, ...mappedData]);
      setHasMore(pendientes.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage);
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de "${nombre}"?`)) return;
    try {
      const { error } = await supabase.from('pendientes').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.cod.toLowerCase().includes(term) || 
      item.nombre.toLowerCase().includes(term) || 
      item.centro.toLowerCase().includes(term)
    );
  }, [searchTerm, data]);

  const totalGlobal = useMemo(() => {
    return data.filter(i => i.esVigente).reduce((sum, item) => sum + item.cantidad, 0);
  }, [data]);

  const totalPendienteProducto = useMemo(() => {
    if (!searchTerm) return null;
    const uniqueCodes = [...new Set(filteredData.filter(i => i.esVigente).map(item => item.cod))];
    if (uniqueCodes.length === 1) {
      const activeData = filteredData.filter(i => i.esVigente);
      const total = activeData.reduce((sum, item) => sum + item.cantidad, 0);
      return { nombre: activeData[0]?.nombre || 'Producto', total };
    }
    return null;
  }, [filteredData, searchTerm]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="informes-container"
      style={{ maxWidth: '1200px', margin: '0 auto' }}
    >
      {/* Resumen Global (NUEVO) */}
      <div className="responsive-grid-auto no-print" style={{ marginBottom: '30px' }}>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Total Unidades Pendientes</span>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#3b82f6', marginTop: '5px' }}>{totalGlobal}</h2>
        </div>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Artículos con Deuda</span>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981', marginTop: '5px' }}>{data.filter(i => i.esVigente).length}</h2>
        </div>
      </div>

      {/* Botones de Cabecera */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FileText size={32} color="#3b82f6" />
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Módulo de Informes</h2>
              <p style={{ color: '#94a3b8' }}>Visualización y gestión de artículos pendientes.</p>
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#10b981' }}
          >
            <Printer size={18} /> Imprimir Hoja de Despacho
          </button>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={showHistory ? "btn-primary" : "btn-secondary"}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
          >
            {showHistory ? <CheckCircle2 size={18} /> : <History size={18} />}
            {showHistory ? "Ver Solo Vigentes" : "Ver Todo el Historial"}
          </button>
        </div>
      </div>

      {/* Encabezado Exclusivo para Impresión (Membrete Institucional) */}
      <div className="print-only" style={{ display: 'none', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Logo de DESAM */}
            <img src="/logo-desam.png" alt="Logo DESAM" style={{ height: '60px' }} />
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: '800' }}>DESAM</h2>
              <p style={{ margin: 0, fontSize: '10pt', fontWeight: '600', color: '#333' }}>Unidad de Droguería</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '18pt', margin: 0, fontWeight: '900' }}>HOJA DE DESPACHO</h1>
            <p style={{ margin: 0, fontSize: '9pt' }}>Control de Pendientes</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '10pt' }}>
          <span><strong>Responsable:</strong> ___________________________</span>
          <span><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="glass-card no-print" style={{ padding: '25px', marginBottom: '30px' }}>
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

      {totalPendienteProducto && (
        <div className="no-print" style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
            padding: '25px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)',
            marginBottom: '30px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px'
          }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase' }}>Deuda Actual Vigente</span>
            <h3 style={{ fontSize: '1.4rem', color: '#f8fafc', marginTop: '5px' }}>{totalPendienteProducto.nombre}</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6' }}>{totalPendienteProducto.total}</span>
            <span style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8' }}>Unidades pendientes</span>
          </div>
        </div>
      )}

      <div className="print-container" style={{ background: 'transparent', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <th style={thStyle} className="no-print">ESTADO</th>
              <th style={thStyle}>CÓDIGO</th>
              <th style={thStyle}>DESCRIPCIÓN</th>
              <th style={thStyle}>CENTRO</th>
              <th style={thStyle}>FECHA SOLIC.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>SOLICITADO</th>
              {/* Columnas Extra para Impresión */}
              <th style={{ ...thStyle, display: 'none' }} className="print-column">F. VENCIM.</th>
              <th style={{ ...thStyle, display: 'none' }} className="print-column">LOTE</th>
              <th style={{ ...thStyle, display: 'none' }} className="print-column">ENVIADO</th>
              <th style={{ ...thStyle, textAlign: 'center' }} className="no-print">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.id} style={{ 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                opacity: item.esVigente ? 1 : 0.5
              }}>
                <td style={tdStyle} className="no-print">
                  {item.esVigente ? 
                    <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #10b981', padding: '2px 6px', borderRadius: '4px' }}>VIGENTE</span> : 
                    <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #64748b', padding: '2px 6px', borderRadius: '4px' }}>HISTORIAL</span>
                  }
                </td>
                <td style={tdStyle}>
                  <span style={{ fontWeight: '700' }}>{item.cod}</span>
                </td>
                <td style={tdStyle}>{item.nombre}</td>
                <td style={tdStyle}>{item.centro}</td>
                <td style={tdStyle}>{item.fecha}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800' }}>{item.cantidad}</td>
                {/* Celdas en blanco para imprimir */}
                <td style={{ ...tdStyle, display: 'none', border: '1px solid #ccc' }} className="print-column"></td>
                <td style={{ ...tdStyle, display: 'none', border: '1px solid #ccc' }} className="print-column"></td>
                <td style={{ ...tdStyle, display: 'none', border: '1px solid #ccc' }} className="print-column"></td>
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

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-column { display: table-cell !important; }
          .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          table { width: 100% !important; border: 1px solid #000 !important; }
          th, td { 
            border: 1px solid #000 !important; 
            color: black !important; 
            padding: 8px !important; 
            font-size: 10pt !important;
            opacity: 1 !important;
            background: white !important;
          }
          th { background: #eee !important; font-weight: bold !important; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>
    </motion.div>
  );
};

const thStyle = { padding: '16px 20px', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' };
const tdStyle = { padding: '16px 20px', fontSize: '0.85rem' };

export default InformesModule;
