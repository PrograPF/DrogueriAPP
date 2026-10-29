import React from 'react';
import { motion } from 'framer-motion';
import { Pill, Activity, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QFModule = () => {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      style={{ maxWidth: '900px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '30px' }}
    >
      {/* Encabezado del Módulo QF */}
      <div style={{ textAlign: 'center' }}>
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
          <Sparkles size={16} /> Módulo Preparado para Nuevas Herramientas
        </div>
        <h2 style={{ fontSize: '2.4rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
          Módulo Químico Farmacéutico (QF)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '10px', lineHeight: '1.6' }}>
          Espacio exclusivo para las funciones técnicas, clínicas y de control farmacéutico.
        </p>
      </div>

      {/* Tarjeta de Estado del Módulo */}
      <div 
        className="glass-card"
        style={{
          padding: '40px',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '22px',
          background: 'var(--bg-card)'
        }}
      >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <Pill size={42} color="#3b82f6" />
        </div>

        <div style={{ maxWidth: '580px' }}>
          <h3 style={{ fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
            Área de Trabajo QF Liberada
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
            La herramienta de <strong>Solicitudes de Compra</strong> y todo su flujo operativo han sido traspasados al módulo <strong>Seguimiento OC</strong> para la gestión del equipo de compras y bodega.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.6', marginTop: '12px' }}>
            Este espacio queda reservado y listo para comenzar con el desarrollo de las nuevas funcionalidades que solicites.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
          <button
            onClick={() => navigate('/seguimiento-oc')}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}
          >
            Ir a Gestión de OC y Solicitudes <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default QFModule;
