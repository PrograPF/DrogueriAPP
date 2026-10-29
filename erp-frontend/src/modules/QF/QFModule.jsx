import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Sparkles, 
  Pill, 
  CheckCircle2, 
  Activity, 
  ArrowRight, 
  ShieldCheck, 
  ClipboardCheck,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [submoduloActivo, setSubmoduloActivo] = useState('CALENDARIO'); // 'CALENDARIO' | 'RESUMEN'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ 
        maxWidth: '1400px', 
        margin: '20px auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px',
        padding: '0 16px' 
      }}
    >
      {/* Encabezado General del Módulo QF */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '20px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: '#3b82f6',
            fontSize: '0.8rem',
            fontWeight: '700',
            marginBottom: '10px'
          }}>
            <Sparkles size={15} /> Gestión Técnica Farmacéutica
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Módulo Químico Farmacéutico
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', marginTop: '6px', margin: 0 }}>
            Control diario, semanal y periódico de tareas normativas, técnicas y sanitarias en droguería.
          </p>
        </div>

        {/* Pestañas de Submódulos */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'var(--input-bg)',
          padding: '5px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setSubmoduloActivo('CALENDARIO')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '9px',
              border: 'none',
              background: submoduloActivo === 'CALENDARIO' ? '#3b82f6' : 'transparent',
              color: submoduloActivo === 'CALENDARIO' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Calendar size={16} /> Calendario de Tareas
          </button>

          <button
            onClick={() => setSubmoduloActivo('RESUMEN')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '9px',
              border: 'none',
              background: submoduloActivo === 'RESUMEN' ? '#3b82f6' : 'transparent',
              color: submoduloActivo === 'RESUMEN' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldCheck size={16} /> Resumen Técnico
          </button>
        </div>
      </div>

      {/* Renderizado de Submódulos */}
      {submoduloActivo === 'CALENDARIO' ? (
        <QFErrorBoundary>
          <QFCalendarioTareas />
        </QFErrorBoundary>
      ) : (
        /* VISTA DE RESUMEN TÉCNICO Y ENLACES */
        <div 
          className="glass-card"
          style={{
            padding: '36px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6'
            }}>
              <Pill size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                Área de Control y Normativa Sanitaria
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                Cumplimiento normativo según Norma Técnica 147 (BPAD), DS 3/2010 y DS 404/405 de controlados.
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginTop: '8px'
          }}>
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '700' }}>
                <CheckCircle2 size={18} /> Planificación de Semanas
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                El calendario distribuye automáticamente las tareas de recepción, almacenamiento, inventario cíclico y auditorías comenzando el día 1 de cada mes.
              </p>
            </div>

            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: '700' }}>
                <Activity size={18} /> Historial Persistente
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Los registros de cumplimiento se almacenan de forma permanente a partir de Octubre 2026, con firma de QF responsable y observaciones.
              </p>
            </div>

            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: '700' }}>
                <ClipboardCheck size={18} /> Gestión de Compras y Bodega
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Las solicitudes de compra y el seguimiento operativo de OC se encuentran integrados en el módulo de Seguimiento OC.
              </p>
              <button
                onClick={() => navigate('/seguimiento-oc')}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  alignSelf: 'flex-start',
                  marginTop: '4px'
                }}
              >
                Ir a Seguimiento OC <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default QFModule;
