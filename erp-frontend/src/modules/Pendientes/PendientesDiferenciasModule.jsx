import React, { useState } from 'react';
import { ClipboardList, AlertCircle, ArrowRight, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PendientesForm from './PendientesForm';
import DiferenciasForm from './DiferenciasForm';
import InformesModule from '../Informes/InformesModule';
import DiferenciasHistorial from '../Informes/DiferenciasHistorial';

const PendientesDiferenciasModule = () => {
  const [view, setView] = useState('selection'); // 'selection', 'pendientes', 'diferencias', 'historial', 'historial-diferencias'

  const cardVariantsBlue = {
    hover: { 
      scale: 1.02, 
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.4)',
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
  };

  const cardVariantsOrange = {
    hover: { 
      scale: 1.02, 
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <AnimatePresence mode="wait">
        {view === 'selection' && (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ 
              maxWidth: '1000px', 
              margin: '40px auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
          >
            {/* Seccion 1: Pendientes (Azul) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px'
            }}>
              {/* Botón Pendientes */}
              <motion.div 
                variants={cardVariantsBlue}
                whileHover="hover"
                whileTap="tap"
                onClick={() => setView('pendientes')}
                className="glass-card"
                style={{ 
                  padding: '40px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                  <ClipboardList size={48} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px' }}>Pendientes</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                    Registra artículos solicitados que no fueron entregados por falta de stock.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '600' }}>
                  Abrir Formulario <ArrowRight size={18} />
                </div>
              </motion.div>

              {/* Botón Historial de Pendientes */}
              <motion.div 
                variants={cardVariantsBlue}
                whileHover="hover"
                whileTap="tap"
                onClick={() => setView('historial')}
                className="glass-card"
                style={{ 
                  padding: '40px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                  <History size={48} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px' }}>Historial de Pendientes</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                    Consulta y gestiona el listado de artículos pendientes y genera reportes.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '600' }}>
                  Ver Listado <ArrowRight size={18} />
                </div>
              </motion.div>
            </div>

            {/* Seccion 2: Diferencias (Naranja) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px'
            }}>
              {/* Botón Diferencias */}
              <motion.div 
                variants={cardVariantsOrange}
                whileHover="hover"
                whileTap="tap"
                onClick={() => setView('diferencias')}
                className="glass-card"
                style={{ 
                  padding: '40px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%' }}>
                  <AlertCircle size={48} color="#f59e0b" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px' }}>Diferencias</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                    Anota incongruencias de datos (lote, vencimiento, cantidad) para inventario.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: '600' }}>
                  Abrir Formulario <ArrowRight size={18} />
                </div>
              </motion.div>

              {/* Botón Historial de Diferencias */}
              <motion.div 
                variants={cardVariantsOrange}
                whileHover="hover"
                whileTap="tap"
                onClick={() => setView('historial-diferencias')}
                className="glass-card"
                style={{ 
                  padding: '40px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%' }}>
                  <History size={48} color="#f59e0b" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px' }}>Historial de Diferencias</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                    Revisa el registro de todas las incongruencias y notas de inventario ingresadas.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: '600' }}>
                  Ver Listado <ArrowRight size={18} />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {view === 'pendientes' && (
          <div key="pendientes-view">
            <PendientesForm onBack={() => setView('selection')} />
          </div>
        )}

        {view === 'diferencias' && (
          <div key="diferencias-view">
            <DiferenciasForm onBack={() => setView('selection')} />
          </div>
        )}

        {view === 'historial' && (
          <div key="historial-view">
            <InformesModule onBack={() => setView('selection')} />
          </div>
        )}

        {view === 'historial-diferencias' && (
          <div key="historial-diferencias-view">
            <DiferenciasHistorial onBack={() => setView('selection')} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PendientesDiferenciasModule;
