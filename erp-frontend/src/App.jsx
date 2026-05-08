import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus, Settings, LogOut, PackageSearch } from 'lucide-react';
import PendientesDiferenciasModule from './modules/Pendientes/PendientesDiferenciasModule';
import InformesModule from './modules/Informes/InformesModule';

const SidebarItem = ({ icon: Icon, label, to }) => {
  const location = useLocation();
  const active = location.pathname === to;
  
  return (
    <Link to={to} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px', 
      padding: '12px 20px', 
      color: active ? '#3b82f6' : '#94a3b8', 
      textDecoration: 'none',
      background: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
      borderRadius: '12px',
      transition: 'all 0.3s ease',
      marginBottom: '8px'
    }}>
      <Icon size={20} />
      <span style={{ fontWeight: '500' }}>{label}</span>
    </Link>
  );
};

const AppContent = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ 
        width: '280px', 
        background: 'rgba(30, 41, 59, 0.5)', 
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '40px', padding: '0 10px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '-1px' }}>
            DrogueriAPP <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.8rem' }}>v1.0</span>
          </h1>
        </div>

        <div style={{ flex: 1 }}>
          <SidebarItem icon={FilePlus} label="Pendientes/Diferencias" to="/" />
          <SidebarItem icon={LayoutDashboard} label="Módulo Informes" to="/informes" />
          <SidebarItem icon={PackageSearch} label="Inventario" to="/inventario" />
          <SidebarItem icon={Settings} label="Configuración" to="/config" />
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '20px' }}>
          <SidebarItem icon={LogOut} label="Cerrar Sesión" to="/logout" />
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px', background: 'radial-gradient(circle at top right, #1e293b 0%, #0f172a 100%)', overflowY: 'auto' }}>
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: '#94a3b8' }}>¡Hola, Pablo!</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Bienvenido al sistema de control de stock.</p>
          </div>
          <div style={{ width: '40px', height: '40px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>P</div>
        </header>

        <Routes>
          <Route path="/" element={<PendientesDiferenciasModule />} />
          <Route path="/informes" element={<InformesModule />} />
          <Route path="/dashboard" element={<div style={{ padding: '20px' }}>Próximamente: Dashboard de Jefatura</div>} />
          <Route path="/inventario" element={<div style={{ padding: '20px' }}>Módulo de Inventario en desarrollo...</div>} />
          <Route path="/config" element={<div style={{ padding: '20px' }}>Configuración del sistema</div>} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
