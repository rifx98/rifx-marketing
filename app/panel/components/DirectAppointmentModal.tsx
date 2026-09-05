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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden my-8"
        >
          {/* Header Corporativo Limpio */}
          <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">calendar_month</span>
              </div>
              <div>
                <h2 className="text-sm font-normal text-slate-800 dark:text-slate-100 leading-tight">
                  {language === 'en' ? 'Direct Appointment Booking' : 'Agendamiento directo de cita'}
                </h2>
                <p className="text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                  {language === 'en'
                    ? 'Syncs in real time with Google Calendar and WhatsApp'
                    : 'Sincroniza en tiempo real con Google Calendar y notifica por WhatsApp'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4.5 bg-white dark:bg-slate-900">
            {/* Cliente: Nombre y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'Client Name' : 'Nombre del Cliente'} <span className="text-rose-500 font-normal">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'WhatsApp Phone' : 'Teléfono WhatsApp'} <span className="text-rose-500 font-normal">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ej: 593987654321"
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 font-mono placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Servicio y Especialista / Recurso */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'Service' : 'Servicio'}
                </label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ej: Asesoría Comercial"
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{language === 'en' ? 'Specialist / Resource' : 'Especialista / Recurso'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">opcional</span>
                </label>
                {teamAgents && teamAgents.length > 0 ? (
                  <select
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all cursor-pointer"
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
                    className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all"
                  />
                )}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                {language === 'en' ? 'Date' : 'Fecha'} <span className="text-rose-500 font-normal">*</span>
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full bg-slate-50/50 dark:bg-slate-800/40 border rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 focus:ring-2 outline-none transition-all cursor-pointer ${
                  isDateNonWorking
                    ? 'border-amber-300 dark:border-amber-700/60 focus:ring-amber-500/15 focus:border-amber-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-blue-500/15 focus:border-blue-500'
                }`}
              />

              {isDateNonWorking && (
                <p className="mt-1.5 text-xs font-normal text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span>
                    {language === 'en'
                      ? 'This date falls outside your scheduled business days.'
                      : 'Esta fecha corresponde a un día sin atención programada en tu horario.'}
                  </span>
                </p>
              )}
            </div>

            {/* Horario y Duración Estilo Google Calendar */}
            <div>
              <label className="text-xs font-normal text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-sm text-blue-500">schedule</span>
                <span>{language === 'en' ? 'Appointment Schedule & Duration' : 'Horario de cita y duración'}</span>
                <span className="text-rose-500 font-normal">*</span>
              </label>

              {isDateNonWorking ? (
                <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 text-center">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2">
                    <span className="material-symbols-outlined text-lg">event_busy</span>
                  </div>
                  <p className="text-xs font-normal text-slate-700 dark:text-slate-200">
                    {language === 'en'
                      ? 'No appointment slots available for this date'
                      : 'No hay horarios disponibles para esta fecha'}
                  </p>
                  <p className="text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    {language === 'en'
                      ? 'Appointments are disabled for non-working days. Please select an active business day or update your business hours.'
                      : 'Las citas no están habilitadas para días no laborables. Selecciona otra fecha o configura tus días de atención en Horario.'}
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
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-normal text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !time || isDateNonWorking}
                className={`px-5 py-2 rounded-xl text-xs font-normal transition-all flex items-center gap-1.5 ${
                  isDateNonWorking
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-500/20 cursor-pointer disabled:opacity-50'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    <span>{language === 'en' ? 'Booking...' : 'Agendando...'}</span>
                  </>
                ) : isDateNonWorking ? (
                  <>
                    <span className="material-symbols-outlined text-sm">event_busy</span>
                    <span>{language === 'en' ? 'Day closed' : 'Día sin atención'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check</span>
                    <span>{language === 'en' ? 'Confirm and book' : 'Confirmar y agendar'}</span>
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
