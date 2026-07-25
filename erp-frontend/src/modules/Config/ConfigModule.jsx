import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, MapPin, Search, Database, AlertTriangle, List, Calendar, DollarSign, Info, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import ProveedoresModule from '../Proveedores/ProveedoresModule';
import { formatDate } from '../../utils/dateFormatter';

const ConfigModule = () => {
  // Tabs State: 'centros', 'catalog', or 'categories'
  const [activeTab, setActiveTab] = useState('centros');

  // ==========================================
  // ESTADO: GESTIÓN DE CENTROS
  // ==========================================
  const [centros, setCentros] = useState([]);
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [editingCentroId, setEditingCentroId] = useState(null);
  const [editCentroValue, setEditCentroValue] = useState('');
  const [newCentro, setNewCentro] = useState('');

  // ==========================================
  // ESTADO: GESTIÓN DE CENTROS DE COSTO
  // ==========================================
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [loadingCentrosCosto, setLoadingCentrosCosto] = useState(true);
  const [editingCentroCostoId, setEditingCentroCostoId] = useState(null);
  const [editCentroCostoValue, setEditCentroCostoValue] = useState('');
  const [newCentroCosto, setNewCentroCosto] = useState('');

  // ==========================================
  // ESTADO: GESTIÓN DE CATEGORÍAS
  // ==========================================
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // ==========================================
  // ESTADO: GESTIÓN DE CATÁLOGO (ARTÍCULOS MAESTROS)
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Estado del Modal de Artículos
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [articleModalMode, setArticleModalMode] = useState('add'); // 'add' o 'edit'
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Estado del Formulario de Artículos
  const [formCodigo, setFormCodigo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoriaId, setFormCategoriaId] = useState('');

  // ==========================================
  // ESTADO: GESTIÓN DE VARIANTES (LOTES / PRECIOS)
  // ==========================================
  const [isVariantManagerOpen, setIsVariantManagerOpen] = useState(false);
  const [selectedArticleForVariants, setSelectedArticleForVariants] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Estado del Modal de Variante (Agregar/Editar)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantModalMode, setVariantModalMode] = useState('add'); // 'add' o 'edit'
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Estado del Formulario de Variante
  const [formLote, setFormLote] = useState('S/L');
  const [formVencimiento, setFormVencimiento] = useState('');
  const [formCantidad, setFormCantidad] = useState(0);
  const [formCartaCanje, setFormCartaCanje] = useState('NO');
  const [formEstado, setFormEstado] = useState('VIGENTE');
  const [formComentario, setFormComentario] = useState('');
  const [formValorSinIva, setFormValorSinIva] = useState(0);
  const [formValorConIva, setFormValorConIva] = useState(0);
  const [formTotalSinIva, setFormTotalSinIva] = useState(0);
  const [formTotalConIva, setFormTotalConIva] = useState(0);
  const [formIsp, setFormIsp] = useState('S/I');
  const [formFechaIngreso, setFormFechaIngreso] = useState('');
  const [formFechaSalida, setFormFechaSalida] = useState('');

  // ==========================================
  // EFECTOS INICIALES
  // ==========================================
  useEffect(() => {
    fetchCentros();
    fetchCentrosCosto();
    fetchCategories();
  }, []);

  // Búsqueda con Debounce para el catálogo
  useEffect(() => {
    if (activeTab !== 'catalog') return;
    if (!searchTerm.trim()) {
      setCatalogItems([]);
      setHasSearched(false);
      return;
    }

    const handler = setTimeout(() => {
      handleSearchSilent();
    }, 450);

    return () => clearTimeout(handler);
  }, [searchTerm, activeTab]);

  // ==========================================
  // MÉTODOS: CENTROS DE SALUD
  // ==========================================
  const fetchCentros = async () => {
    setLoadingCentros(true);
    try {
      const { data, error } = await supabase
        .from('centros')
        .select('*')
        .order('nombre');
      if (error) throw error;
      setCentros(data || []);
    } catch (err) {
      console.error('Error al cargar centros:', err);
    } finally {
      setLoadingCentros(false);
    }
  };

  const handleAddCentro = async () => {
    if (!newCentro.trim()) {
      alert('Por favor, escribe el nombre del centro en la casilla de texto antes de hacer clic en Añadir Centro.');
      return;
    }
    try {
      const { error } = await supabase
        .from('centros')
        .insert([{ nombre: newCentro.toUpperCase().trim() }]);
      if (error) throw error;
      setNewCentro('');
      fetchCentros();
    } catch (err) {
      alert('Error al añadir centro: ' + err.message);
    }
  };

  const handleUpdateCentro = async (id) => {
    if (!editCentroValue.trim()) return;
    try {
      const { error } = await supabase
        .from('centros')
        .update({ nombre: editCentroValue.toUpperCase().trim() })
        .eq('id', id);
      if (error) throw error;
      setEditingCentroId(null);
      fetchCentros();
    } catch (err) {
      alert('Error al actualizar centro: ' + err.message);
    }
  };

  const handleDeleteCentro = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el centro "${nombre}"? Esta acción podría afectar registros históricos.`)) return;
    try {
      const { error } = await supabase.from('centros').delete().eq('id', id);
      if (error) throw error;
      fetchCentros();
    } catch (err) {
      alert('Error al eliminar centro: ' + err.message);
    }
  };

  // ==========================================
  // MÉTODOS: CENTROS DE COSTO
  // ==========================================
  const fetchCentrosCosto = async () => {
    setLoadingCentrosCosto(true);
    try {
      const { data, error } = await supabase
        .from('centros_costo')
        .select('*')
        .order('nombre');
      if (error) throw error;
      setCentrosCosto(data || []);
    } catch (err) {
      console.error('Error al cargar centros de costo:', err);
    } finally {
      setLoadingCentrosCosto(false);
    }
  };

  const handleAddCentroCosto = async () => {
    if (!newCentroCosto.trim()) {
      alert('Por favor, escribe el nombre del centro de costo antes de hacer clic en Añadir.');
      return;
    }
    try {
      const { error } = await supabase
        .from('centros_costo')
        .insert([{ nombre: newCentroCosto.toUpperCase().trim() }]);
      if (error) throw error;
      setNewCentroCosto('');
      fetchCentrosCosto();
    } catch (err) {
      alert('Error al añadir centro de costo: ' + err.message);
    }
  };

  const handleUpdateCentroCosto = async (id) => {
    if (!editCentroCostoValue.trim()) return;
    try {
      const { error } = await supabase
        .from('centros_costo')
        .update({ nombre: editCentroCostoValue.toUpperCase().trim() })
        .eq('id', id);
      if (error) throw error;
      setEditingCentroCostoId(null);
      fetchCentrosCosto();
    } catch (err) {
      alert('Error al actualizar centro de costo: ' + err.message);
    }
  };

  const handleDeleteCentroCosto = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el centro de costo "${nombre}"?`)) return;
    try {
      const { error } = await supabase.from('centros_costo').delete().eq('id', id);
      if (error) throw error;
      fetchCentrosCosto();
    } catch (err) {
      alert('Error al eliminar centro de costo: ' + err.message);
    }
  };

  // ==========================================
  // MÉTODOS: CATEGORÍAS
  // ==========================================
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre');
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Por favor, escribe el nombre de la categoría en la casilla de texto antes de hacer clic en Añadir Categoría.');
      return;
    }
    try {
      const { error } = await supabase
        .from('categorias')
        .insert([{ nombre: newCategoryName.toUpperCase().trim() }]);
      if (error) throw error;
      setNewCategoryName('');
      fetchCategories();
    } catch (err) {
      alert('Error al añadir categoría: ' + err.message);
    }
  };

  const handleUpdateCategory = async (id) => {
    if (!editCategoryValue.trim()) return;
    try {
      const { error } = await supabase
        .from('categorias')
        .update({ nombre: editCategoryValue.toUpperCase().trim() })
        .eq('id', id);
      if (error) throw error;
      setEditingCategoryId(null);
      fetchCategories();
    } catch (err) {
      alert('Error al actualizar categoría: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la categoría "${nombre}"?`)) return;
    try {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
      fetchCategories();
    } catch (err) {
      alert('Error al eliminar categoría: ' + err.message);
    }
  };

  // ==========================================
  // MÉTODOS: CATÁLOGO DE ARTÍCULOS
  // ==========================================
  const handleSearchManual = () => {
    handleSearchSilent();
  };

  const handleSearchSilent = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setLoadingCatalog(true);
    setHasSearched(true);
    try {
      // Hacer select trayendo la relación de categorias
      const { data, error } = await supabase
        .from('articulos')
        .select(`
          *,
          categorias (
            nombre
          )
        `)
        .or(`codigo.ilike.%${term}%,descripcion.ilike.%${term}%`)
        .order('descripcion')
        .limit(50);

      if (error) throw error;
      setCatalogItems(data || []);
    } catch (err) {
      console.error('Error al realizar búsqueda de artículos:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Modales de Artículo
  const handleOpenAddArticleModal = () => {
    setArticleModalMode('add');
    setSelectedArticle(null);
    setFormCodigo('');
    setFormDescripcion('');
    setFormCategoriaId(categories[0]?.id || '');
    setIsArticleModalOpen(true);
  };

  const handleOpenEditArticleModal = (item) => {
    setArticleModalMode('edit');
    setSelectedArticle(item);
    setFormCodigo(item.codigo || '');
    setFormDescripcion(item.descripcion || '');
    setFormCategoriaId(item.categoria_id || '');
    setIsArticleModalOpen(true);
  };

  const handleSaveArticle = async () => {
    if (!formCodigo.trim()) {
      alert('El código es obligatorio.');
      return;
    }
    if (!formDescripcion.trim()) {
      alert('La descripción es obligatoria.');
      return;
    }

    const payload = {
      codigo: formCodigo.trim().toUpperCase(),
      descripcion: formDescripcion.trim().toUpperCase(),
      categoria_id: formCategoriaId ? parseInt(formCategoriaId) : null
    };

    try {
      if (articleModalMode === 'add') {
        // Verificar duplicidad
        const { data: dup } = await supabase
          .from('articulos')
          .select('codigo')
          .eq('codigo', payload.codigo)
          .maybeSingle();

        if (dup) {
          alert(`El código "${payload.codigo}" ya está registrado.`);
          return;
        }

        const { error } = await supabase
          .from('articulos')
          .insert([payload]);
        if (error) throw error;
        alert('Artículo creado correctamente.');
      } else {
        const { error } = await supabase
          .from('articulos')
          .update({
            descripcion: payload.descripcion,
            categoria_id: payload.categoria_id
          })
          .eq('codigo', selectedArticle.codigo);
        if (error) throw error;
        alert('Artículo actualizado correctamente.');
      }
      setIsArticleModalOpen(false);
      handleSearchSilent();
    } catch (err) {
      alert('Error al guardar artículo: ' + err.message);
    }
  };

  const handleDeleteArticle = async (item) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el artículo "${item.descripcion}" (${item.codigo})? Esto eliminará todos sus lotes e inventarios asociados.`)) return;
    try {
      const { error } = await supabase
        .from('articulos')
        .delete()
        .eq('codigo', item.codigo);
      if (error) throw error;
      alert('Artículo eliminado.');
      handleSearchSilent();
    } catch (err) {
      alert('Error al eliminar artículo: ' + err.message);
    }
  };

  // ==========================================
  // MÉTODOS: GESTIÓN DE VARIANTES (LOTES / PRECIOS)
  // ==========================================
  const handleOpenVariantManager = async (article) => {
    setSelectedArticleForVariants(article);
    setIsVariantManagerOpen(true);
    await fetchVariants(article.codigo);
  };

  const fetchVariants = async (codigoArticulo) => {
    setLoadingVariants(true);
    try {
      const { data, error } = await supabase
        .from('articulos_variantes')
        .select('*')
        .eq('codigo_articulo', codigoArticulo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setVariants(data || []);
    } catch (err) {
      console.error('Error al cargar variantes:', err);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Cálculos de IVA y Totales automáticos
  const handleCantidadChange = (val) => {
    const qty = parseInt(val) || 0;
    setFormCantidad(qty);
    setFormTotalSinIva(qty * (parseFloat(formValorSinIva) || 0));
    setFormTotalConIva(qty * (parseFloat(formValorConIva) || 0));
  };

  const handleValorSinIvaChange = (val) => {
    const vSin = parseFloat(val) || 0;
    setFormValorSinIva(vSin);
    const vCon = Math.round(vSin * 1.19);
    setFormValorConIva(vCon);
    setFormTotalSinIva(formCantidad * vSin);
    setFormTotalConIva(formCantidad * vCon);
  };

  const handleValorConIvaChange = (val) => {
    const vCon = parseFloat(val) || 0;
    setFormValorConIva(vCon);
    const vSin = Math.round((vCon / 1.19) * 100) / 100;
    setFormValorSinIva(vSin);
    setFormTotalSinIva(formCantidad * vSin);
    setFormTotalConIva(formCantidad * vCon);
  };

  const handleOpenAddVariantModal = () => {
    setVariantModalMode('add');
    setSelectedVariant(null);
    setFormLote('S/L');
    setFormVencimiento('');
    setFormCantidad(0);
    setFormCartaCanje('NO');
    setFormEstado('VIGENTE');
    setFormComentario('');
    setFormValorSinIva(0);
    setFormValorConIva(0);
    setFormTotalSinIva(0);
    setFormTotalConIva(0);
    setFormIsp('S/I');
    setFormFechaIngreso(new Date().toISOString().split('T')[0]);
    setFormFechaSalida('');
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariantModal = (variant) => {
    setVariantModalMode('edit');
    setSelectedVariant(variant);
    setFormLote(variant.lote || 'S/L');
    setFormVencimiento(variant.vencimiento || '');
    setFormCantidad(variant.cantidad || 0);
    setFormCartaCanje(variant.carta_canje || 'NO');
    setFormEstado(variant.estado || 'VIGENTE');
    setFormComentario(variant.comentario || '');
    setFormValorSinIva(variant.ultimo_valor_sin_iva || 0);
    setFormValorConIva(variant.ultimo_valor_con_iva || 0);
    setFormTotalSinIva(variant.total_sin_iva || 0);
    setFormTotalConIva(variant.total_con_iva || 0);
    setFormIsp(variant.isp || 'S/I');
    setFormFechaIngreso(variant.fecha_ingreso || '');
    setFormFechaSalida(variant.fecha_salida || '');
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = async () => {
    const payload = {
      codigo_articulo: selectedArticleForVariants.codigo,
      lote: formLote.trim().toUpperCase(),
      vencimiento: formVencimiento || null,
      cantidad: parseInt(formCantidad) || 0,
      carta_canje: formCartaCanje.trim().toUpperCase(),
      estado: formEstado.trim().toUpperCase(),
      comentario: formComentario.trim(),
      ultimo_valor_sin_iva: parseFloat(formValorSinIva) || 0,
      ultimo_valor_con_iva: parseFloat(formValorConIva) || 0,
      total_sin_iva: parseFloat(formTotalSinIva) || 0,
      total_con_iva: parseFloat(formTotalConIva) || 0,
      isp: formIsp.trim().toUpperCase() || 'S/I',
      fecha_ingreso: formFechaIngreso || null,
      fecha_salida: formFechaSalida || null
    };

    try {
      if (variantModalMode === 'add') {
        const { error } = await supabase
          .from('articulos_variantes')
          .insert([payload]);
        if (error) throw error;
        alert('Variante de inventario agregada.');
      } else {
        const { error } = await supabase
          .from('articulos_variantes')
          .update(payload)
          .eq('id', selectedVariant.id);
        if (error) throw error;
        alert('Variante de inventario actualizada.');
      }
      setIsVariantModalOpen(false);
      fetchVariants(selectedArticleForVariants.codigo);
    } catch (err) {
      alert('Error al guardar variante: ' + err.message);
    }
  };

  const handleDeleteVariant = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta variante de inventario (lote/precios)?')) return;
    try {
      const { error } = await supabase
        .from('articulos_variantes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Variante de inventario eliminada.');
      fetchVariants(selectedArticleForVariants.codigo);
    } catch (err) {
      alert('Error al eliminar variante: ' + err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      style={{ maxWidth: '1000px', margin: '0 auto' }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Settings size={32} color="#3b82f6" />
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Configuración del Catálogo</h2>
            <p style={{ color: '#94a3b8' }}>Mantenimiento relacional de artículos, lotes, precios y categorías.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '30px', 
        borderBottom: '1px solid rgba(255,255,255,0.06)', 
        paddingBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={() => setActiveTab('centros')}
          className={activeTab === 'centros' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MapPin size={18} /> Centros de Salud
        </button>
        <button 
          onClick={() => setActiveTab('centros_costo')}
          className={activeTab === 'centros_costo' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <DollarSign size={18} /> Centros de Costo
        </button>
        <button 
          onClick={() => setActiveTab('catalog')}
          className={activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Database size={18} /> Artículos (Código Maestro)
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <List size={18} /> Categorías
        </button>
        <button 
          onClick={() => setActiveTab('proveedores')}
          className={activeTab === 'proveedores' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Building2 size={18} /> Proveedores
        </button>
      </div>

      {/* ==========================================
          VISTA: GESTIÓN DE CENTROS
          ========================================== */}
      {activeTab === 'centros' && (
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
            <MapPin size={22} color="#3b82f6" /> Gestión de Centros de Salud
          </h3>

          {/* Formulario Añadir Centro */}
          <div className="btn-group-responsive" style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <input 
              type="text" 
              placeholder="Nombre del nuevo centro..." 
              className="input-field"
              value={newCentro}
              onChange={(e) => setNewCentro(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCentro()}
            />
            <button onClick={handleAddCentro} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={20} /> Añadir Centro
            </button>
          </div>

          {/* Lista de Centros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingCentros ? (
              <p style={{ color: '#94a3b8' }}>Cargando centros...</p>
            ) : centros.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay centros de salud registrados.</p>
            ) : (
              centros.map(centro => (
                <div key={centro.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {editingCentroId === centro.id ? (
                    <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                      <input 
                        className="input-field" 
                        value={editCentroValue} 
                        onChange={(e) => setEditCentroValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateCentro(centro.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Save size={20} />
                      </button>
                      <button onClick={() => setEditingCentroId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: '500' }}>{centro.nombre}</span>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                          onClick={() => { setEditingCentroId(centro.id); setEditCentroValue(centro.nombre); }}
                          style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCentro(centro.id, centro.nombre)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {/* ==========================================
          VISTA: GESTIÓN DE CENTROS DE COSTO
          ========================================== */}
      {activeTab === 'centros_costo' && (
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
            <DollarSign size={22} color="#3b82f6" /> Gestión de Centros de Costo
          </h3>

          {/* Formulario Añadir Centro de Costo */}
          <div className="btn-group-responsive" style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <input 
              type="text" 
              placeholder="Nombre del nuevo centro de costo..." 
              className="input-field"
              value={newCentroCosto}
              onChange={(e) => setNewCentroCosto(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCentroCosto()}
            />
            <button onClick={handleAddCentroCosto} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={20} /> Añadir Centro de Costo
            </button>
          </div>

          {/* Lista de Centros de Costo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingCentrosCosto ? (
              <p style={{ color: '#94a3b8' }}>Cargando centros de costo...</p>
            ) : centrosCosto.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay centros de costo registrados.</p>
            ) : (
              centrosCosto.map(cc => (
                <div key={cc.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {editingCentroCostoId === cc.id ? (
                    <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                      <input 
                        className="input-field" 
                        value={editCentroCostoValue} 
                        onChange={(e) => setEditCentroCostoValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateCentroCosto(cc.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Save size={20} />
                      </button>
                      <button onClick={() => setEditingCentroCostoId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: '500' }}>{cc.nombre}</span>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                          onClick={() => { setEditingCentroCostoId(cc.id); setEditCentroCostoValue(cc.nombre); }}
                          style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCentroCosto(cc.id, cc.nombre)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          VISTA: GESTIÓN DE CATEGORÍAS
          ========================================== */}
      {activeTab === 'categories' && (
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}>
            <List size={22} color="#3b82f6" /> Gestión de Categorías de Artículos
          </h3>

          {/* Formulario Añadir Categoría */}
          <div className="btn-group-responsive" style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <input 
              type="text" 
              placeholder="Nombre de la nueva categoría (Ej: FARMACOS)..." 
              className="input-field"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button onClick={handleAddCategory} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={20} /> Añadir Categoría
            </button>
          </div>

          {/* Lista de Categorías */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingCategories ? (
              <p style={{ color: '#94a3b8' }}>Cargando categorías...</p>
            ) : categories.length === 0 ? (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay categorías registradas.</p>
            ) : (
              categories.map(cat => (
                <div key={cat.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {editingCategoryId === cat.id ? (
                    <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                      <input 
                        className="input-field" 
                        value={editCategoryValue} 
                        onChange={(e) => setEditCategoryValue(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateCategory(cat.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Save size={20} />
                      </button>
                      <button onClick={() => setEditingCategoryId(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: '500' }}>{cat.nombre}</span>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <button 
                          onClick={() => { setEditingCategoryId(cat.id); setEditCategoryValue(cat.nombre); }}
                          style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id, cat.nombre)}
                          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          VISTA: GESTIÓN DE PROVEEDORES
          ========================================== */}
      {activeTab === 'proveedores' && (
        <ProveedoresModule />
      )}

      {/* ==========================================
          VISTA: GESTIÓN DE CATÁLOGO (ARTÍCULOS MAESTROS)
          ========================================== */}
      {activeTab === 'catalog' && (
        <div className="glass-card" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', margin: 0 }}>
              <Database size={22} color="#3b82f6" /> Catálogo de Artículos Maestros
            </h3>
            <button 
              onClick={handleOpenAddArticleModal} 
              className="btn-primary" 
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <Plus size={18} /> Registrar Nuevo Código
            </button>
          </div>

          {/* Caja de Búsqueda */}
          <div className="btn-group-responsive" style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Buscar por código o descripción de artículo..." 
                className="input-field"
                style={{ paddingLeft: '45px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchManual()}
              />
            </div>
            <button onClick={handleSearchManual} className="btn-primary" style={{ minWidth: '120px' }}>
              Buscar
            </button>
          </div>

          {/* Resultados de la Búsqueda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loadingCatalog ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Buscando coincidencias en base de datos...</p>
            ) : !hasSearched ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <Search size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                <p>Escribe en el buscador el código o la descripción del artículo para comenzar.</p>
              </div>
            ) : catalogItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ef4444', border: '1px dashed rgba(239, 68, 68, 0.15)', borderRadius: '12px' }}>
                <AlertTriangle size={32} style={{ marginBottom: '10px', opacity: 0.8 }} />
                <p>No se encontraron artículos con el término ingresado.</p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '10px' }}>
                  Mostrando {catalogItems.length} resultados coincidentes (máx 50):
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {catalogItems.map((item) => (
                    <div 
                      key={item.codigo}
                      style={{
                        padding: '16px 20px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ 
                              background: 'rgba(59, 130, 246, 0.15)', 
                              color: '#3b82f6', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              fontWeight: '700',
                              fontSize: '0.85rem'
                            }}>
                              Código: {item.codigo}
                            </span>
                            {item.categorias?.nombre && (
                              <span style={{ 
                                background: 'rgba(16, 185, 129, 0.12)', 
                                color: '#10b981', 
                                padding: '2px 8px', 
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {item.categorias.nombre}
                              </span>
                            )}
                          </div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                            {item.descripcion}
                          </h4>
                        </div>

                        {/* Botonera de Acciones en el Catálogo */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => handleOpenVariantManager(item)}
                            className="btn-primary"
                            style={{ 
                              padding: '8px 12px', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                            }}
                          >
                            <Database size={14} /> Lotes y Precios
                          </button>
                          <button 
                            onClick={() => handleOpenEditArticleModal(item)}
                            className="btn-secondary"
                            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Edit2 size={14} /> Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteArticle(item)}
                            className="btn-secondary"
                            style={{ 
                              padding: '8px 12px', 
                              borderRadius: '8px', 
                              fontSize: '0.8rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '5px',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.2)'
                            }}
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CREAR / EDITAR ARTÍCULO
          ========================================== */}
      <AnimatePresence>
        {isArticleModalOpen && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
            onClick={() => setIsArticleModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px', width: '100%', maxWidth: '550px',
                padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsArticleModalOpen(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={22} color="#3b82f6" /> 
                {articleModalMode === 'add' ? 'Registrar Artículo Maestro' : 'Editar Artículo Maestro'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Código del Artículo</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    disabled={articleModalMode === 'edit'}
                    placeholder="Ej: 1373, 5, 8, etc."
                    style={{ textTransform: 'uppercase', background: articleModalMode === 'edit' ? 'rgba(0,0,0,0.2)' : undefined }}
                  />
                  {articleModalMode === 'edit' && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px', display: 'block' }}>El código de artículo no se puede modificar.</span>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Categoría</label>
                  <select 
                    className="input-field"
                    value={formCategoriaId}
                    onChange={(e) => setFormCategoriaId(e.target.value)}
                  >
                    <option value="">-- Sin Categoría --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Descripción del Artículo</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formDescripcion}
                    onChange={(e) => setFormDescripcion(e.target.value)}
                    placeholder="Ej: PARACETAMOL 500 MG COMPRIMIDO"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '10px' }}>
                  <button onClick={() => setIsArticleModalOpen(false)} className="btn-secondary">Cancelar</button>
                  <button onClick={handleSaveArticle} className="btn-primary">
                    <Save size={18} /> Guardar Artículo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: GESTOR DE VARIANTES DE INVENTARIO
          ========================================== */}
      <AnimatePresence>
        {isVariantManagerOpen && selectedArticleForVariants && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 900, padding: '20px'
            }}
            onClick={() => setIsVariantManagerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              style={{
                background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px', width: '100%', maxWidth: '850px',
                padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                position: 'relative', maxHeight: '90vh', overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsVariantManagerOpen(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>

              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase' }}>Variantes de Inventario</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f8fafc', marginTop: '4px' }}>
                  {selectedArticleForVariants.descripcion} <span style={{ color: '#64748b' }}>({selectedArticleForVariants.codigo})</span>
                </h3>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button 
                  onClick={handleOpenAddVariantModal}
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontSize: '0.85rem' }}
                >
                  <Plus size={16} /> Agregar Lote o Precio
                </button>
              </div>

              {/* Listado de Variantes */}
              {loadingVariants ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '30px' }}>Cargando lotes y precios...</p>
              ) : variants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                  <Info size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p>Este artículo no tiene lotes ni precios registrados. Presiona "Agregar Lote o Precio" para iniciar inventario.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {variants.map(v => (
                    <div key={v.id} style={{
                      padding: '16px', background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px',
                      display: 'flex', flexDirection: 'column', gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', color: '#f8fafc' }}>Lote: {v.lote || 'S/L'}</span>
                          {v.isp && (
                            <span style={{ fontSize: '0.8rem', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              ISP: {v.isp}
                            </span>
                          )}
                          {v.vencimiento && (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={14} /> Vence: {formatDate(v.vencimiento)}
                            </span>
                          )}
                          <span style={{ 
                            background: v.estado === 'VIGENTE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                            color: v.estado === 'VIGENTE' ? '#10b981' : '#ef4444', 
                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700'
                          }}>{v.estado}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleOpenEditVariantModal(v)} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteVariant(v.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        <div><strong>Stock:</strong> <span style={{ color: v.cantidad > 0 ? '#10b981' : '#64748b' }}>{v.cantidad} u.</span></div>
                        <div><strong>Fecha Ingreso:</strong> <span style={{ color: '#f8fafc' }}>{v.fecha_ingreso ? formatDate(v.fecha_ingreso) : 'S/I'}</span></div>
                        <div><strong>Fecha Salida:</strong> <span style={{ color: '#f8fafc' }}>{v.fecha_salida ? formatDate(v.fecha_salida) : 'S/S'}</span></div>
                        <div><strong>Valor C/IVA:</strong> <span>${(v.ultimo_valor_con_iva || 0).toLocaleString('es-CL')}</span></div>
                        <div><strong>Total C/IVA:</strong> <span>${(v.total_con_iva || 0).toLocaleString('es-CL')}</span></div>
                        <div><strong>Carta Canje:</strong> <span>{v.carta_canje || 'NO'}</span></div>
                      </div>
                      {v.comentario && (
                        <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#64748b', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                          Nota: {v.comentario}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODAL: AGREGAR / EDITAR VARIANTE
          ========================================== */}
      <AnimatePresence>
        {isVariantModalOpen && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
            onClick={() => setIsVariantModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              style={{
                background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px', width: '100%', maxWidth: '800px',
                padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                position: 'relative', maxHeight: '90vh', overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsVariantModalOpen(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={22} color="#3b82f6" /> 
                {variantModalMode === 'add' ? 'Añadir Variante de Inventario' : 'Editar Variante de Inventario'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* SECCIÓN: Control de Inventario */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: '700' }}>
                    Control de Inventario y Lotes
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Stock Actual (Cantidad)</label>
                      <input 
                        type="number" className="input-field" 
                        value={formCantidad}
                        onChange={(e) => handleCantidadChange(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Lote</label>
                      <input 
                        type="text" className="input-field" 
                        value={formLote}
                        onChange={(e) => setFormLote(e.target.value)}
                        placeholder="Ej: S/L, L1234, etc."
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Fecha Vencimiento</label>
                      <input 
                        type="date" className="input-field" 
                        value={formVencimiento}
                        onChange={(e) => setFormVencimiento(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Registro ISP</label>
                      <input 
                        type="text" className="input-field" 
                        value={formIsp}
                        onChange={(e) => setFormIsp(e.target.value)}
                        placeholder="Ej: F-12345, etc."
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Fecha Ingreso</label>
                      <input 
                        type="date" className="input-field" 
                        value={formFechaIngreso}
                        onChange={(e) => setFormFechaIngreso(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Fecha Salida</label>
                      <input 
                        type="date" className="input-field" 
                        value={formFechaSalida}
                        onChange={(e) => setFormFechaSalida(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Carta Canje</label>
                      <input 
                        type="text" className="input-field" 
                        value={formCartaCanje}
                        onChange={(e) => setFormCartaCanje(e.target.value)}
                        placeholder="Ej: NO, SI, PENDIENTE"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Estado</label>
                      <select 
                        className="input-field" 
                        value={formEstado}
                        onChange={(e) => setFormEstado(e.target.value)}
                      >
                        <option value="VIGENTE">VIGENTE</option>
                        <option value="SUSPENDIDO">SUSPENDIDO</option>
                        <option value="OBSOLETO">OBSOLETO</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Comentario / Observación</label>
                      <input 
                        type="text" className="input-field" 
                        value={formComentario}
                        onChange={(e) => setFormComentario(e.target.value)}
                        placeholder="Observaciones de este lote..."
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN: Valores Monetarios (Calculadora de IVA) */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', fontWeight: '700' }}>
                    Valores y Precios (Calculador de IVA)
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Valor Unitario S/IVA ($)</label>
                      <input 
                        type="number" step="0.01" className="input-field" 
                        value={formValorSinIva}
                        onChange={(e) => handleValorSinIvaChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Valor Unitario C/IVA ($)</label>
                      <input 
                        type="number" step="0.01" className="input-field" 
                        value={formValorConIva}
                        onChange={(e) => handleValorConIvaChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Total S/IVA ($)</label>
                      <input 
                        type="number" step="0.01" className="input-field" 
                        value={formTotalSinIva}
                        onChange={(e) => setFormTotalSinIva(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>Total C/IVA ($)</label>
                      <input 
                        type="number" step="0.01" className="input-field" 
                        value={formTotalConIva}
                        onChange={(e) => setFormTotalConIva(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                {/* Botonera de Variante */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', marginTop: '10px' }}>
                  <button onClick={() => setIsVariantModalOpen(false)} className="btn-secondary">Cancelar</button>
                  <button onClick={handleSaveVariant} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <Save size={18} /> Guardar Variante
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ConfigModule;
