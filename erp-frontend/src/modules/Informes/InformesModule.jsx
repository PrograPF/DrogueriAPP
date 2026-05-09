import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, Package, MapPin, Trash2, Filter, History, CheckCircle2, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';

const InformesModule = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchData();
  }, [showHistory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pendientes')
        .select('*, articulos(codigo, nombre), centros(nombre)')
        .order('fecha', { ascending: false });

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

      setData(mappedData);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
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
      {/* Botones de Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FileText size={32} color="#3b82f6" />
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Módulo de Informes</h2>
            <p style={{ color: '#94a3b8' }}>Visualización y gestión de artículos pendientes.</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
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

      {/* Encabezado Exclusivo para Impresión */}
      <div className="print-only" style={{ display: 'none', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h1 style={{ fontSize: '20pt', margin: 0 }}>HOJA DE DESPACHO DE PENDIENTES</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span>Responsable: ___________________________</span>
          <span>Fecha: {new Date().toLocaleDateString()}</span>
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
            marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
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

      <div className="print-container" style={{ background: 'transparent', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
