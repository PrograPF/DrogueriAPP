import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ArrowRight, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import QFCalendarioTareas from './components/QFCalendarioTareas';

class QFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Error en Módulo QF:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="glass-card" 
          style={{ 
            padding: '36px', 
            textAlign: 'center', 
            borderRadius: '16px', 
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <h3 style={{ color: '#ef4444', margin: 0, fontSize: '1.2rem' }}>Ocurrió un error al cargar el submódulo</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {this.state.error?.message || 'Error inesperado de ejecución.'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary" 
            style={{ marginTop: '8px', padding: '8px 18px', fontSize: '0.85rem' }}
          >
            Recargar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const QFModule = () => {
  // 'selection' para la vista de selección inicial, 'tareas' para el calendario
  const [view, setView] = useState('selection');

  return (
    <div style={{ maxWidth: '1400px', margin: '20px auto', padding: '0 16px' }}>
      <AnimatePresence mode="wait">
        {/* VISTA 1: MENÚ DE SELECCIÓN PRINCIPAL */}
        {view === 'selection' && (
          <motion.div
            key="selection-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            style={{ padding: '20px 0' }}
          >
            {/* Encabezado del Módulo QF */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '20px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#3b82f6',
                fontSize: '0.82rem',
                fontWeight: '700',
                marginBottom: '16px'
              }}>
                <Sparkles size={16} /> Gestión Técnica Farmacéutica
              </div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Módulo Químico Farmacéutico (QF)
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
                Selecciona la herramienta a la que deseas acceder para la gestión técnica y operativa de droguería.
              </p>
            </div>

            {/* Cuadrícula de Tarjetas de Acceso (Solo Gestión tareas Drogueria) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 480px))',
              justifyContent: 'center',
              gap: '24px'
            }}>
              <motion.div 
                whileHover={{ 
                  scale: 1.02, 
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('tareas')}
                className="glass-card"
                style={{ 
                  padding: '36px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '20px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '16px'
                }}
              >
                <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                  <Calendar size={48} color="#3b82f6" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-primary)' }}>
                    Gestión tareas Drogueria
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                    Control diario, semanal y periódico de tareas normativas, técnicas y sanitarias en droguería.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '600', fontSize: '0.95rem' }}>
                  Abrir Gestión de Tareas <ArrowRight size={18} />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* VISTA 2: CALENDARIO Y GESTIÓN DE TAREAS */}
        {view === 'tareas' && (
          <motion.div
            key="tareas-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            {/* Botón Volver al Menú Principal QF */}
            <button 
              onClick={() => setView('selection')} 
              className="btn-secondary" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '20px', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: '0.88rem',
                fontWeight: '600'
              }}
            >
              <ArrowLeft size={16} /> Volver al Menú QF
            </button>

            <QFErrorBoundary>
              <QFCalendarioTareas />
            </QFErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QFModule;
