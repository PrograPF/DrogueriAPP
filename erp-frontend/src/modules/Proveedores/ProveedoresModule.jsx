import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Plus, Search, Edit2, Trash2, X, Save, Phone, Mail, MapPin, Building2, Hash } from 'lucide-react';

const ProveedoresModule = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const formVacio = { rut: '', nombre_proveedor: '', telefono_contacto: '', correo: '', direccion: '' };
  const [form, setForm] = useState(formVacio);

  const cargarProveedores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_proveedor', { ascending: true });
    if (!error) setProveedores(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargarProveedores(); }, [cargarProveedores]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formVacio);
    setError('');
    setShowModal(true);
  };

  const abrirEditar = (prov) => {
    setEditando(prov);
    setForm({
      rut: prov.rut || '',
      nombre_proveedor: prov.nombre_proveedor || '',
      telefono_contacto: prov.telefono_contacto || '',
      correo: prov.correo || '',
      direccion: prov.direccion || '',
    });
    setError('');
    setShowModal(true);
  };

  const cerrarModal = () => { setShowModal(false); setEditando(null); setForm(formVacio); setError(''); };

  const guardar = async () => {
    if (!form.rut.trim() || !form.nombre_proveedor.trim()) {
      setError('RUT y Nombre del proveedor son obligatorios.');
      return;
    }
    setGuardando(true);
    setError('');
    if (editando) {
      const { error } = await supabase.from('proveedores').update(form).eq('id', editando.id);
      if (error) { setError('Error al actualizar: ' + error.message); setGuardando(false); return; }
    } else {
      const { error } = await supabase.from('proveedores').insert([form]);
      if (error) { setError('Error al guardar: ' + error.message); setGuardando(false); return; }
    }
    setGuardando(false);
    cerrarModal();
    cargarProveedores();
  };

  const eliminar = async (id) => {
    await supabase.from('proveedores').delete().eq('id', id);
    setConfirmDelete(null);
    cargarProveedores();
  };

  const filtrados = proveedores.filter(p =>
    p.nombre_proveedor?.toLowerCase().includes(search.toLowerCase()) ||
    p.rut?.toLowerCase().includes(search.toLowerCase())
  );

  const s = {
    container: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' },
    title: { fontSize: '1.8rem', fontWeight: '800', color: '#f1f5f9', margin: 0 },
    subtitle: { color: '#64748b', fontSize: '0.9rem', marginTop: '4px' },
    btnPrimary: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'opacity 0.2s' },
    searchBar: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', width: '100%', maxWidth: '420px' },
    searchInput: { background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.9rem', flex: 1 },
    table: { width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' },
    th: { padding: '13px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' },
    td: { padding: '14px 16px', color: '#cbd5e1', fontSize: '0.88rem', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    tdName: { padding: '14px 16px', color: '#f1f5f9', fontSize: '0.92rem', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    btnIcon: { padding: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.2s', marginLeft: '6px' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modal: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' },
    modalTitle: { fontSize: '1.3rem', fontWeight: '700', color: '#f1f5f9', marginBottom: '24px' },
    label: { display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' },
    inputGroup: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' },
    input: { background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.9rem', flex: 1 },
    modalBtns: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' },
    btnSecondary: { padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#94a3b8', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },
    errorMsg: { color: '#f87171', fontSize: '0.82rem', marginTop: '-8px', marginBottom: '12px' },
    emptyState: { textAlign: 'center', padding: '60px 20px', color: '#475569' },
    badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', background: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Proveedores</h2>
          <p style={s.subtitle}>{proveedores.length} proveedores registrados</p>
        </div>
        <button style={s.btnPrimary} onClick={abrirNuevo}>
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#64748b" />
        <input
          style={s.searchInput}
          placeholder="Buscar por nombre o RUT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={s.emptyState}>Cargando proveedores...</div>
      ) : filtrados.length === 0 ? (
        <div style={s.emptyState}>
          <Building2 size={48} color="#334155" style={{ marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>No se encontraron proveedores.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>RUT</th>
                <th style={s.th}>Nombre Proveedor</th>
                <th style={s.th}>Teléfono</th>
                <th style={s.th}>Correo</th>
                <th style={s.th}>Dirección</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} style={{ transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={s.td}><span style={s.badge}>{p.rut}</span></td>
                  <td style={s.tdName}>{p.nombre_proveedor}</td>
                  <td style={s.td}>{p.telefono_contacto || <span style={{ color: '#334155' }}>—</span>}</td>
                  <td style={s.td}>{p.correo || <span style={{ color: '#334155' }}>—</span>}</td>
                  <td style={s.td}>{p.direccion || <span style={{ color: '#334155' }}>—</span>}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <button style={s.btnIcon} title="Editar" onClick={() => abrirEditar(p)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#3b82f6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94a3b8'; }}>
                      <Edit2 size={15} />
                    </button>
                    <button style={s.btnIcon} title="Eliminar" onClick={() => setConfirmDelete(p)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94a3b8'; }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuevo / Editar */}
      {showModal && (
        <div style={s.overlay} onClick={cerrarModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={s.modalTitle}>{editando ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <label style={s.label}>RUT *</label>
            <div style={s.inputGroup}>
              <Hash size={16} color="#64748b" />
              <input style={s.input} placeholder="12.345.678-9" value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} />
            </div>

            <label style={s.label}>Nombre Proveedor *</label>
            <div style={s.inputGroup}>
              <Building2 size={16} color="#64748b" />
              <input style={s.input} placeholder="Ej: Laboratorio Chile S.A." value={form.nombre_proveedor} onChange={e => setForm({ ...form, nombre_proveedor: e.target.value })} />
            </div>

            <label style={s.label}>Teléfono Contacto</label>
            <div style={s.inputGroup}>
              <Phone size={16} color="#64748b" />
              <input style={s.input} placeholder="+56 9 1234 5678" value={form.telefono_contacto} onChange={e => setForm({ ...form, telefono_contacto: e.target.value })} />
            </div>

            <label style={s.label}>Correo</label>
            <div style={s.inputGroup}>
              <Mail size={16} color="#64748b" />
              <input style={s.input} placeholder="contacto@proveedor.cl" type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} />
            </div>

            <label style={s.label}>Dirección</label>
            <div style={s.inputGroup}>
              <MapPin size={16} color="#64748b" />
              <input style={s.input} placeholder="Av. Ejemplo 1234, Santiago" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
            </div>

            {error && <p style={s.errorMsg}>⚠ {error}</p>}

            <div style={s.modalBtns}>
              <button style={s.btnSecondary} onClick={cerrarModal}>Cancelar</button>
              <button style={s.btnPrimary} onClick={guardar} disabled={guardando}>
                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...s.modal, maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ ...s.modalTitle, color: '#f87171' }}>¿Eliminar proveedor?</h3>
            <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
              Se eliminará <strong style={{ color: '#f1f5f9' }}>{confirmDelete.nombre_proveedor}</strong> permanentemente. Esta acción no se puede deshacer.
            </p>
            <div style={s.modalBtns}>
              <button style={s.btnSecondary} onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button style={{ ...s.btnPrimary, background: 'linear-gradient(135deg,#ef4444,#dc2626)' }} onClick={() => eliminar(confirmDelete.id)}>
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProveedoresModule;
