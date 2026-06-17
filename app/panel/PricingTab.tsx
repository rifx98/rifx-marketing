'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Save, X, DollarSign, Tag, CheckCircle } from 'lucide-react';

interface PricingTabProps {
  language: string;
  tenantData: any;
}

export default function PricingTab({ language, tenantData }: PricingTabProps) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    service_name: '',
    category: 'general',
    description: '',
    base_price: '',
    currency: 'USD',
    billing_type: 'one_time',
    min_price: '',
    max_price: '',
    is_custom_quote: false,
    included_items: '',
    optional_addons: ''
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/panel/pricing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener servicios');
      setServices(data.services || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenEdit = (service?: any) => {
    if (service) {
      setFormData({
        id: service.id,
        service_name: service.service_name || '',
        category: service.category || 'general',
        description: service.description || '',
        base_price: service.base_price?.toString() || '',
        currency: service.currency || 'USD',
        billing_type: service.billing_type || 'one_time',
        min_price: service.min_price?.toString() || '',
        max_price: service.max_price?.toString() || '',
        is_custom_quote: service.is_custom_quote || false,
        included_items: Array.isArray(service.included_items) ? service.included_items.join('\n') : '',
        optional_addons: Array.isArray(service.optional_addons) ? service.optional_addons.join('\n') : ''
      });
    } else {
      setFormData({
        id: '',
        service_name: '',
        category: 'general',
        description: '',
        base_price: '',
        currency: 'USD',
        billing_type: 'one_time',
        min_price: '',
        max_price: '',
        is_custom_quote: false,
        included_items: '',
        optional_addons: ''
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.service_name) {
        alert('El nombre del servicio es obligatorio');
        return;
      }

      const payload = {
        ...formData,
        base_price: formData.base_price ? parseFloat(formData.base_price) : null,
        min_price: formData.min_price ? parseFloat(formData.min_price) : null,
        max_price: formData.max_price ? parseFloat(formData.max_price) : null,
        included_items: formData.included_items.split('\n').map(s => s.trim()).filter(Boolean),
        optional_addons: formData.optional_addons.split('\n').map(s => s.trim()).filter(Boolean)
      };

      const res = await fetch('/api/panel/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsEditing(false);
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este servicio?')) return;
    try {
      const res = await fetch(`/api/panel/pricing?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchServices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            {language === 'en' ? 'Pricing & Services Guard' : 'Catálogo de Precios y Servicios'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {language === 'en' 
              ? 'Manage your services, prices, and features so your AI can quote accurately to customers.' 
              : 'Administra tus servicios, precios y características para que tu IA cotice con precisión a los clientes.'}
          </p>
        </div>
        <button
          onClick={() => handleOpenEdit()}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl flex items-center gap-2 hover:shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {language === 'en' ? 'Add Service' : 'Agregar Servicio'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-xl font-medium flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenEdit(service)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(service.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {service.category}
                </span>
                {service.is_custom_quote && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-lg">
                    Cotización a Medida
                  </span>
                )}
              </div>

              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">{service.service_name}</h3>
              {service.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{service.description}</p>
              )}

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {service.base_price ? `$${service.base_price}` : 'Precio Variable'}
                  </span>
                  {service.currency && <span className="text-xs font-bold text-slate-400">{service.currency}</span>}
                </div>
                {service.billing_type && (
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">
                    {service.billing_type.replace('_', ' ')}
                  </div>
                )}
                {(service.min_price || service.max_price) && (
                  <div className="text-xs text-slate-500 mt-2 font-medium">
                    Rango: ${service.min_price || 0} - ${service.max_price || '∞'}
                  </div>
                )}
              </div>

              {service.included_items && service.included_items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">Incluye:</p>
                  <ul className="space-y-1.5">
                    {service.included_items.slice(0, 3).map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="truncate">{item}</span>
                      </li>
                    ))}
                    {service.included_items.length > 3 && (
                      <li className="text-xs font-bold text-slate-400 pl-5">
                        +{service.included_items.length - 3} más...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {services.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
              <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-500">No hay servicios registrados</h3>
              <p className="text-sm text-slate-400 mt-1">Agrega tu primer servicio para que la IA comience a cotizar.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL EDITAR/CREAR */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">
                {formData.id ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <button onClick={() => setIsEditing(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre del Servicio *</label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => setFormData({...formData, service_name: e.target.value})}
                    placeholder="Ej: Desarrollo Web E-commerce"
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="Ej: software, diseño, marketing..."
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo de Cobro</label>
                  <select
                    value={formData.billing_type}
                    onChange={(e) => setFormData({...formData, billing_type: e.target.value})}
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="one_time">Pago Único</option>
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                    <option value="hourly">Por Hora</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Descripción para la IA</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    placeholder="Explica qué hace este servicio para que el bot pueda recomendarlo..."
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Precio Base / Fijo</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      value={formData.base_price}
                      onChange={(e) => setFormData({...formData, base_price: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_custom_quote}
                      onChange={(e) => setFormData({...formData, is_custom_quote: e.target.checked})}
                      className="w-5 h-5 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm font-bold">Requiere Cotización a Medida</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Precio Mínimo (Rango)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      value={formData.min_price}
                      onChange={(e) => setFormData({...formData, min_price: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Precio Máximo (Rango)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      value={formData.max_price}
                      onChange={(e) => setFormData({...formData, max_price: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>Elementos Incluidos</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">Un elemento por línea</span>
                  </label>
                  <textarea
                    value={formData.included_items}
                    onChange={(e) => setFormData({...formData, included_items: e.target.value})}
                    rows={4}
                    placeholder="Diseño UX/UI\nIntegración de pagos\nHosting por 1 año"
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>Adicionales Opcionales</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">Un elemento por línea</span>
                  </label>
                  <textarea
                    value={formData.optional_addons}
                    onChange={(e) => setFormData({...formData, optional_addons: e.target.value})}
                    rows={3}
                    placeholder="Mantenimiento mensual - $50\nDominio extra - $15"
                    className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                Guardar Servicio
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
