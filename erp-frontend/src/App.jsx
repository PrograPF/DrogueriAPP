import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FilePlus, Settings, LogOut, PackageSearch, Menu, X, ClipboardCheck, Truck, ClipboardList, Sun, Moon, FileText } from 'lucide-react';
import PendientesDiferenciasModule from './modules/Pendientes/PendientesDiferenciasModule';
import RevisionBodegaModule from './modules/RevisionBodega/RevisionBodegaModule';
import ConfigModule from './modules/Config/ConfigModule';
import SeguimientoOCModule from './modules/SeguimientoOC/SeguimientoOCModule';
import RecepcionArticulosModule from './modules/RecepcionArticulos/RecepcionArticulosModule';
import InventarioModule from './modules/Inventario/InventarioModule';
import QFModule from './modules/QF/QFModule';

const SidebarItem = ({ icon: Icon, label, to, onClick }) => {
  const location = useLocation();
  const active = location.pathname === to;
  
  return (
    <Link to={to} onClick={onClick} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px', 
      padding: '12px 20px', 
      color: active ? '#3b82f6' : 'var(--text-secondary)', 
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-container">
      {/* Sidebar Overlay (Mobile) */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={closeSidebar}
      />

      {/* Mobile Header */}
      <div className="mobile-header no-print">
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#3b82f6', margin: 0 }}>
          DrogueriAPP
        </h2>
        <button 
          onClick={toggleSidebar}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'white', 
            cursor: 'pointer',
            padding: '5px'
          }}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''} no-print`}>
        <div style={{ marginBottom: '40px', padding: '0 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '-1px', margin: 0 }}>
            DrogueriAPP <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.8rem' }}>v1.0</span>
          </h1>
          <button 
            className="mobile-only"
            onClick={closeSidebar}
            style={{ display: 'none', background: 'none', border: 'none', color: '#94a3b8' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <SidebarItem icon={FilePlus} label="Diferencias de Inventario" to="/" onClick={closeSidebar} />
          <SidebarItem icon={FileText} label="Módulo QF" to="/qf" onClick={closeSidebar} />
          <SidebarItem icon={Truck} label="Seguimiento OC" to="/seguimiento-oc" onClick={closeSidebar} />
          <SidebarItem icon={ClipboardList} label="Recepción Artículos" to="/recepcion" onClick={closeSidebar} />
          <SidebarItem icon={ClipboardCheck} label="Revisión Bodega" to="/revision" onClick={closeSidebar} />
          <SidebarItem icon={PackageSearch} label="Inventario" to="/inventario" onClick={closeSidebar} />
          <SidebarItem icon={Settings} label="Configuración" to="/config" onClick={closeSidebar} />
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '20px' }}>
          <SidebarItem icon={LogOut} label="Cerrar Sesión" to="/logout" onClick={closeSidebar} />
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="no-print" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>¡Hola, Pablo!</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Bienvenido al sistema de control de stock.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button 
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              style={{
                background: theme === 'light' ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: '#3b82f6', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 'bold',
              color: '#f8fafc',
              flexShrink: 0
            }}>P</div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<PendientesDiferenciasModule />} />
          <Route path="/qf" element={<QFModule />} />
          <Route path="/revision" element={<RevisionBodegaModule />} />
          <Route path="/seguimiento-oc" element={<SeguimientoOCModule />} />
          <Route path="/recepcion" element={<RecepcionArticulosModule />} />
          <Route path="/dashboard" element={<div style={{ padding: '20px' }}>Próximamente: Dashboard de Jefatura</div>} />
          <Route path="/inventario" element={<InventarioModule />} />
          <Route path="/config" element={<ConfigModule />} />
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
