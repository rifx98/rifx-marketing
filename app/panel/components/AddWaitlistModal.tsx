'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    customer_name?: string;
    phone_number?: string;
    conversation_id?: string;
    service?: string;
  };
  language: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setToast: (toast: any) => void;
  teamAgents?: any[];
}

export default function AddWaitlistModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  language,
  authFetch,
  setToast,
  teamAgents = [],
}: AddWaitlistModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [preferredTimeRange, setPreferredTimeRange] = useState('any');
  const [service, setService] = useState('Asesoría Comercial');
  const [resourceName, setResourceName] = useState('');
  const [notes, setNotes] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setCustomerName(initialData?.customer_name || '');
      setPhoneNumber(initialData?.phone_number || '');
      setService(initialData?.service || 'Asesoría Comercial');
      setDesiredDate(tomorrow);
      setPreferredTimeRange('any');
      setResourceName('');
      setNotes('');
      setConversationId(initialData?.conversation_id || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phoneNumber.trim() || !desiredDate) {
      setToast({ type: 'error', message: 'Nombre, teléfono y fecha deseada son requeridos' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/panel/appointments/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          desired_date: desiredDate,
          preferred_time_range: preferredTimeRange,
          service,
          resource_name: resourceName || undefined,
          conversation_id: conversationId || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast({
          type: 'success',
          message: language === 'en'
            ? '✓ Added to waitlist. Client will be notified automatically if a slot opens.'
            : '✓ Registrado en lista de espera. Se le notificará por WhatsApp en cuanto se libere un turno.'
        });
        onSuccess();
        onClose();
      } else {
        setToast({ type: 'error', message: data.error || 'Error al añadir a lista de espera' });
      }
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error de conexión' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-white text-xl">hourglass_top</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight">
                    {language === 'en' ? 'Add to Waitlist (Overbooking)' : 'Añadir a Lista de Espera (Overbooking)'}
                  </h2>
                  <p className="text-xs text-white/80 font-medium">
                    {language === 'en'
                      ? 'Automated WhatsApp notification upon cancellation'
                      : 'Notificación automática por WhatsApp en cancelaciones'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'Client Name' : 'Nombre del Cliente'} *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Sofía Morales"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'WhatsApp Phone' : 'Teléfono WhatsApp'} *
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ej: 593987654321"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'Desired Date' : 'Fecha Deseada'} *
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'Preferred Time' : 'Franja Horaria'}
                </label>
                <select
                  value={preferredTimeRange}
                  onChange={(e) => setPreferredTimeRange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer"
                >
                  <option value="any">{language === 'en' ? 'Any time' : 'Cualquier horario'}</option>
                  <option value="morning">{language === 'en' ? 'Morning (09:00 - 13:00)' : 'Mañana (09:00 - 13:00)'}</option>
                  <option value="afternoon">{language === 'en' ? 'Afternoon (14:00 - 18:00)' : 'Tarde (14:00 - 18:00)'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'Service' : 'Servicio'}
                </label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ej: Asesoría Comercial"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  {language === 'en' ? 'Preferred Specialist' : 'Especialista Preferido'}
                </label>
                {teamAgents && teamAgents.length > 0 ? (
                  <select
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Cualquiera disponible --</option>
                    {teamAgents.map((agent: any) => (
                      <option key={agent.id || agent.email} value={agent.name || agent.email}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    placeholder="Ej: Cualquier especialista"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'en' ? 'Notes' : 'Notas internas'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Cliente con alta intención de compra, avisar urgente si se libera turno"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-500/25 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span>{language === 'en' ? 'Saving...' : 'Guardando...'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                    <span>{language === 'en' ? 'Save in Waitlist' : 'Guardar en Lista'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
