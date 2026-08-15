import React, { useState } from 'react';
import { ClipboardList, ClipboardCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RecepcionArticulosModule from '../RecepcionArticulos/RecepcionArticulosModule';
import RevisionBodegaModule from '../RevisionBodega/RevisionBodegaModule';

const RecepcionRevisionModule = () => {
  const [view, setView] = useState('selection'); // 'selection' | 'recepcion' | 'revision'

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px' }}>
      <AnimatePresence mode="wait">
        {view === 'selection' && (
          /* ==========================================
             VISTA PRINCIPAL: SELECCIÓN RECEPCIÓN Y REVISIÓN
             ========================================== */
          <motion.div
            key="selection-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ 
              maxWidth: '1000px', 
              margin: '30px auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
          >
            {/* Header del Módulo */}
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#f8fafc', margin: 0 }}>
                Recepción y Revisión
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '8px' }}>
                Selecciona la sección o proceso de mercadería que deseas gestionar.
              </p>
            </div>

            {/* Grid de Secciones / Botones */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px'
            }}>
              {/* Botón 1: Recepción en bahía de descarga */}
              <motion.div 
                whileHover={{ 
                  scale: 1.02, 
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('recepcion')}
                className="glass-card"
                style={{ 
                  padding: '36px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.03)'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                  <ClipboardList size={48} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px', color: '#f8fafc' }}>
                    Recepción en bahía de descarga
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                    Registro inicial de bultos, facturas, actas CENABAST y trazabilidad de lotes recibidos.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '600', fontSize: '0.95rem' }}>
                  Abrir Recepción <ArrowRight size={18} />
                </div>
              </motion.div>

              {/* Botón 2: Revisión en bodega */}
              <motion.div 
                whileHover={{ 
                  scale: 1.02, 
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('revision')}
                className="glass-card"
                style={{ 
                  padding: '36px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.03)'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%' }}>
                  <ClipboardCheck size={48} color="#10b981" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px', color: '#f8fafc' }}>
                    Revisión en bodega
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                    Verificación detallada de productos, inspección cuantitativa/cualitativa e historial de revisión.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '600', fontSize: '0.95rem' }}>
                  Abrir Revisión <ArrowRight size={18} />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {view === 'recepcion' && (
          <motion.div
            key="recepcion-view"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
          >
            <RecepcionArticulosModule />
          </motion.div>
        )}

        {view === 'revision' && (
          <motion.div
            key="revision-view"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
          >
            <RevisionBodegaModule />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecepcionRevisionModule;
