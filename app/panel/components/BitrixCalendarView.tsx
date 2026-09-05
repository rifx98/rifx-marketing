'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BitrixCalendarViewProps {
  appointments: any[];
  waitlist: any[];
  teamAgents?: any[];
  language: string;
  onOpenBooking: (initialData?: {
    customer_name?: string;
    phone_number?: string;
    conversation_id?: string;
    service?: string;
    resource_name?: string;
    date?: string;
    time?: string;
  }) => void;
  onOpenAddWaitlist: () => void;
  onApptAction: (apptId: string, action: 'complete' | 'no_show' | 'cancel' | 'reschedule') => Promise<void>;
  onWaitlistNotify: (waitlistId: string, time?: string) => Promise<void>;
  onWaitlistStatus: (waitlistId: string, status: string) => Promise<void>;
  isPerformingAction?: string | null;
  businessHours?: { start: string; end: string };
  onSwitchToTable?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  confirmed: {
    label: 'Confirmada',
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    border: 'border-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  pending: {
    label: 'Pendiente',
    bg: 'bg-amber-500/15 dark:bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  rescheduled: {
    label: 'Reagendada',
    bg: 'bg-blue-500/15 dark:bg-blue-500/20',
    border: 'border-blue-500/40',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  awaiting_reschedule: {
    label: 'Esperando Reagendar',
    bg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    border: 'border-indigo-500/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  pending_completion: {
    label: 'Por Validar',
    bg: 'bg-purple-500/15 dark:bg-purple-500/20',
    border: 'border-purple-500/40',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  completed: {
    label: 'Completada',
    bg: 'bg-slate-500/15 dark:bg-slate-500/20',
    border: 'border-slate-500/40',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
  cancelled: {
    label: 'Cancelada',
    bg: 'bg-rose-500/15 dark:bg-rose-500/20',
    border: 'border-rose-500/40',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  no_show: {
    label: 'No Asistió',
    bg: 'bg-red-500/15 dark:bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
};

export default function BitrixCalendarView({
  appointments,
  waitlist,
  teamAgents = [],
  language,
  onOpenBooking,
  onOpenAddWaitlist,
  onApptAction,
  onWaitlistNotify,
  onWaitlistStatus,
  isPerformingAction,
  businessHours = { start: '08:00', end: '19:00' },
  onSwitchToTable,
}: BitrixCalendarViewProps) {
  // Calendar View mode
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0.85, 1, 1.25
  const [selectedApptDetails, setSelectedApptDetails] = useState<any | null>(null);

  // Hour range calculation
  const startHour = Math.max(6, Math.min(9, parseInt(businessHours.start.split(':')[0], 10) || 8));
  const endHour = Math.min(22, Math.max(18, parseInt(businessHours.end.split(':')[0], 10) || 19));
  const hoursArray = useMemo(() => {
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
    return hours;
  }, [startHour, endHour]);

  const hourRowHeight = Math.round(72 * zoomLevel);

  // Resources List
  const resourcesList = useMemo(() => {
    const found = new Set<string>();
    appointments.forEach((a) => {
      if (a.resource_name) found.add(a.resource_name);
    });
    teamAgents.forEach((ag) => {
      if (ag.name) found.add(ag.name);
    });
    if (found.size === 0) {
      return ['Atención General', 'Asesoría VIP'];
    }
    return Array.from(found);
  }, [appointments, teamAgents]);

  // Selected date ISO string 'YYYY-MM-DD'
  const selectedDateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  // Days in selected week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // distance to Monday
    d.setDate(d.getDate() + diff);

    const days: { date: Date; dateStr: string; label: string; dayNum: number; isToday: boolean; isSelected: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

      days.push({
        date: cur,
        dateStr,
        label: dayNames[cur.getDay()],
        dayNum: cur.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
      });
    }
    return days;
  }, [selectedDate, selectedDateStr]);

  // Filtered Appointments for timeline
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      if (statusFilter !== 'all' && appt.status !== statusFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        const nameMatch = (appt.customer_name || '').toLowerCase().includes(q);
        const serviceMatch = (appt.service || '').toLowerCase().includes(q);
        const phoneMatch = (appt.phone_number || '').includes(q);
        if (!nameMatch && !serviceMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [appointments, statusFilter, searchFilter]);

  // Appointments on selected day
  const dayAppointments = useMemo(() => {
    return filteredAppointments.filter((appt) => {
      if (!appt.scheduled_time) return false;
      const apptDateStr = new Date(appt.scheduled_time).toISOString().split('T')[0];
      return apptDateStr === selectedDateStr;
    });
  }, [filteredAppointments, selectedDateStr]);

  // Revenue & Clients metrics for current selected day
  const dayMetrics = useMemo(() => {
    const active = dayAppointments.filter((a) => !['cancelled', 'no_show'].includes(a.status));
    const clientCount = active.length;
    const estimatedRev = clientCount * 35;
    return { clientCount, estimatedRev };
  }, [dayAppointments]);

  // Current time position indicator
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h >= startHour && h <= endHour) {
        const totalMinutes = (h - startHour) * 60 + m;
        setCurrentTimeMinutes(totalMinutes);
      } else {
        setCurrentTimeMinutes(null);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [startHour, endHour]);

  // Format date display for header (e.g. "5 de Sep 2026")
  const headerDateTitle = useMemo(() => {
    return new Intl.DateTimeFormat('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(selectedDate);
  }, [selectedDate]);

  // Mini Calendar generation
  const miniCalendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx === -1) startDayIdx = 6;

    const days: { date: Date; dateStr: string; dayNum: number; isCurrentMonth: boolean; hasAppointments: boolean; isSelected: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        hasAppointments: appointments.some((a) => a.scheduled_time && a.scheduled_time.startsWith(dateStr)),
        isSelected: dateStr === selectedDateStr,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
        hasAppointments: appointments.some((a) => a.scheduled_time && a.scheduled_time.startsWith(dateStr)),
        isSelected: dateStr === selectedDateStr,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill complete grid of 35 or 42 cells
    const remaining = 35 - days.length >= 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        hasAppointments: appointments.some((a) => a.scheduled_time && a.scheduled_time.startsWith(dateStr)),
        isSelected: dateStr === selectedDateStr,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentMonthDate, selectedDateStr, appointments]);

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(currentMonthDate);
  }, [currentMonthDate]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col transition-all">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR (Bitrix24 Style) */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900">
        {/* Left Title & Date Navigator */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">calendar_clock</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {language === 'en' ? 'Online Bookings' : 'Reserva Online'}
                </h2>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 capitalize bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {headerDateTitle}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-bold mt-0.5">
                <span className="text-emerald-600 dark:text-emerald-400">+{dayMetrics.clientCount} {language === 'en' ? 'clients' : 'clientes'}</span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400">+${dayMetrics.estimatedRev} USD</span>
              </div>
            </div>
          </div>

          {/* Date controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - (viewMode === 'week' ? 7 : 1));
                setSelectedDate(prev);
                setCurrentMonthDate(prev);
              }}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Anterior"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setSelectedDate(today);
                setCurrentMonthDate(today);
              }}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {language === 'en' ? 'Today' : 'Hoy'}
            </button>
            <button
              onClick={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + (viewMode === 'week' ? 7 : 1));
                setSelectedDate(next);
                setCurrentMonthDate(next);
              }}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Siguiente"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Center / Right Filters & View Switcher */}
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {/* Search */}
          <div className="relative w-44 sm:w-56">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder={language === 'en' ? 'Filter schedule...' : 'Filtrar agenda...'}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status Quick Filter Counters */}
          <div className="hidden xl:flex items-center gap-2">
            <button
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{appointments.filter((a) => a.status === 'pending').length} {language === 'en' ? 'Unconfirmed' : 'No confirmado'}</span>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                statusFilter === 'confirmed'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{appointments.filter((a) => a.status === 'confirmed').length} {language === 'en' ? 'Confirmed' : 'Confirmadas'}</span>
            </button>
          </div>

          {/* View Mode Switcher: [Día] [Semana] [Tabla] */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'en' ? 'Day' : 'Día'}
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {language === 'en' ? 'Week' : 'Semana'}
            </button>
            {onSwitchToTable && (
              <button
                onClick={onSwitchToTable}
                className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1"
                title="Vista de Tabla detallada"
              >
                <span className="material-symbols-outlined text-sm">table_rows</span>
                <span className="hidden sm:inline">{language === 'en' ? 'Table' : 'Tabla'}</span>
              </button>
            )}
          </div>

          {/* Action button: + Nueva Cita */}
          <button
            onClick={() => onOpenBooking({ date: selectedDateStr })}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">{language === 'en' ? 'New Booking' : 'Nueva Cita'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE (Timeline Scheduler on Left + Sidebar on Right) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-[640px] overflow-hidden">
        {/* ----------------------------------------------------------------------- */}
        {/* A. LEFT / CENTER: THE TIMELINE GRID */}
        {/* ----------------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 overflow-x-auto min-w-[340px]">
          {/* Top Resource / Column Headers Bar */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 sticky top-0 z-20">
            {/* Time column gutter corner */}
            <div className="w-16 sm:w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 p-3 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-base">schedule</span>
            </div>

            {/* Column Headers depending on view mode */}
            {viewMode === 'day' ? (
              // DAY VIEW: One column per resource/specialist
              <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800">
                {resourcesList.map((resourceName, idx) => {
                  const resAppts = dayAppointments.filter(
                    (a) => (a.resource_name || 'Atención General') === resourceName
                  );
                  return (
                    <div
                      key={idx}
                      className="flex-1 min-w-[200px] p-3 flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <span className="material-symbols-outlined text-base">person</span>
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            {resourceName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {resAppts.length} {language === 'en' ? 'slots' : 'turnos'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenBooking({ resource_name: resourceName, date: selectedDateStr })}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-xs"
                        title="Agendar con este especialista"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              // WEEK VIEW: 7 Columns for Monday - Sunday
              <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800">
                {weekDays.map((wDay, idx) => {
                  const count = filteredAppointments.filter(
                    (a) => a.scheduled_time && a.scheduled_time.startsWith(wDay.dateStr)
                  ).length;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(wDay.date);
                        setViewMode('day');
                      }}
                      className={`flex-1 min-w-[130px] p-3 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        wDay.isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40'
                          : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {wDay.label}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                            wDay.isToday
                              ? 'bg-blue-600 text-white shadow-sm'
                              : wDay.isSelected
                              ? 'border-2 border-blue-600 text-blue-600 dark:text-blue-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {wDay.dayNum}
                        </span>
                        {count > 0 && (
                          <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded-full text-[9px] font-black">
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline Rows Container */}
          <div className="relative flex-1 overflow-y-auto max-h-[700px]">
            {/* Real-time Indicator Line (Current Time) */}
            {currentTimeMinutes !== null && selectedDateStr === new Date().toISOString().split('T')[0] && (
              <div
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                style={{ top: `${(currentTimeMinutes / 60) * hourRowHeight}px` }}
              >
                <div className="w-16 sm:w-20 flex justify-end pr-1">
                  <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                    {new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}
                  </span>
                </div>
                <div className="flex-1 h-[2px] bg-rose-500 shadow-sm shadow-rose-500/50" />
              </div>
            )}

            {/* Time Grid Layout */}
            <div className="flex divide-x divide-slate-100 dark:divide-slate-800 relative">
              {/* Left Hours Gutter */}
              <div className="w-16 sm:w-20 shrink-0 select-none">
                {hoursArray.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: `${hourRowHeight}px` }}
                    className="border-b border-slate-100 dark:border-slate-800 pr-3 pt-1 flex justify-end text-xs font-bold text-slate-400 font-mono"
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Columns Area */}
              {viewMode === 'day' ? (
                // DAY COLUMNS (One per resource)
                <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800 relative">
                  {resourcesList.map((resourceName, colIdx) => {
                    const colAppts = dayAppointments.filter(
                      (a) => (a.resource_name || 'Atención General') === resourceName
                    );

                    return (
                      <div key={colIdx} className="flex-1 min-w-[200px] relative">
                        {/* Hour background slots */}
                        {hoursArray.map((hour) => {
                          const timeStr = `${String(hour).padStart(2, '0')}:00`;
                          return (
                            <div
                              key={hour}
                              style={{ height: `${hourRowHeight}px` }}
                              onClick={() =>
                                onOpenBooking({
                                  date: selectedDateStr,
                                  time: timeStr,
                                  resource_name: resourceName,
                                })
                              }
                              className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors relative group cursor-pointer"
                            >
                              {/* 30m subtle dotted line */}
                              <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-slate-100 dark:border-slate-800/40 pointer-events-none" />

                              {/* Hover + button to create booking in this slot */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">add</span>
                                  <span>{timeStr}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Render Appointments as Cards in this Column */}
                        {colAppts.map((appt) => {
                          const date = new Date(appt.scheduled_time);
                          const apptHour = date.getHours() + date.getMinutes() / 60;
                          if (apptHour < startHour || apptHour > endHour + 1) return null;

                          const top = (apptHour - startHour) * hourRowHeight;
                          const height = Math.max(38, 0.9 * hourRowHeight); // default ~1h duration
                          const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;

                          const timeFormatted = new Intl.DateTimeFormat('es-EC', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          }).format(date);

                          return (
                            <motion.div
                              key={appt.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedApptDetails(appt);
                              }}
                              className={`absolute left-1 right-1 rounded-xl p-2.5 border ${statusConf.bg} ${statusConf.border} shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 flex flex-col justify-between`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${statusConf.dot} shrink-0`} />
                                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                                      {appt.customer_name || 'Cliente'}
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-300 truncate font-semibold pl-3.5">
                                    {appt.service || 'Asesoría'}
                                  </p>
                                </div>
                                <span className="text-[9px] font-mono font-bold text-slate-500 bg-white/70 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700 shrink-0">
                                  {timeFormatted}
                                </span>
                              </div>

                              {appt.phone_number && (
                                <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                                  <span>{appt.phone_number}</span>
                                  <span className={`font-bold capitalize ${statusConf.text}`}>
                                    {statusConf.label}
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // WEEK COLUMNS (7 Days of the week)
                <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800 relative">
                  {weekDays.map((wDay, colIdx) => {
                    const colAppts = filteredAppointments.filter(
                      (a) => a.scheduled_time && a.scheduled_time.startsWith(wDay.dateStr)
                    );

                    return (
                      <div key={colIdx} className="flex-1 min-w-[130px] relative">
                        {/* Hour background slots */}
                        {hoursArray.map((hour) => {
                          const timeStr = `${String(hour).padStart(2, '0')}:00`;
                          return (
                            <div
                              key={hour}
                              style={{ height: `${hourRowHeight}px` }}
                              onClick={() =>
                                onOpenBooking({
                                  date: wDay.dateStr,
                                  time: timeStr,
                                })
                              }
                              className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors relative group cursor-pointer"
                            >
                              <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-slate-100 dark:border-slate-800/40 pointer-events-none" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                  + {timeStr}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Render Appointments as Cards in Day Column */}
                        {colAppts.map((appt) => {
                          const date = new Date(appt.scheduled_time);
                          const apptHour = date.getHours() + date.getMinutes() / 60;
                          if (apptHour < startHour || apptHour > endHour + 1) return null;

                          const top = (apptHour - startHour) * hourRowHeight;
                          const height = Math.max(34, 0.9 * hourRowHeight);
                          const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;

                          const timeFormatted = new Intl.DateTimeFormat('es-EC', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          }).format(date);

                          return (
                            <motion.div
                              key={appt.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedApptDetails(appt);
                              }}
                              className={`absolute left-1 right-1 rounded-xl p-2 border ${statusConf.bg} ${statusConf.border} shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 flex flex-col justify-between`}
                            >
                              <div className="truncate">
                                <div className="flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} shrink-0`} />
                                  <p className="text-[11px] font-black text-slate-800 dark:text-white truncate">
                                    {appt.customer_name}
                                  </p>
                                </div>
                                <p className="text-[9px] text-slate-500 dark:text-slate-300 truncate pl-2.5">
                                  {appt.service}
                                </p>
                              </div>
                              <span className="text-[8px] font-mono font-bold text-slate-400">
                                {timeFormatted}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Zoom & View Controls */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">tune</span>
              <span className="font-bold">{language === 'en' ? 'Scale' : 'Escala'}:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.15))}
                className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-700 dark:text-slate-200"
              >
                -
              </button>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
                className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-700 dark:text-slate-200"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {language === 'en' ? 'Confirmed' : 'Confirmada'}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {language === 'en' ? 'Pending' : 'Pendiente'}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {language === 'en' ? 'Rescheduled' : 'Reagendada'}
              </span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* B. RIGHT SIDEBAR: MINI CALENDAR + LISTA DE ESPERA (Bitrix24 Style) */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col bg-slate-50/40 dark:bg-slate-900/60 p-4 space-y-6">
          {/* 1. MINI CALENDAR WIDGET */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 shadow-sm">
            {/* Month navigator */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-800 dark:text-white capitalize">
                {monthName}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const prev = new Date(currentMonthDate);
                    prev.setMonth(prev.getMonth() - 1);
                    setCurrentMonthDate(prev);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button
                  onClick={() => {
                    const next = new Date(currentMonthDate);
                    next.setMonth(next.getMonth() + 1);
                    setCurrentMonthDate(next);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Weekdays header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                <span key={i} className="text-[10px] font-black text-slate-400">
                  {d}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {miniCalendarDays.map((cDay, idx) => {
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(cDay.date);
                      if (!cDay.isCurrentMonth) {
                        setCurrentMonthDate(cDay.date);
                      }
                    }}
                    className={`h-7 w-7 mx-auto rounded-lg text-xs font-bold transition-all relative flex items-center justify-center ${
                      cDay.isSelected
                        ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30'
                        : cDay.isToday
                        ? 'border border-blue-500 text-blue-600 dark:text-blue-400'
                        : cDay.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    <span>{cDay.dayNum}</span>
                    {cDay.hasAppointments && !cDay.isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. LISTA DE ESPERA (Waitlist & Overbooking Widget) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 shadow-sm flex flex-col flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/50 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500 text-base">hourglass_top</span>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  {language === 'en' ? 'Waitlist' : 'Lista de espera'}
                </h3>
              </div>
              <button
                onClick={onOpenAddWaitlist}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-xs">add</span>
                <span>{language === 'en' ? 'Add' : 'Agregar'}</span>
              </button>
            </div>

            {/* Waitlist clients list */}
            {waitlist.filter((w) => w.status === 'waiting').length > 0 ? (
              <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                {waitlist
                  .filter((w) => w.status === 'waiting')
                  .map((wItem) => (
                    <div
                      key={wItem.id}
                      className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {wItem.customer_name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                            {wItem.service || 'General'}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                          {wItem.preferred_time_range || 'Cualquier hora'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-amber-200/40 dark:border-amber-900/40">
                        <span className="font-mono">{wItem.phone_number}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onWaitlistNotify(wItem.id)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="Notificar por WhatsApp"
                          >
                            <span className="material-symbols-outlined text-xs">send</span>
                          </button>
                          <button
                            onClick={() =>
                              onOpenBooking({
                                customer_name: wItem.customer_name,
                                phone_number: wItem.phone_number,
                                service: wItem.service,
                                date: wItem.desired_date || selectedDateStr,
                              })
                            }
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-black"
                          >
                            {language === 'en' ? 'Book' : 'Agendar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              // Empty state matching Bitrix24 screenshot
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl">content_paste</span>
                </div>
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                  {language === 'en' ? 'Waitlist' : 'Lista de espera'}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  {language === 'en'
                    ? 'Drag an existing online booking here, or click "Add" to create a new one.'
                    : 'Arrastre una reserva online existente aquí, o haga clic en "Agregar" para crear una nueva.'}
                </p>
                <button
                  onClick={onOpenAddWaitlist}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">help</span>
                  <span>{language === 'en' ? 'How does it work?' : '¿Cómo funciona?'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. APPOINTMENT DETAILS & ACTION POPOVER / MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedApptDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 w-full max-w-md relative"
            >
              <button
                onClick={() => setSelectedApptDetails(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xl">
                  <span className="material-symbols-outlined text-2xl">event_available</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedApptDetails.customer_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedApptDetails.phone_number}
                  </p>
                </div>
              </div>

              {/* Details card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl space-y-2.5 mb-6 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">{language === 'en' ? 'Service' : 'Servicio'}:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {selectedApptDetails.service || 'Asesoría'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">{language === 'en' ? 'Specialist' : 'Especialista'}:</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                    {selectedApptDetails.resource_name || 'Atención General'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">{language === 'en' ? 'Schedule' : 'Horario'}:</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                    {new Intl.DateTimeFormat('es-EC', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    }).format(new Date(selectedApptDetails.scheduled_time))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-400 font-bold">{language === 'en' ? 'Status' : 'Estado'}:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black capitalize ${STATUS_CONFIG[selectedApptDetails.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[selectedApptDetails.status]?.text || 'text-slate-700'}`}>
                    {STATUS_CONFIG[selectedApptDetails.status]?.label || selectedApptDetails.status}
                  </span>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {language === 'en' ? 'Actions' : 'Acciones Disponibles'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      await onApptAction(selectedApptDetails.id, 'complete');
                      setSelectedApptDetails(null);
                    }}
                    disabled={!!isPerformingAction}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{language === 'en' ? 'Attended' : 'Asistió'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      await onApptAction(selectedApptDetails.id, 'no_show');
                      setSelectedApptDetails(null);
                    }}
                    disabled={!!isPerformingAction}
                    className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    <span>{language === 'en' ? 'No Show' : 'No Asistió'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const phone = (selectedApptDetails.phone_number || '').replace(/[^0-9]/g, '');
                      if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                    }}
                    className="p-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={async () => {
                      await onApptAction(selectedApptDetails.id, 'cancel');
                      setSelectedApptDetails(null);
                    }}
                    disabled={!!isPerformingAction}
                    className="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>{language === 'en' ? 'Cancel' : 'Cancelar'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
