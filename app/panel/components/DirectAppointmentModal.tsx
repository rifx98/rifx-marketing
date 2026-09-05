'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleTimePicker, { time24ToMinutes, minutesToTime24 } from './GoogleTimePicker';

interface DirectAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    customer_name?: string;
    phone_number?: string;
    conversation_id?: string;
    service?: string;
    resource_name?: string;
    date?: string;
    time?: string;
  };
  language: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setToast: (toast: any) => void;
  teamAgents?: any[];
  businessDays?: number[];
}

export default function DirectAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  language,
  authFetch,
  setToast,
  teamAgents = [],
  businessDays,
}: DirectAppointmentModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [service, setService] = useState('Asesoría Comercial');
  const [resourceName, setResourceName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [conversationId, setConversationId] = useState('');

  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string; label: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comprobar si la fecha seleccionada cae en un día no laborable según business_days
  const effectiveBusinessDays = React.useMemo(() => {
    if (Array.isArray(businessDays) && businessDays.length > 0) return businessDays;
    return [1, 2, 3, 4, 5];
  }, [businessDays]);

  const isDateNonWorking = React.useMemo(() => {
    if (!date) return false;
    const parts = date.split('-').map(Number);
    if (parts.length !== 3) return false;
    const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return !effectiveBusinessDays.includes(dayOfWeek);
  }, [date, effectiveBusinessDays]);

  // Inicializar campos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setCustomerName(initialData?.customer_name || '');
      setPhoneNumber(initialData?.phone_number || '');
      setService(initialData?.service || 'Asesoría Comercial');
      setResourceName(initialData?.resource_name || '');
      setDate(initialData?.date || today);
      const initialStart = initialData?.time || '09:00';
      setTime(initialStart);
      const startMins = time24ToMinutes(initialStart);
      setEndTime(minutesToTime24(Math.min(1439, startMins + 60)));
      setDurationMinutes(60);
      setConversationId(initialData?.conversation_id || '');
    }
  }, [isOpen, initialData]);

  // Consultar disponibilidad en Google Calendar cuando cambia la fecha
  const loadSlots = useCallback(async (targetDate: string) => {
    if (!targetDate) return;
    const parts = targetDate.split('-').map(Number);
    if (parts.length === 3) {
      const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
      if (!effectiveBusinessDays.includes(dayOfWeek)) {
        setAvailableSlots([]);
        return;
      }
    }
    setLoadingSlots(true);
    try {
      const res = await authFetch(`/api/panel/appointments/availability?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.available || []);
      } else {
        setAvailableSlots([]);
      }
    } catch (e) {
      console.error('Error al cargar disponibilidad:', e);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [authFetch, effectiveBusinessDays]);

  useEffect(() => {
    if (isOpen && date) {
      loadSlots(date);
    }
  }, [isOpen, date, loadSlots]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDateNonWorking) {
      setToast({
        type: 'error',
        message: language === 'en'
          ? 'Cannot book an appointment on a non-working day.'
          : 'No se puede agendar una cita en un día sin atención comercial.',
      });
      return;
    }
    if (!customerName.trim() || !phoneNumber.trim()) {
      setToast({ type: 'error', message: 'El nombre y teléfono son requeridos' });
      return;
    }
    if (!date || !time) {
      setToast({ type: 'error', message: 'Por favor selecciona la fecha y el horario de la cita' });
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduled_time = `${date}T${time}:00-05:00`;
      const res = await authFetch('/api/panel/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          scheduled_time,
          duration_minutes: durationMinutes || 60,
          end_time: endTime,
          service,
          resource_name: resourceName || undefined,
          conversation_id: conversationId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast({
          type: 'success',
          message: language === 'en'
            ? '✓ Appointment booked in Google Calendar & WhatsApp confirmation sent'
            : '✓ Cita agendada en Google Calendar y confirmación enviada por WhatsApp'
        });
        onSuccess();
        onClose();
      } else {
        setToast({ type: 'error', message: data.error || 'Error al agendar cita' });
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
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-white text-xl">calendar_month</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight">
                    {language === 'en' ? 'Direct Appointment Booking' : 'Agendamiento Directo de Cita'}
                  </h2>
                  <p className="text-xs text-white/80 font-medium">
                    {language === 'en'
                      ? 'Syncs in real time with Google Calendar and WhatsApp'
                      : 'Sincroniza en tiempo real con Google Calendar y notifica por WhatsApp'}
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
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Cliente: Nombre y Teléfono */}
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
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Servicio y Especialista / Recurso */}
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
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>{language === 'en' ? 'Specialist / Resource' : 'Especialista / Recurso'}</span>
                  <span className="text-[10px] text-blue-500 font-bold lowercase">opcional</span>
                </label>
                {teamAgents && teamAgents.length > 0 ? (
                  <select
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Sin asignar / General --</option>
                    {teamAgents.map((agent: any) => (
                      <option key={agent.id || agent.email} value={agent.name || agent.email}>
                        {agent.name || agent.email} ({agent.role || 'Especialista'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    placeholder="Ej: Dr. Carlos / Asesor 1"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                )}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {language === 'en' ? 'Date' : 'Fecha'} *
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 outline-none transition-all cursor-pointer ${
                  isDateNonWorking
                    ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500/20 focus:border-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />

              {isDateNonWorking && (
                <div className="mt-2.5 p-3.5 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20 dark:border-rose-800/40 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-base">event_busy</span>
                  </div>
                  <div className="text-xs">
                    <p className="font-black text-rose-600 dark:text-rose-400">
                      {language === 'en' ? 'Non-working Day' : 'Día No Laborable (Sin Atención)'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 font-medium">
                      {language === 'en'
                        ? 'Appointments cannot be booked on this day because it is not enabled in your working schedule.'
                        : 'No se pueden agendar citas este día porque no está marcado en tus días de atención.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Horario y Duración Estilo Google Calendar */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-sm text-blue-500">schedule</span>
                <span>{language === 'en' ? 'Appointment Schedule & Duration' : 'Horario de Cita y Duración'} *</span>
              </label>

              {isDateNonWorking ? (
                <div className="p-4 bg-rose-500/5 dark:bg-rose-950/20 rounded-xl border border-dashed border-rose-200 dark:border-rose-900/40 text-center">
                  <span className="material-symbols-outlined text-2xl text-rose-400 mb-1">block</span>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                    {language === 'en'
                      ? 'Reservations are disabled for non-working days.'
                      : 'Las reservas están desactivadas para este día sin atención.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {language === 'en'
                      ? 'Please select another day or enable this day in the Operating Schedule.'
                      : 'Selecciona una fecha hábil o habilita este día en Horario de Atención.'}
                  </p>
                </div>
              ) : (
                <GoogleTimePicker
                  startTime={time || '09:00'}
                  endTime={endTime || '10:00'}
                  durationMinutes={durationMinutes || 60}
                  dateStr={date}
                  suggestedSlots={availableSlots}
                  loadingSlots={loadingSlots}
                  language={language}
                  onChange={({ startTime, endTime: newEnd, durationMinutes: newDur }) => {
                    setTime(startTime);
                    setEndTime(newEnd);
                    setDurationMinutes(newDur);
                  }}
                />
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !time || isDateNonWorking}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span>{language === 'en' ? 'Booking...' : 'Agendando...'}</span>
                  </>
                ) : isDateNonWorking ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>{language === 'en' ? 'Day Closed' : 'Día Sin Atención'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span>{language === 'en' ? 'Confirm & Book' : 'Confirmar y Agendar'}</span>
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
