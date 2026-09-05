'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleTimePicker, { time24ToMinutes, minutesToTime24, formatDurationLabel } from './GoogleTimePicker';

interface BitrixCalendarViewProps {
  appointments: any[];
  waitlist: any[];
  teamAgents?: any[];
  contacts?: any[];
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
  onApptAction: (
    apptId: string,
    action: 'complete' | 'no_show' | 'cancel' | 'reschedule' | 'delete',
    payload?: any
  ) => Promise<void>;
  onWaitlistNotify: (waitlistId: string, time?: string) => Promise<void>;
  onWaitlistStatus: (waitlistId: string, status: string) => Promise<void>;
  isPerformingAction?: string | null;
  // Stats and Metrics
  appointmentStats?: any;
  // Business hours configuration
  configData: any;
  setConfigData: React.Dispatch<React.SetStateAction<any>>;
  onSaveSchedule: (scheduleData?: {
    business_days?: number[];
    business_start_hour?: string;
    business_end_hour?: string;
  }) => Promise<boolean | void> | void;
  isSavingSchedule?: boolean;
  onSwitchToTable?: () => void;
  authFetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    border: string;
    accentBorder: string;
    badgeBg: string;
    text: string;
    dot: string;
    glow: string;
  }
> = {
  confirmed: {
    label: 'Confirmada',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/30 dark:border-emerald-500/40',
    accentBorder: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
    glow: 'hover:shadow-emerald-500/10',
  },
  pending: {
    label: 'Pendiente',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/30 dark:border-amber-500/40',
    accentBorder: 'border-l-amber-500',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500 shadow-sm shadow-amber-500/50',
    glow: 'hover:shadow-amber-500/10',
  },
  rescheduled: {
    label: 'Reagendada',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/30 dark:border-blue-500/40',
    accentBorder: 'border-l-blue-500',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500 shadow-sm shadow-blue-500/50',
    glow: 'hover:shadow-blue-500/10',
  },
  awaiting_reschedule: {
    label: 'Esperando Reagendar',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'border-indigo-500/30 dark:border-indigo-500/40',
    accentBorder: 'border-l-indigo-500',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500 shadow-sm shadow-indigo-500/50',
    glow: 'hover:shadow-indigo-500/10',
  },
  pending_completion: {
    label: 'Por Validar',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'border-purple-500/30 dark:border-purple-500/40',
    accentBorder: 'border-l-purple-500',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500 shadow-sm shadow-purple-500/50',
    glow: 'hover:shadow-purple-500/10',
  },
  completed: {
    label: 'Completada',
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    border: 'border-slate-500/30 dark:border-slate-500/40',
    accentBorder: 'border-l-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500 shadow-sm shadow-slate-500/50',
    glow: 'hover:shadow-slate-500/10',
  },
  cancelled: {
    label: 'Cancelada',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/30 dark:border-rose-500/40',
    accentBorder: 'border-l-rose-500',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500 shadow-sm shadow-rose-500/50',
    glow: 'hover:shadow-rose-500/10',
  },
  no_show: {
    label: 'No Asistió',
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    border: 'border-red-500/30 dark:border-red-500/40',
    accentBorder: 'border-l-red-500',
    badgeBg: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500 shadow-sm shadow-red-500/50',
    glow: 'hover:shadow-red-500/10',
  },
};

export interface FilterFieldOption {
  id: string;
  label: string;
  category: 'contacto' | 'actividad';
  default?: boolean;
}

export const CRM_FILTER_FIELDS: FilterFieldOption[] = [
  // Contacto (Esenciales para CRM de Marketing y Clientes)
  { id: 'nombre', label: 'Nombre', category: 'contacto', default: true },
  { id: 'apellido', label: 'Apellido', category: 'contacto', default: true },
  { id: 'creadoPor', label: 'Creado por', category: 'contacto', default: true },
  { id: 'modificadoPor', label: 'Modificado por', category: 'contacto', default: true },
  { id: 'telefono', label: 'Teléfono', category: 'contacto', default: true },
  { id: 'email', label: 'Correo electrónico', category: 'contacto', default: true },
  { id: 'responsable', label: 'Persona responsable', category: 'contacto', default: true },
  { id: 'tieneTelefono', label: 'Tiene teléfono', category: 'contacto', default: false },
  { id: 'tieneEmail', label: 'Tiene correo electrónico', category: 'contacto', default: false },
  { id: 'journey', label: 'Recorrido del cliente', category: 'contacto', default: false },
  { id: 'origen', label: 'Origen', category: 'contacto', default: false },
  { id: 'tipoContacto', label: 'Tipo de contacto', category: 'contacto', default: false },
  { id: 'compania', label: 'Nombre de la compañía', category: 'contacto', default: false },
  { id: 'cargo', label: 'Cargo', category: 'contacto', default: false },
  { id: 'comentario', label: 'Comentario', category: 'contacto', default: false },
  { id: 'creadoEl', label: 'Creado el', category: 'contacto', default: false },
  { id: 'modificadoEl', label: 'Última actualización', category: 'contacto', default: false },
  { id: 'utmSource', label: 'UTM Source', category: 'contacto', default: false },
  { id: 'utmCampaign', label: 'UTM Campaign', category: 'contacto', default: false },
  // Actividad (Esenciales para Citas y Reservas)
  { id: 'actividadEstado', label: 'Estado', category: 'actividad', default: false },
  { id: 'actividadTipo', label: 'Tipo de actividad', category: 'actividad', default: false },
  { id: 'actividadFechaLimite', label: 'Fecha límite', category: 'actividad', default: false },
  { id: 'origenActividad', label: 'Origen de la actividad', category: 'actividad', default: false },
];

// Helper to parse metadata from waitlist notes: [Empresa: ... | Correo: ...] Notes
export function parseWaitlistNotes(notes?: string | null): {
  company?: string;
  email?: string;
  schedulePreference: string;
} {
  if (!notes) return { schedulePreference: '' };

  let company: string | undefined;
  let email: string | undefined;
  let schedulePreference = notes;

  const metaMatch = notes.match(/^\[(.*?)\]\s*(.*)$/s);
  if (metaMatch) {
    const metaString = metaMatch[1];
    schedulePreference = metaMatch[2]?.trim() || '';

    const compMatch = metaString.match(/(?:Empresa|Compañía|Company):\s*([^|\]]+)/i);
    if (compMatch) company = compMatch[1].trim();

    const emailMatch = metaString.match(/(?:Correo|Email):\s*([^|\]]+)/i);
    if (emailMatch) email = emailMatch[1].trim();
  }

  return {
    company,
    email,
    schedulePreference,
  };
}

// Seniority evaluation based on Bitrix24: Hoy, Semana actual, Semana anterior
export function getWaitlistSeniority(
  createdAtStr?: string,
  desiredDateStr?: string
): 'today' | 'this_week' | 'older' {
  const dateStr = createdAtStr || desiredDateStr;
  if (!dateStr) return 'today';

  const itemDate = new Date(dateStr);
  if (isNaN(itemDate.getTime())) return 'today';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDayStart = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

  const diffDays = Math.round((todayStart.getTime() - itemDayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'today';
  }

  // Monday of this week: dayOfWeek 0=Mon, ..., 6=Sun
  const dayOfWeek = (now.getDay() + 6) % 7;
  if (diffDays <= dayOfWeek) {
    return 'this_week';
  }

  return 'older';
}

export default function BitrixCalendarView({
  appointments,
  waitlist,
  teamAgents = [],
  contacts = [],
  language,
  onOpenBooking,
  onOpenAddWaitlist,
  onApptAction,
  onWaitlistNotify,
  onWaitlistStatus,
  isPerformingAction,
  appointmentStats,
  configData,
  setConfigData,
  onSaveSchedule,
  isSavingSchedule,
  onSwitchToTable,
  authFetch,
}: BitrixCalendarViewProps) {
  // Top Navigation Tab (Bitrix24 style navigation: Reservas, Métricas, Recursos, Espera)
  const [activeSection, setActiveSection] = useState<'timeline' | 'metrics' | 'resources' | 'waitlist'>('timeline');

  // Waitlist Bitrix24 features state
  const [isWaitlistCollapsed, setIsWaitlistCollapsed] = useState(false);
  const [showWaitlistHelpModal, setShowWaitlistHelpModal] = useState(false);
  const [waitlistSeniorityFilter, setWaitlistSeniorityFilter] = useState<'all' | 'today' | 'this_week' | 'older'>('all');
  const [waitlistDeletingId, setWaitlistDeletingId] = useState<string | null>(null);

  // Group waitlist by seniority (Hoy, Semana actual, Semana anterior)
  const groupedWaitlist = useMemo(() => {
    const waiting = waitlist.filter((w) => w.status === 'waiting');
    const today: any[] = [];
    const thisWeek: any[] = [];
    const older: any[] = [];

    waiting.forEach((item) => {
      const seniority = getWaitlistSeniority(item.created_at, item.desired_date);
      if (seniority === 'today') today.push(item);
      else if (seniority === 'this_week') thisWeek.push(item);
      else older.push(item);
    });

    return {
      waiting,
      today,
      thisWeek,
      older,
      totalCount: waiting.length,
    };
  }, [waitlist]);

  // Calendar View mode: Day or Week
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedApptDetails, setSelectedApptDetails] = useState<any | null>(null);

  // Modal mode: details, reschedule, confirm_delete
  const [apptModalMode, setApptModalMode] = useState<'details' | 'reschedule' | 'confirm_delete'>('details');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('10:00');
  const [rescheduleDuration, setRescheduleDuration] = useState(60);
  const [rescheduleResource, setRescheduleResource] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string; end: string; label: string }[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [isSubmittingModalAction, setIsSubmittingModalAction] = useState(false);

  // Edit Schedule Modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<'clients' | 'revenue' | null>(null);

  // Contactos Modal state (Bitrix24 CRM style ventana emergente)
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>('Todos los contactos');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Formulario de filtros avanzados Bitrix24 (Captura 3)
  const [filterForm, setFilterForm] = useState<Record<string, string>>({
    nombre: '',
    apellido: '',
    creadoPor: '',
    modificadoPor: '',
    telefono: '',
    email: '',
    responsable: '',
    tieneTelefono: '',
    tieneEmail: '',
    journey: '',
    origen: '',
    tipoContacto: '',
    compania: '',
    cargo: '',
    comentario: '',
    creadoEl: '',
    modificadoEl: '',
    utmSource: '',
    utmCampaign: '',
    actividadEstado: '',
    actividadTipo: '',
    actividadFechaLimite: '',
    origenActividad: '',
  });

  // Lista de IDs de campos visibles en el formulario de filtro avanzado
  const [activeFilterFieldIds, setActiveFilterFieldIds] = useState<string[]>([
    'nombre',
    'apellido',
    'creadoPor',
    'modificadoPor',
    'telefono',
    'email',
    'responsable',
  ]);

  // Modal para configurar campos ("Ajustes del campo de filtros" - Captura 1)
  const [showFieldSettingsModal, setShowFieldSettingsModal] = useState(false);
  const [tempFieldIds, setTempFieldIds] = useState<string[]>([
    'nombre',
    'apellido',
    'creadoPor',
    'modificadoPor',
    'telefono',
    'email',
    'responsable',
  ]);
  const [fieldSearchFilter, setFieldSearchFilter] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'contacto' | 'actividad'>('all');

  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactsSortAsc, setContactsSortAsc] = useState(true);
  const [isContactsFullscreen, setIsContactsFullscreen] = useState(false);

  // Custom resources state
  const [customResources, setCustomResources] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bitrix_custom_resources');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');

  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    const updated = Array.from(new Set([...customResources, newResourceName.trim()]));
    setCustomResources(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitrix_custom_resources', JSON.stringify(updated));
    }
    setNewResourceName('');
    setShowAddResourceModal(false);
  };

  // Cerrar popover de búsqueda avanzada al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSearchDropdown]);

  // Sincronizar estado del modal al abrir detalles de una cita
  useEffect(() => {
    if (selectedApptDetails) {
      setApptModalMode('details');
      setIsSubmittingModalAction(false);
      try {
        const apptDateObj = new Date(selectedApptDetails.scheduled_time);
        const todayStr = new Date().toISOString().split('T')[0];
        const apptDateStr = !isNaN(apptDateObj.getTime()) ? apptDateObj.toISOString().split('T')[0] : todayStr;
        setRescheduleDate(apptDateStr < todayStr ? todayStr : apptDateStr);

        const hours = apptDateObj.getHours().toString().padStart(2, '0');
        const minutes = apptDateObj.getMinutes().toString().padStart(2, '0');
        const startT = `${hours}:${minutes}`;
        setRescheduleTime(startT);

        const dur = selectedApptDetails.duration_minutes || 60;
        setRescheduleDuration(dur);
        const endTotalMins = (apptDateObj.getHours() * 60 + apptDateObj.getMinutes()) + dur;
        setRescheduleEndTime(minutesToTime24(endTotalMins));
      } catch {
        const todayStr = new Date().toISOString().split('T')[0];
        setRescheduleDate(todayStr);
        setRescheduleTime('09:00');
        setRescheduleEndTime('10:00');
        setRescheduleDuration(60);
      }
      setRescheduleResource(selectedApptDetails.resource_name || '');
    }
  }, [selectedApptDetails]);

  // Cargar disponibilidad de horarios cuando se activa el modo reagendar
  useEffect(() => {
    if (apptModalMode === 'reschedule' && rescheduleDate) {
      if (authFetch) {
        setLoadingRescheduleSlots(true);
        authFetch(`/api/panel/appointments/availability?date=${rescheduleDate}`)
          .then((r) => r.json())
          .then((d) => {
            if (d?.available && Array.isArray(d.available) && d.available.length > 0) {
              setRescheduleSlots(d.available);
            } else {
              setRescheduleSlots([]);
            }
          })
          .catch(() => setRescheduleSlots([]))
          .finally(() => setLoadingRescheduleSlots(false));
      }
    }
  }, [apptModalMode, rescheduleDate, authFetch]);

  // Hour range calculation
  const startHour = Math.max(6, Math.min(9, parseInt((configData?.business_start_hour || '08:00').split(':')[0], 10) || 8));
  const endHour = Math.min(22, Math.max(18, parseInt((configData?.business_end_hour || '19:00').split(':')[0], 10) || 19));
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
    customResources.forEach((res) => {
      if (res) found.add(res);
    });
    if (found.size === 0) {
      return ['Atención General', 'Asesoría VIP'];
    }
    return Array.from(found);
  }, [appointments, teamAgents, customResources]);

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
    const dayOfWeek = d.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
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

  // Filtered Appointments
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

  // Unique clients count across all time
  const totalClientsAllTime = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      const key = (a.phone_number || a.customer_name || '').trim();
      if (key && !['cancelled', 'no_show'].includes(a.status)) {
        set.add(key);
      }
    });
    return set.size;
  }, [appointments]);

  // Monthly revenue metrics
  const monthMetrics = useMemo(() => {
    const selYear = selectedDate.getFullYear();
    const selMonth = selectedDate.getMonth();
    const monthAppts = appointments.filter((a) => {
      if (!a.scheduled_time || ['cancelled', 'no_show'].includes(a.status)) return false;
      const d = new Date(a.scheduled_time);
      return d.getFullYear() === selYear && d.getMonth() === selMonth;
    });
    const clientCount = monthAppts.length;
    const estimatedRev = clientCount * 35;
    const mName = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-EC', { month: 'long' }).format(selectedDate);
    const capitalizedMonth = mName.charAt(0).toUpperCase() + mName.slice(1);
    return { clientCount, estimatedRev, monthName: capitalizedMonth };
  }, [appointments, selectedDate, language]);

  // Header short date e.g. "5 de Sep" or "Sep 5" (matching Captura 1)
  const headerShortDate = useMemo(() => {
    try {
      const d = selectedDate.getDate();
      const mStr = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-EC', {
        month: 'short',
      }).format(selectedDate);
      const cleanM = mStr.replace('.', '');
      const capM = cleanM.charAt(0).toUpperCase() + cleanM.slice(1);
      return language === 'en' ? `${capM} ${d}` : `${d} de ${capM}`;
    } catch {
      return selectedDateStr;
    }
  }, [selectedDate, selectedDateStr, language]);

  // Aggregated contacts list from CRM and Appointments
  const contactsList = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Add CRM contacts
    if (Array.isArray(contacts)) {
      contacts.forEach((c) => {
        const phone = (c.phone_number || '').trim();
        const name = (c.customer_name || c.name || '').trim();
        const key = phone || name || c.id;
        if (!key) return;
        map.set(key, {
          id: c.id,
          name: name || 'Cliente',
          phone: phone,
          email: c.email || '',
          responsible: c.assigned_to || c.agent || 'Atención General',
          created_at: c.created_at || new Date().toISOString(),
          journey: c.status || 'Cliente CRM',
          activity: 'Sin actividad planeada',
          totalBookings: 0,
          hasIncoming: false,
          hasPlanned: false,
        });
      });
    }

    // 2. Add or enrich from Appointments
    if (Array.isArray(appointments)) {
      appointments.forEach((a) => {
        const phone = (a.phone_number || '').trim();
        const name = (a.customer_name || '').trim();
        const key = phone || name || a.id;
        if (!key) return;

        const isPending = a.status === 'pending';
        const isConfirmed = a.status === 'confirmed';
        const isFuture = a.scheduled_time && new Date(a.scheduled_time) >= new Date();

        const apptDateStr = a.scheduled_time
          ? new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.scheduled_time))
          : '';

        const existing = map.get(key);
        if (existing) {
          existing.totalBookings = (existing.totalBookings || 0) + 1;
          if (isPending) existing.hasIncoming = true;
          if (isConfirmed && isFuture) existing.hasPlanned = true;
          if (a.scheduled_time && (!existing.lastScheduledTime || new Date(a.scheduled_time) > new Date(existing.lastScheduledTime))) {
            existing.lastScheduledTime = a.scheduled_time;
            existing.activity = `${a.service || 'Cita'}: ${apptDateStr}`;
            existing.responsible = a.resource_name || existing.responsible;
            existing.journey = isConfirmed ? 'Confirmada' : a.status === 'completed' ? 'Atendida' : 'Reserva Online';
          }
        } else {
          map.set(key, {
            id: a.id,
            name: name || 'Cliente',
            phone: phone,
            email: a.email || '',
            responsible: a.resource_name || 'Atención General',
            created_at: a.created_at || a.scheduled_time || new Date().toISOString(),
            journey: isConfirmed ? 'Confirmada' : a.status === 'completed' ? 'Atendida' : 'Reserva Online',
            activity: a.scheduled_time ? `${a.service || 'Cita'}: ${apptDateStr}` : 'Sin actividad planeada',
            totalBookings: 1,
            lastScheduledTime: a.scheduled_time,
            hasIncoming: isPending,
            hasPlanned: isConfirmed && isFuture,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [contacts, appointments]);

  // Counts for subheader
  const incomingCount = useMemo(() => contactsList.filter((c) => c.hasIncoming).length, [contactsList]);
  const plannedCount = useMemo(() => contactsList.filter((c) => c.hasPlanned).length, [contactsList]);

  // Filtered contacts based on search, active tag, and advanced filter form
  const filteredContacts = useMemo(() => {
    let list = [...contactsList];

    // Filter by tag
    if (activeFilterTag === 'Entrante') {
      list = list.filter((c) => c.hasIncoming);
    } else if (activeFilterTag === 'Planeado') {
      list = list.filter((c) => c.hasPlanned);
    } else if (activeFilterTag === 'Mis contactos') {
      list = list.filter((c) =>
        (c.responsible || '').toLowerCase().includes('yo') ||
        (c.responsible || '').toLowerCase().includes('asesor') ||
        (c.responsible || '').toLowerCase().includes('general')
      );
    }

    // Filter by advanced form fields (Captura 3)
    if (filterForm.nombre?.trim()) {
      const q = filterForm.nombre.toLowerCase().trim();
      list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
    }
    if (filterForm.apellido?.trim()) {
      const q = filterForm.apellido.toLowerCase().trim();
      list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
    }
    if (filterForm.telefono?.trim()) {
      const q = filterForm.telefono.replace(/[^0-9]/g, '');
      list = list.filter((c) => (c.phone || '').replace(/[^0-9]/g, '').includes(q));
    }
    if (filterForm.email?.trim()) {
      const q = filterForm.email.toLowerCase().trim();
      list = list.filter((c) => (c.email || '').toLowerCase().includes(q));
    }
    if (filterForm.responsable?.trim()) {
      const q = filterForm.responsable.toLowerCase().trim();
      list = list.filter((c) => (c.responsible || '').toLowerCase().includes(q));
    }
    if (filterForm.creadoPor?.trim()) {
      const q = filterForm.creadoPor.toLowerCase().trim();
      list = list.filter((c) => (c.responsible || '').toLowerCase().includes(q));
    }
    if (filterForm.modificadoPor?.trim()) {
      const q = filterForm.modificadoPor.toLowerCase().trim();
      list = list.filter((c) => (c.responsible || '').toLowerCase().includes(q));
    }
    if (filterForm.journey?.trim()) {
      const q = filterForm.journey.toLowerCase().trim();
      list = list.filter((c) => (c.journey || '').toLowerCase().includes(q));
    }
    if (filterForm.origen?.trim()) {
      const q = filterForm.origen.toLowerCase().trim();
      list = list.filter((c) => (c.source || c.channel || 'crm').toLowerCase().includes(q));
    }
    if (filterForm.tipoContacto?.trim()) {
      const q = filterForm.tipoContacto.toLowerCase().trim();
      list = list.filter((c) => (c.type || c.journey || '').toLowerCase().includes(q));
    }
    if (filterForm.compania?.trim()) {
      const q = filterForm.compania.toLowerCase().trim();
      list = list.filter((c) => (c.company || c.name || '').toLowerCase().includes(q));
    }
    if (filterForm.cargo?.trim()) {
      const q = filterForm.cargo.toLowerCase().trim();
      list = list.filter((c) => (c.position || '').toLowerCase().includes(q));
    }
    if (filterForm.comentario?.trim()) {
      const q = filterForm.comentario.toLowerCase().trim();
      list = list.filter((c) => (c.notes || c.comment || '').toLowerCase().includes(q));
    }
    if (filterForm.creadoEl?.trim()) {
      const q = filterForm.creadoEl.trim();
      list = list.filter((c) => (c.created_at || '').includes(q));
    }
    if (filterForm.modificadoEl?.trim()) {
      const q = filterForm.modificadoEl.trim();
      list = list.filter((c) => (c.created_at || '').includes(q));
    }
    if (filterForm.utmSource?.trim()) {
      const q = filterForm.utmSource.toLowerCase().trim();
      list = list.filter((c) => (c.utm_source || '').toLowerCase().includes(q));
    }
    if (filterForm.utmCampaign?.trim()) {
      const q = filterForm.utmCampaign.toLowerCase().trim();
      list = list.filter((c) => (c.utm_campaign || '').toLowerCase().includes(q));
    }
    if (filterForm.tieneTelefono?.toLowerCase() === 'si' || filterForm.tieneTelefono?.toLowerCase() === 'sí') {
      list = list.filter((c) => !!c.phone);
    }
    if (filterForm.tieneEmail?.toLowerCase() === 'si' || filterForm.tieneEmail?.toLowerCase() === 'sí') {
      list = list.filter((c) => !!c.email);
    }
    if (filterForm.actividadEstado?.trim()) {
      const q = filterForm.actividadEstado.toLowerCase().trim();
      list = list.filter((c) => (c.activity || '').toLowerCase().includes(q));
    }
    if (filterForm.actividadTipo?.trim()) {
      const q = filterForm.actividadTipo.toLowerCase().trim();
      list = list.filter((c) => (c.activity || '').toLowerCase().includes(q));
    }
    if (filterForm.actividadFechaLimite?.trim()) {
      const q = filterForm.actividadFechaLimite.trim();
      list = list.filter((c) => (c.lastScheduledTime || '').includes(q));
    }
    if (filterForm.origenActividad?.trim()) {
      const q = filterForm.origenActividad.toLowerCase().trim();
      list = list.filter((c) => (c.activity || '').toLowerCase().includes(q));
    }

    // Filter by quick text search in bar
    if (contactsSearch.trim()) {
      const q = contactsSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.activity || '').toLowerCase().includes(q) ||
          (c.responsible || '').toLowerCase().includes(q) ||
          (c.journey || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return contactsSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    return list;
  }, [contactsList, activeFilterTag, filterForm, contactsSearch, contactsSortAsc]);

  // Real-time Current Time line
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

  // Format date display for header
  const headerDateTitle = useMemo(() => {
    return new Intl.DateTimeFormat('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(selectedDate);
  }, [selectedDate]);

  // Días laborables configurados en el CRM (default: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 0=Dom)
  const businessDays = useMemo(() => {
    if (Array.isArray(configData?.business_days) && configData.business_days.length > 0) {
      return configData.business_days;
    }
    return [1, 2, 3, 4, 5];
  }, [configData?.business_days]);

  // Comprobar si una fecha es día no laborable (sin atención)
  const checkIsNonWorkingDay = useCallback((targetDate: Date | string) => {
    let dayOfWeek: number;
    if (typeof targetDate === 'string') {
      const parts = targetDate.split('T')[0].split('-').map(Number);
      if (parts.length !== 3) return false;
      dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    } else {
      dayOfWeek = targetDate.getDay();
    }
    return !businessDays.includes(dayOfWeek);
  }, [businessDays]);

  // Si el día actualmente seleccionado es no laborable
  const isSelectedDateNonWorking = useMemo(() => {
    return checkIsNonWorkingDay(selectedDate);
  }, [selectedDate, checkIsNonWorkingDay]);

  // Habilitar con 1 clic un día de la semana y guardar en backend
  const handleQuickEnableDay = async (dayOfWeek: number) => {
    const current = configData?.business_days || [];
    if (!current.includes(dayOfWeek)) {
      const updated = [...current, dayOfWeek].sort();
      setConfigData((prev: any) => ({ ...prev, business_days: updated }));
      if (onSaveSchedule) {
        await onSaveSchedule({
          business_days: updated,
          business_start_hour: configData?.business_start_hour || '09:00',
          business_end_hour: configData?.business_end_hour || '18:00',
        });
      }
    }
  };

  // Mini Calendar generation
  const miniCalendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx === -1) startDayIdx = 6;

    const days: {
      date: Date;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      hasAppointments: boolean;
      isSelected: boolean;
      isToday: boolean;
      isNonWorkingDay: boolean;
    }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

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
        isNonWorkingDay: !businessDays.includes(d.getDay()),
      });
    }

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
        isNonWorkingDay: !businessDays.includes(d.getDay()),
      });
    }

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
        isNonWorkingDay: !businessDays.includes(d.getDay()),
      });
    }

    return days;
  }, [currentMonthDate, selectedDateStr, appointments, businessDays]);

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(currentMonthDate);
  }, [currentMonthDate]);

  const renderWaitlistCard = (wItem: any, seniority: 'today' | 'this_week' | 'older') => {
    const parsed = parseWaitlistNotes(wItem.notes);
    const matchedContact = contacts?.find(
      (c) =>
        (wItem.conversation_id && c.id === wItem.conversation_id) ||
        (wItem.phone_number && (c.phone_number === wItem.phone_number || c.phone === wItem.phone_number)) ||
        (wItem.customer_name && (c.customer_name === wItem.customer_name || c.name === wItem.customer_name))
    );
    const companyDisplay = parsed.company || matchedContact?.company;
    const emailDisplay = parsed.email || matchedContact?.email;
    const isDeleting = waitlistDeletingId === wItem.id;

    return (
      <div
        key={wItem.id}
        className="p-3 bg-white dark:bg-slate-800 border border-amber-200/70 dark:border-amber-900/40 rounded-xl hover:shadow-md transition-all group space-y-2"
      >
        {/* Top: Name, Company, Seniority Pill */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
              <span>{wItem.customer_name}</span>
              {companyDisplay && (
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1 py-0.2 rounded truncate max-w-[120px]">
                  🏢 {companyDisplay}
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
              <span>{wItem.service || 'General'}</span>
              {wItem.resource_name && <span>• 👤 {wItem.resource_name}</span>}
            </p>
          </div>

          <span
            className={`text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
              seniority === 'today'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : seniority === 'this_week'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
            }`}
          >
            {seniority === 'today'
              ? (language === 'en' ? 'Today' : 'Hoy')
              : seniority === 'this_week'
              ? (language === 'en' ? 'This week' : 'Semana actual')
              : (language === 'en' ? 'Older' : 'Semana anterior')}
          </span>
        </div>

        {/* Date & Time Preferences */}
        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">
          <span className="font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-amber-500">event</span>
            <span>{wItem.desired_date}</span>
          </span>
          <span className="font-bold text-amber-700 dark:text-amber-400">
            {wItem.preferred_time_range === 'any'
              ? (language === 'en' ? 'Any time' : 'Cualquier hora')
              : wItem.preferred_time_range === 'morning'
              ? (language === 'en' ? 'Morning (09-13)' : 'Mañana (09-13)')
              : wItem.preferred_time_range === 'afternoon'
              ? (language === 'en' ? 'Afternoon (14-18)' : 'Tarde (14-18)')
              : wItem.preferred_time_range === 'evening'
              ? (language === 'en' ? 'Evening (18-21)' : 'Noche (18-21)')
              : wItem.preferred_time_range}
          </span>
        </div>

        {/* Schedule Preferences Note if present */}
        {parsed.schedulePreference && (
          <div className="p-1.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 rounded-lg text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1">
            <span className="material-symbols-outlined text-xs text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
              edit_note
            </span>
            <span className="line-clamp-2 leading-tight">
              <strong>{language === 'en' ? 'Note:' : 'Nota:'}</strong> {parsed.schedulePreference}
            </span>
          </div>
        )}

        {/* Contact info & Action buttons */}
        {isDeleting ? (
          <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1.5 text-center">
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
              {language === 'en' ? 'Discard this request?' : '¿Descartar solicitud obsoleta?'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setWaitlistDeletingId(null)}
                className="px-2 py-0.5 text-[9px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onWaitlistStatus(wItem.id, 'cancelled');
                  setWaitlistDeletingId(null);
                }}
                className="px-2 py-0.5 text-[9px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
              >
                {language === 'en' ? 'Yes, discard' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 dark:border-slate-700/60">
            <div className="min-w-0 pr-1">
              <span className="font-mono text-slate-500 dark:text-slate-400 block truncate">{wItem.phone_number}</span>
              {emailDisplay && <span className="text-[9px] text-slate-400 truncate block">{emailDisplay}</span>}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* WhatsApp Notify */}
              <button
                type="button"
                onClick={() => onWaitlistNotify(wItem.id)}
                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer"
                title={language === 'en' ? 'Notify via WhatsApp' : 'Notificar por WhatsApp'}
              >
                <span className="material-symbols-outlined text-xs">send</span>
              </button>

              {/* Trasladar al calendario */}
              <button
                type="button"
                onClick={() =>
                  onOpenBooking({
                    customer_name: wItem.customer_name,
                    phone_number: wItem.phone_number,
                    service: wItem.service,
                    resource_name: wItem.resource_name,
                    date: wItem.desired_date || selectedDateStr,
                  })
                }
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black flex items-center gap-1 shadow-sm cursor-pointer"
                title={language === 'en' ? 'Transfer to calendar' : 'Trasladar al calendario'}
              >
                <span className="material-symbols-outlined text-xs">calendar_month</span>
                <span>{language === 'en' ? 'Book' : 'Trasladar'}</span>
              </button>

              {/* Descartar / Eliminar */}
              <button
                type="button"
                onClick={() => setWaitlistDeletingId(wItem.id)}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                title={language === 'en' ? 'Discard obsolete request' : 'Descartar solicitud obsoleta'}
              >
                <span className="material-symbols-outlined text-xs">delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all">
      {/* ========================================================================= */}
      {/* 0. BITRIX24 TOP NAVIGATION TABS (Reservas, Horarios, Métricas, Recursos) */}
      {/* ========================================================================= */}
      <div className="bg-[#0f172a] px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setActiveSection('timeline')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'timeline'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_month</span>
            <span>{language === 'en' ? 'Online Bookings' : 'Reserva Online'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('metrics')}
            className={`px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'metrics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">analytics</span>
            <span>{language === 'en' ? 'Metrics & Rates' : 'Métricas y Rendimiento'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('resources')}
            className={`px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'resources'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">badge</span>
            <span>{language === 'en' ? 'Resources & Staff' : 'Recursos y Especialistas'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('waitlist')}
            className={`px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeSection === 'waitlist'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">hourglass_top</span>
            <span>{language === 'en' ? 'Waitlist' : 'Lista de Espera'}</span>
            {waitlist.filter((w) => w.status === 'waiting').length > 0 && (
              <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {waitlist.filter((w) => w.status === 'waiting').length}
              </span>
            )}
          </button>
        </div>

        {/* Quick action: + Nueva Cita */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenBooking({ date: selectedDateStr })}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>{language === 'en' ? 'New Booking' : 'Nueva Cita'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN PRINCIPAL SEGÚN PESTAÑA ACTIVA */}
      {/* ========================================================================= */}

      {/* A. VISTA 1: AGENDA TIMELINE Y SCHEDULER */}
      {activeSection === 'timeline' && (
        <div className="flex flex-col">
          {/* Top Header Bar inside Timeline */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900">
            {/* Title & Date Navigator - Exact order from Captura 1 */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3.5 flex-wrap">
                {/* 1. Reserva online Title */}
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {language === 'en' ? 'Online booking' : 'Reserva online'}
                </h2>

                {/* 2. Date (e.g. "5 de Sep") */}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  {headerShortDate}
                </span>

                {/* 3. Stacked Interactive Metrics with Dotted Underlines & Hover Tooltips */}
                <div className="flex flex-col text-[11px] leading-tight font-medium ml-0.5">
                  {/* Top Line: + 0 clientes */}
                  <div
                    className="relative inline-block"
                    onMouseEnter={() => setHoveredTooltip('clients')}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setShowContactsModal(true)}
                      className="text-slate-700 dark:text-slate-200 border-b border-dotted border-slate-400 dark:border-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 transition-colors cursor-pointer text-left"
                    >
                      + {dayMetrics.clientCount} {language === 'en' ? 'clients' : 'clientes'}
                    </button>

                    {/* Tooltip Popover Clientes (Captura 3) */}
                    {hoveredTooltip === 'clients' && (
                      <div className="absolute left-0 top-full pt-2 z-50">
                        <div
                          className="relative w-56 bg-blue-600 dark:bg-blue-600 rounded-2xl p-4 text-white shadow-2xl shadow-blue-900/40 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150"
                          style={{ filter: 'drop-shadow(0 10px 20px rgba(29,78,216,0.35))' }}
                        >
                          {/* Triangle arrow pointing up */}
                          <div className="absolute -top-1.5 left-5 w-3 h-3 bg-blue-600 rotate-45 transform rounded-xs" />

                          <h4 className="text-sm font-bold text-white mb-2 leading-none">
                            {language === 'en' ? 'Clients' : 'Clientes'}
                          </h4>

                          <div className="space-y-1 text-xs text-blue-50">
                            <div className="flex items-center justify-between py-0.5">
                              <span>{language === 'en' ? 'New today:' : 'Nuevos hoy:'}</span>
                              <span className="font-semibold text-white">+{dayMetrics.clientCount}</span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                              <span>{language === 'en' ? 'All time:' : 'Desde siempre:'}</span>
                              <span className="font-semibold text-white">{totalClientsAllTime}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setHoveredTooltip(null);
                              setShowContactsModal(true);
                            }}
                            className="w-full mt-3 py-1.5 px-3 rounded-lg border border-white/40 hover:bg-white/15 text-[11px] font-bold text-white uppercase tracking-wider transition-all cursor-pointer text-center"
                          >
                            {language === 'en' ? 'View contacts' : 'VER LOS CLIENTES'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Line: + $0 */}
                  <div
                    className="relative inline-block mt-0.5"
                    onMouseEnter={() => setHoveredTooltip('revenue')}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <span className="text-slate-700 dark:text-slate-200 border-b border-dotted border-slate-400 dark:border-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 transition-colors cursor-pointer select-none">
                      + ${dayMetrics.estimatedRev}
                    </span>

                    {/* Tooltip Popover Ganancias (Captura 4) */}
                    {hoveredTooltip === 'revenue' && (
                      <div className="absolute left-0 top-full pt-2 z-50">
                        <div
                          className="relative w-52 bg-blue-600 dark:bg-blue-600 rounded-2xl p-4 text-white shadow-2xl shadow-blue-900/40 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150"
                          style={{ filter: 'drop-shadow(0 10px 20px rgba(29,78,216,0.35))' }}
                        >
                          {/* Triangle arrow pointing up */}
                          <div className="absolute -top-1.5 left-5 w-3 h-3 bg-blue-600 rotate-45 transform rounded-xs" />

                          <h4 className="text-sm font-bold text-white mb-2 leading-none">
                            {language === 'en' ? 'Earnings' : 'Ganancias'}
                          </h4>

                          <div className="space-y-1 text-xs text-blue-50">
                            <div className="flex items-center justify-between py-0.5">
                              <span>{language === 'en' ? 'Today:' : 'Hoy:'}</span>
                              <span className="font-semibold text-white">+${dayMetrics.estimatedRev}</span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                              <span>{monthMetrics.monthName}:</span>
                              <span className="font-semibold text-white">${monthMetrics.estimatedRev}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Date controls (< Hoy >) */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
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
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setCurrentMonthDate(today);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {language === 'en' ? 'Today' : 'Hoy'}
                </button>
                <button
                  type="button"
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

            {/* Quick Status Badges & Controls */}
            <div className="flex items-center gap-2.5 flex-wrap ml-auto">
              {/* Search */}
              <div className="relative w-40 sm:w-52">
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Filter...' : 'Filtrar'}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl py-1.5 pl-3 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  search
                </span>
              </div>

              {/* Bitrix Style Status Chips */}
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                  statusFilter === 'pending'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/60" />
                <span>{language === 'en' ? 'Unconfirmed' : 'No confirmado'}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                  statusFilter === 'pending'
                    ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                }`}>
                  {appointments.filter((a) => a.status === 'pending').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                  statusFilter === 'confirmed'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/60" />
                <span>{language === 'en' ? 'Confirmed' : 'Confirmadas'}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                  statusFilter === 'confirmed'
                    ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                }`}>
                  {appointments.filter((a) => a.status === 'confirmed').length}
                </span>
              </button>

              {/* View Switcher: [Día] [Semana] [Tabla] */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    viewMode === 'day'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {language === 'en' ? 'Day' : 'Día'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    viewMode === 'week'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {language === 'en' ? 'Week' : 'Semana'}
                </button>
                {onSwitchToTable && (
                  <button
                    type="button"
                    onClick={onSwitchToTable}
                    className="px-2.5 py-1 rounded-lg text-xs font-black text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                    title="Vista de Tabla detallada"
                  >
                    <span className="material-symbols-outlined text-sm">table_rows</span>
                    <span className="hidden sm:inline">{language === 'en' ? 'Table' : 'Tabla'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sub-bar: + Agregar un recurso button & Quick Working Hours Pill */}
          <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddResourceModal(true)}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 border border-slate-200 dark:border-slate-600 rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-blue-600">person_add</span>
                <span>{language === 'en' ? 'Add Resource / Staff' : 'Agregar un recurso'}</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700">|</span>

              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 font-bold cursor-pointer px-2.5 py-1 rounded-xl hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all shadow-none hover:shadow-sm"
                title="Haga clic para editar días laborables y horario"
              >
                <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">schedule</span>
                <span>
                  {language === 'en' ? 'Hours' : 'Horario'}: {configData?.business_start_hour || '08:00'} - {configData?.business_end_hour || '19:00'}
                </span>
                <span className="material-symbols-outlined text-xs text-slate-400">edit</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px] font-bold">
              <span>{resourcesList.length} {language === 'en' ? 'Active Resources' : 'Recursos activos'}</span>
            </div>
          </div>

          {/* Timeline Workspace: Left Grid + Right Sidebar */}
          <div className="flex flex-col lg:flex-row flex-1 min-h-[640px] overflow-hidden">
            {/* TIMELINE GRID */}
            <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 overflow-x-auto min-w-[340px]">
              {/* Column Headers */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 sticky top-0 z-20">
                <div className="w-16 sm:w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 p-3 flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-base">schedule</span>
                </div>

                {viewMode === 'day' ? (
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
                            type="button"
                            onClick={() => onOpenBooking({ resource_name: resourceName, date: selectedDateStr })}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-xs cursor-pointer"
                            title="Agendar con este especialista"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800">
                    {weekDays.map((wDay, idx) => {
                      const count = filteredAppointments.filter(
                        (a) => a.scheduled_time && a.scheduled_time.startsWith(wDay.dateStr)
                      ).length;
                      const isDayNonWorking = checkIsNonWorkingDay(wDay.date);
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
                              : isDayNonWorking
                              ? 'bg-rose-50/25 dark:bg-rose-950/15 hover:bg-rose-50/40'
                              : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isDayNonWorking ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'
                            }`}>
                              {wDay.label}
                            </span>
                            {isDayNonWorking && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-xs" title="Día sin atención comercial" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                                wDay.isToday
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : wDay.isSelected
                                  ? 'border-2 border-blue-600 text-blue-600 dark:text-blue-400'
                                  : isDayNonWorking
                                  ? 'text-rose-600 dark:text-rose-400 font-extrabold'
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
                {/* Real-time Indicator Line */}
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

                {/* Banner de Día No Laborable / Sin Atención */}
                {viewMode === 'day' && isSelectedDateNonWorking && (
                  <div className="p-4 mx-4 my-3 rounded-2xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0">
                        <span className="material-symbols-outlined text-xl">event_busy</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                            {language === 'en' ? 'Non-working Day (No Attention)' : 'Día No Laborable (Sin Atención)'}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-700 dark:text-rose-300">
                            {language === 'en' ? 'Reservations Locked' : 'Reservas Bloqueadas'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                          {language === 'en'
                            ? 'This day is not active in your business hours. Reservations are disabled for this date.'
                            : 'Este día no está marcado en tu horario comercial. Las reservas están desactivadas para esta fecha.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickEnableDay(selectedDate.getDay())}
                      disabled={isSavingSchedule}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>{language === 'en' ? 'Enable Bookings for this Day' : 'Habilitar Reservas para este Día'}</span>
                    </button>
                  </div>
                )}

                {/* Grid */}
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

                  {/* Columns */}
                  {viewMode === 'day' ? (
                    <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800 relative">
                      {resourcesList.map((resourceName, colIdx) => {
                        const colAppts = dayAppointments.filter(
                          (a) => (a.resource_name || 'Atención General') === resourceName
                        );

                        return (
                          <div key={colIdx} className="flex-1 min-w-[200px] relative">
                            {hoursArray.map((hour) => {
                              const timeStr = `${String(hour).padStart(2, '0')}:00`;
                              return (
                                <div
                                  key={hour}
                                  style={{ height: `${hourRowHeight}px` }}
                                  onClick={() => {
                                    if (isSelectedDateNonWorking) {
                                      setShowScheduleModal(true);
                                      return;
                                    }
                                    onOpenBooking({
                                      date: selectedDateStr,
                                      time: timeStr,
                                      resource_name: resourceName,
                                    });
                                  }}
                                  className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors relative group ${
                                    isSelectedDateNonWorking
                                      ? 'bg-slate-50/70 dark:bg-slate-900/60 cursor-not-allowed opacity-75'
                                      : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer'
                                  }`}
                                >
                                  <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-slate-100 dark:border-slate-800/40 pointer-events-none" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {isSelectedDateNonWorking ? (
                                      <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">block</span>
                                        <span>{language === 'en' ? 'Closed (Enable)' : 'Sin atención (Habilitar)'}</span>
                                      </span>
                                    ) : (
                                      <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">add</span>
                                        <span>{timeStr}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Appointment Cards */}
                            {colAppts.map((appt) => {
                              const date = new Date(appt.scheduled_time);
                              const apptHour = date.getHours() + date.getMinutes() / 60;
                              if (apptHour < startHour || apptHour > endHour + 1) return null;

                              const durationMinutes = appt.duration_minutes || 60;
                              const top = (apptHour - startHour) * hourRowHeight;
                              const height = Math.max(36, (durationMinutes / 60) * hourRowHeight - 4);
                              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;

                              const startDate = new Date(appt.scheduled_time);
                              const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                              const startStr = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit', hour12: true }).format(startDate);
                              const endStr = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit', hour12: true }).format(endDate);
                              const timeFormatted = `${startStr} – ${endStr}`;

                              return (
                                  <motion.div
                                    key={appt.id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{ top: `${top}px`, height: `${height}px` }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedApptDetails(appt);
                                    }}
                                    className={`absolute left-2 right-2 rounded-2xl px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 border-l-[5px] ${statusConf.accentBorder} shadow-xs hover:shadow-lg transition-all cursor-pointer z-10 flex items-center justify-between gap-3 group ${statusConf.glow}`}
                                  >
                                    {/* Left: Initials Avatar + Client & Service */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xs text-slate-700 dark:text-slate-200 shrink-0 group-hover:scale-105 transition-transform">
                                        {appt.customer_name ? appt.customer_name.slice(0, 2).toUpperCase() : 'CI'}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                            {appt.customer_name || 'Cliente'}
                                          </h4>
                                          <span className={`w-2 h-2 rounded-full ${statusConf.dot} shrink-0`} />
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                                          {appt.service || 'Asesoría'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Center: Specialist badge & Phone */}
                                    <div className="hidden md:flex items-center gap-2.5 shrink-0">
                                      {appt.resource_name && (
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                          <span className="material-symbols-outlined text-xs">person</span>
                                          <span>{appt.resource_name}</span>
                                        </span>
                                      )}
                                      {appt.phone_number && (
                                        <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-xs text-emerald-500">chat</span>
                                          <span>{appt.phone_number}</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Right: Time badge + Status badge */}
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] font-mono font-black text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs text-blue-500">schedule</span>
                                        <span>{timeFormatted}</span>
                                      </span>
                                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${statusConf.badgeBg}`}>
                                        {statusConf.label}
                                      </span>
                                    </div>
                                  </motion.div>
                                );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex divide-x divide-slate-100 dark:divide-slate-800 relative">
                      {weekDays.map((wDay, colIdx) => {
                        const colAppts = filteredAppointments.filter(
                          (a) => a.scheduled_time && a.scheduled_time.startsWith(wDay.dateStr)
                        );
                        const isColDayNonWorking = checkIsNonWorkingDay(wDay.date);

                        return (
                          <div key={colIdx} className={`flex-1 min-w-[130px] relative ${
                            isColDayNonWorking ? 'bg-slate-50/40 dark:bg-slate-900/40' : ''
                          }`}>
                            {hoursArray.map((hour) => {
                              const timeStr = `${String(hour).padStart(2, '0')}:00`;
                              return (
                                <div
                                  key={hour}
                                  style={{ height: `${hourRowHeight}px` }}
                                  onClick={() => {
                                    if (isColDayNonWorking) {
                                      setShowScheduleModal(true);
                                      return;
                                    }
                                    onOpenBooking({
                                      date: wDay.dateStr,
                                      time: timeStr,
                                    });
                                  }}
                                  className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors relative group ${
                                    isColDayNonWorking
                                      ? 'cursor-not-allowed opacity-75'
                                      : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer'
                                  }`}
                                >
                                  <div className="absolute left-0 right-0 top-1/2 border-b border-dashed border-slate-100 dark:border-slate-800/40 pointer-events-none" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {isColDayNonWorking ? (
                                      <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                        {language === 'en' ? 'Closed' : 'Cerrado'}
                                      </span>
                                    ) : (
                                      <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                        + {timeStr}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {colAppts.map((appt) => {
                              const date = new Date(appt.scheduled_time);
                              const apptHour = date.getHours() + date.getMinutes() / 60;
                              if (apptHour < startHour || apptHour > endHour + 1) return null;

                              const durationMinutes = appt.duration_minutes || 60;
                              const top = (apptHour - startHour) * hourRowHeight;
                              const height = Math.max(30, (durationMinutes / 60) * hourRowHeight - 3);
                              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;

                              const startDate = new Date(appt.scheduled_time);
                              const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                              const startStr = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit', hour12: true }).format(startDate);
                              const endStr = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit', hour12: true }).format(endDate);
                              const timeFormatted = `${startStr} – ${endStr}`;

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
                                  className={`absolute left-1 right-1 rounded-xl p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${statusConf.accentBorder} shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden z-10 flex flex-col justify-between`}
                                >
                                  <div className="truncate">
                                    <div className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} shrink-0`} />
                                      <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                                        {appt.customer_name}
                                      </p>
                                    </div>
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold truncate pl-2.5">
                                      {appt.service}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                                      {timeFormatted}
                                    </span>
                                    <span className={`font-bold capitalize text-[9px] ${statusConf.text}`}>
                                      {statusConf.label}
                                    </span>
                                  </div>
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

              {/* Bottom Scale Controls */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">tune</span>
                  <span className="font-bold">{language === 'en' ? 'Scale' : 'Escala'}:</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.15))}
                    className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
                    className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
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

            {/* RIGHT SIDEBAR: MINI CALENDAR + LISTA DE ESPERA */}
            <div className="w-full lg:w-80 shrink-0 flex flex-col bg-slate-50/40 dark:bg-slate-900/60 p-4 space-y-6">
              {/* Mini Calendar */}
              <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-800 dark:text-white capitalize">
                    {monthName}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = new Date(currentMonthDate);
                        prev.setMonth(prev.getMonth() - 1);
                        setCurrentMonthDate(prev);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(currentMonthDate);
                        next.setMonth(next.getMonth() + 1);
                        setCurrentMonthDate(next);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
                    <span key={i} className="text-[10px] font-black text-slate-400">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {miniCalendarDays.map((cDay, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setSelectedDate(cDay.date);
                        if (!cDay.isCurrentMonth) {
                          setCurrentMonthDate(cDay.date);
                        }
                      }}
                      title={
                        cDay.isNonWorkingDay
                          ? (language === 'en' ? 'Non-working day (no attention)' : 'Día sin atención (no reservable)')
                          : undefined
                      }
                      className={`h-7 w-7 mx-auto rounded-lg text-xs font-bold transition-all relative flex items-center justify-center cursor-pointer ${
                        cDay.isSelected
                          ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30'
                          : cDay.isToday
                          ? 'border border-blue-500 text-blue-600 dark:text-blue-400'
                          : cDay.isNonWorkingDay
                          ? cDay.isCurrentMonth
                            ? 'text-rose-600 dark:text-rose-500 font-black hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-rose-300/60 dark:text-rose-900/60 font-semibold'
                          : cDay.isCurrentMonth
                          ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      <span>{cDay.dayNum}</span>
                      {cDay.hasAppointments && !cDay.isSelected && (
                        <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${cDay.isNonWorkingDay ? 'bg-rose-500' : 'bg-blue-500'}`} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Leyenda de Días */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {language === 'en' ? 'Non-working (red)' : 'Sin atención (rojo)'}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {language === 'en' ? 'Active days' : 'Con atención'}
                  </span>
                </div>
              </div>

              {/* Waitlist drop-zone widget (Bitrix24 Style: Collapsible, Seniority Grouped, Agile Reassignment) */}
              {isWaitlistCollapsed ? (
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/60 shadow-sm transition-all">
                  <div
                    onClick={() => setIsWaitlistCollapsed(false)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-750/50 p-1.5 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-lg">hourglass_top</span>
                      <div>
                        <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          {language === 'en' ? 'Waitlist' : 'Lista de espera'}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {groupedWaitlist.totalCount === 1
                            ? `1 ${language === 'en' ? 'request' : 'solicitud en espera'}`
                            : `${groupedWaitlist.totalCount} ${language === 'en' ? 'requests' : 'solicitudes en espera'}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {groupedWaitlist.totalCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                          {groupedWaitlist.totalCount}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsWaitlistCollapsed(false);
                        }}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                        title={language === 'en' ? 'Expand waitlist' : 'Expandir lista de espera'}
                      >
                        <span className="material-symbols-outlined text-xs">unfold_more</span>
                        <span>{language === 'en' ? 'Expand' : 'Expandir'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60 shadow-sm flex flex-col flex-1 min-h-[340px]">
                  {/* Header Bitrix24 Clean & Structured */}
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-700/50 mb-3 space-y-2">
                    {/* Fila Principal: Título + Botón Primario Agregar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-sm">hourglass_top</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider whitespace-nowrap">
                          {language === 'en' ? 'Waitlist' : 'Lista de espera'}
                        </h3>
                        {groupedWaitlist.totalCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0">
                            {groupedWaitlist.totalCount}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={onOpenAddWaitlist}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        <span>{language === 'en' ? 'Add' : 'Agregar'}</span>
                      </button>
                    </div>

                    {/* Fila de Herramientas: ¿Cómo funciona? + Contraer Bloque */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => setShowWaitlistHelpModal(true)}
                        className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer group font-medium"
                      >
                        <span className="material-symbols-outlined text-xs text-blue-500 group-hover:scale-110 transition-transform">help</span>
                        <span>{language === 'en' ? 'How does it work?' : '¿Cómo funciona?'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsWaitlistCollapsed(true)}
                        className="hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors cursor-pointer group font-medium"
                      >
                        <span className="material-symbols-outlined text-xs group-hover:-translate-y-0.5 transition-transform">unfold_less</span>
                        <span>{language === 'en' ? 'Collapse' : 'Contraer'}</span>
                      </button>
                    </div>
                  </div>

                  {groupedWaitlist.totalCount > 0 ? (
                    <div className="flex flex-col flex-1 space-y-2.5">
                      {/* Seniority Filter Tabs */}
                      <div className="flex items-center gap-1 pb-1 overflow-x-auto text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setWaitlistSeniorityFilter('all')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            waitlistSeniorityFilter === 'all'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-black'
                              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {language === 'en' ? 'All' : 'Todos'} ({groupedWaitlist.totalCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaitlistSeniorityFilter('today')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            waitlistSeniorityFilter === 'today'
                              ? 'bg-emerald-600 text-white font-black'
                              : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{language === 'en' ? 'Today' : 'Hoy'}</span> ({groupedWaitlist.today.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaitlistSeniorityFilter('this_week')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            waitlistSeniorityFilter === 'this_week'
                              ? 'bg-blue-600 text-white font-black'
                              : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>{language === 'en' ? 'This week' : 'Esta semana'}</span> ({groupedWaitlist.thisWeek.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaitlistSeniorityFilter('older')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            waitlistSeniorityFilter === 'older'
                              ? 'bg-purple-600 text-white font-black'
                              : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span>{language === 'en' ? 'Older' : 'Anteriores'}</span> ({groupedWaitlist.older.length})
                        </button>
                      </div>

                      {/* Entries grouped by seniority */}
                      <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                        {/* 1. SECCIÓN HOY */}
                        {(waitlistSeniorityFilter === 'all' || waitlistSeniorityFilter === 'today') &&
                          groupedWaitlist.today.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-900/30">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-emerald-600">bolt</span>
                                  <span>{language === 'en' ? 'Today (Immediate Attention)' : 'Hoy (Atención Inmediata)'}</span>
                                </span>
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/70 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-[9px]">
                                  {groupedWaitlist.today.length}
                                </span>
                              </div>

                              {groupedWaitlist.today.map((wItem) => renderWaitlistCard(wItem, 'today'))}
                            </div>
                          )}

                        {/* 2. SECCIÓN SEMANA ACTUAL */}
                        {(waitlistSeniorityFilter === 'all' || waitlistSeniorityFilter === 'this_week') &&
                          groupedWaitlist.thisWeek.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-lg border border-blue-200/60 dark:border-blue-900/30">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-blue-600">date_range</span>
                                  <span>{language === 'en' ? 'This Week' : 'Semana Actual'}</span>
                                </span>
                                <span className="px-1.5 py-0.2 rounded-full bg-blue-200/70 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-[9px]">
                                  {groupedWaitlist.thisWeek.length}
                                </span>
                              </div>

                              {groupedWaitlist.thisWeek.map((wItem) => renderWaitlistCard(wItem, 'this_week'))}
                            </div>
                          )}

                        {/* 3. SECCIÓN SEMANA ANTERIOR / ANTERIORES */}
                        {(waitlistSeniorityFilter === 'all' || waitlistSeniorityFilter === 'older') &&
                          groupedWaitlist.older.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-black text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-200/60 dark:border-purple-900/30">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs text-purple-600">history</span>
                                  <span>{language === 'en' ? 'Previous Week / Older' : 'Semana Anterior / Más Antiguas'}</span>
                                </span>
                                <span className="px-1.5 py-0.2 rounded-full bg-purple-200/70 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[9px]">
                                  {groupedWaitlist.older.length}
                                </span>
                              </div>

                              {groupedWaitlist.older.map((wItem) => renderWaitlistCard(wItem, 'older'))}
                            </div>
                          )}

                        {/* Filtro específico vacío */}
                        {waitlistSeniorityFilter !== 'all' &&
                          ((waitlistSeniorityFilter === 'today' && groupedWaitlist.today.length === 0) ||
                            (waitlistSeniorityFilter === 'this_week' && groupedWaitlist.thisWeek.length === 0) ||
                            (waitlistSeniorityFilter === 'older' && groupedWaitlist.older.length === 0)) && (
                            <div className="py-8 text-center text-slate-400 text-xs">
                              {language === 'en'
                                ? 'No entries found in this seniority category.'
                                : 'No hay solicitudes en esta categoría de antigüedad.'}
                            </div>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-3 shadow-inner">
                        <span className="material-symbols-outlined text-2xl">content_paste</span>
                      </div>
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                        {language === 'en' ? 'Waitlist' : 'Lista de espera'}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3 max-w-[210px]">
                        {language === 'en'
                          ? 'Drag an existing online booking here, or click "Add" to create a new one.'
                          : 'Arrastre una reserva online existente aquí, o haga clic en "Agregar" para crear una nueva.'}
                      </p>
                      <button
                        type="button"
                        onClick={onOpenAddWaitlist}
                        className="mb-3 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs font-black">add</span>
                        <span>{language === 'en' ? 'Add request' : 'Agregar solicitud'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWaitlistHelpModal(true)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">help</span>
                        <span>{language === 'en' ? 'How does it work?' : '¿Cómo funciona?'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B. VISTA 2: MÉTRICAS Y RENDIMIENTO */}
      {activeSection === 'metrics' && (
        <div className="p-8 space-y-8 bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {language === 'en' ? 'Performance Metrics & Rates' : 'Métricas de Gestión y Tasas de Citas'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'en'
                ? 'Comprehensive overview of confirmed, cancelled, attended, and rescheduled appointments.'
                : 'Resumen en tiempo real del desempeño de tu embudo de reservas, asistencia y cancelaciones.'}
            </p>
          </div>

          {/* Bento Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            {[
              { title: 'Total', value: appointmentStats?.total || appointments.length, icon: 'event', color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { title: 'Pendientes', value: appointmentStats?.pending || appointments.filter((a) => a.status === 'pending').length, icon: 'schedule', color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { title: 'Por Validar', value: appointmentStats?.pendingCompletion || appointments.filter((a) => a.status === 'pending_completion').length, icon: 'rate_review', color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { title: 'Confirmadas', value: appointmentStats?.confirmed || appointments.filter((a) => a.status === 'confirmed').length, icon: 'check_circle', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { title: 'Reagendadas', value: appointmentStats?.rescheduled || appointments.filter((a) => a.status === 'rescheduled').length, icon: 'sync', color: 'text-orange-500', bg: 'bg-orange-500/10' },
              { title: 'Asistidas', value: appointmentStats?.attended || appointments.filter((a) => a.status === 'completed').length, icon: 'how_to_reg', color: 'text-teal-500', bg: 'bg-teal-500/10' },
              { title: 'No Asistió', value: appointmentStats?.noShow || appointments.filter((a) => a.status === 'no_show').length, icon: 'person_off', color: 'text-rose-500', bg: 'bg-rose-500/10' },
              { title: 'Canceladas', value: appointmentStats?.cancelled || appointments.filter((a) => a.status === 'cancelled').length, icon: 'cancel', color: 'text-red-500', bg: 'bg-red-500/10' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.title}</span>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</h4>
                </div>
                <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Performance Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: 'Tasa de Confirmación',
                rate: appointmentStats?.rates?.confirmationRate || (appointments.length ? (appointments.filter((a) => a.status === 'confirmed').length / appointments.length) * 100 : 0),
                color: 'from-blue-500 to-indigo-600',
                desc: 'Citas confirmadas del total agendado',
              },
              {
                label: 'Tasa de Asistencia',
                rate: appointmentStats?.rates?.attendanceRate || 0,
                color: 'from-teal-500 to-emerald-600',
                desc: 'Citas asistidas frente a no-asistidas',
              },
              {
                label: 'Tasa de Cancelación',
                rate: appointmentStats?.rates?.cancellationRate || (appointments.length ? (appointments.filter((a) => a.status === 'cancelled').length / appointments.length) * 100 : 0),
                color: 'from-red-500 to-rose-600',
                desc: 'Citas canceladas sobre el total',
              },
              {
                label: 'Tasa de Reagendamiento',
                rate: appointmentStats?.rates?.reschedulingRate || 0,
                color: 'from-amber-500 to-orange-600',
                desc: 'Citas reagendadas sobre el total',
              },
            ].map((indicator, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{indicator.label}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{indicator.desc}</p>
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{indicator.rate.toFixed(1)}%</span>
                  <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${indicator.color} rounded-full`}
                      style={{ width: `${Math.min(100, Math.max(0, indicator.rate))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. VISTA 4: RECURSOS Y ESPECIALISTAS */}
      {activeSection === 'resources' && (
        <div className="p-8 space-y-6 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {language === 'en' ? 'Resources & Specialist Staff' : 'Recursos y Especialistas'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'en'
                  ? 'Manage agents, doctors, advisers, and consulting rooms for multi-resource scheduling.'
                  : 'Administra tus asesores, médicos, salas y recursos para agendamiento distribuido.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddResourceModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>{language === 'en' ? 'Add Resource' : 'Agregar Recurso'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resourcesList.map((resName, idx) => {
              const resAppts = appointments.filter((a) => (a.resource_name || 'Atención General') === resName);
              return (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl">
                      <span className="material-symbols-outlined text-2xl">person</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{resName}</h4>
                      <p className="text-xs text-slate-400 font-bold">{resAppts.length} citas registradas</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenBooking({ resource_name: resName, date: selectedDateStr });
                      setActiveSection('timeline');
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-blue-50 text-blue-600 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Agendar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* E. VISTA 5: LISTA DE ESPERA COMPLETA */}
      {activeSection === 'waitlist' && (
        <div className="p-8 space-y-6 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {language === 'en' ? 'Waitlist & Overbooking' : 'Cola de Lista de Espera y Overbooking'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'en'
                  ? 'Clients waiting for slots. If another client cancels or misses their appointment, offer the slot via WhatsApp with 1 click.'
                  : 'Clientes esperando turnos. Si alguien cancela o no asiste, puedes notificarles por WhatsApp y agendarlos con 1 clic.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAddWaitlist}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>{language === 'en' ? 'Add Client' : 'Añadir Cliente a Espera'}</span>
            </button>
          </div>

          {waitlist.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <span className="material-symbols-outlined text-5xl text-slate-300">hourglass_disabled</span>
              <p className="text-xs font-bold uppercase tracking-wider">{language === 'en' ? 'No clients on waitlist' : 'No hay clientes en lista de espera'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Antigüedad</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicio</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Horario</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preferencia / Notas</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {waitlist.map((item) => {
                    const parsed = parseWaitlistNotes(item.notes);
                    const seniority = getWaitlistSeniority(item.created_at, item.desired_date);
                    const matchedContact = contacts?.find(
                      (c) =>
                        (item.conversation_id && c.id === item.conversation_id) ||
                        (item.phone_number && (c.phone_number === item.phone_number || c.phone === item.phone_number)) ||
                        (item.customer_name && (c.customer_name === item.customer_name || c.name === item.customer_name))
                    );
                    const companyDisplay = parsed.company || matchedContact?.company;
                    const emailDisplay = parsed.email || matchedContact?.email;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-slate-200">
                          <div>
                            <p>{item.customer_name}</p>
                            {companyDisplay && (
                              <p className="text-[10px] font-normal text-slate-500">🏢 {companyDisplay}</p>
                            )}
                            {emailDisplay && (
                              <p className="text-[10px] font-normal text-slate-400">{emailDisplay}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              seniority === 'today'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : seniority === 'this_week'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            }`}
                          >
                            {seniority === 'today'
                              ? (language === 'en' ? 'Today' : 'Hoy')
                              : seniority === 'this_week'
                              ? (language === 'en' ? 'This week' : 'Semana actual')
                              : (language === 'en' ? 'Older' : 'Semana anterior')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.phone_number}</td>
                        <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                          <p className="font-semibold">{item.service || 'General'}</p>
                          {item.resource_name && (
                            <p className="text-[10px] text-slate-400">👤 {item.resource_name}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                          <p>{item.desired_date}</p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            {item.preferred_time_range === 'any'
                              ? (language === 'en' ? 'Any time' : 'Cualquier hora')
                              : item.preferred_time_range === 'morning'
                              ? (language === 'en' ? 'Morning (09-13)' : 'Mañana (09-13)')
                              : item.preferred_time_range === 'afternoon'
                              ? (language === 'en' ? 'Afternoon (14-18)' : 'Tarde (14-18)')
                              : item.preferred_time_range}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                          {parsed.schedulePreference ? (
                            <div className="p-1.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-lg text-[10px] text-amber-900 dark:text-amber-200 border border-amber-200/50">
                              {parsed.schedulePreference}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Sin notas</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 capitalize">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onWaitlistNotify(item.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-900/40 flex items-center gap-1 cursor-pointer"
                              title="Notificar por WhatsApp"
                            >
                              <span className="material-symbols-outlined text-xs">send</span>
                              <span>Notificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenBooking({
                                  customer_name: item.customer_name,
                                  phone_number: item.phone_number,
                                  service: item.service,
                                  resource_name: item.resource_name,
                                  date: item.desired_date,
                                });
                                setActiveSection('timeline');
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                              title="Trasladar al calendario"
                            >
                              <span className="material-symbols-outlined text-xs">calendar_month</span>
                              <span>{language === 'en' ? 'Book' : 'Trasladar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(language === 'en' ? 'Discard this waitlist entry?' : '¿Descartar esta solicitud de la lista de espera?')) {
                                  await onWaitlistStatus(item.id, 'cancelled');
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                              title="Descartar / Eliminar"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODAL: BITRIX24 CONTACTOS (VENTANA EMERGENTE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showContactsModal && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${
              isContactsFullscreen ? 'p-0' : 'p-2 sm:p-3 md:p-4'
            } bg-slate-900/70 backdrop-blur-sm transition-all duration-200`}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowContactsModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2 }}
              className={`relative ${
                isContactsFullscreen
                  ? 'w-screen h-screen max-w-none max-h-none rounded-none'
                  : 'w-[98vw] max-w-[1760px] h-[94vh] max-h-[96vh] rounded-2xl sm:rounded-3xl'
              } bg-[#eef2f7] dark:bg-[#0b1120] shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 transition-all duration-200`}
            >
              {/* Modal Top Bar: Contactos 📌 + Crear | [ Todos los contactos x ] buscar 🔍 ✕ | ⚙️ ✕ */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6 pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Title & Pin Icon */}
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                      {language === 'en' ? 'Contacts' : 'Contactos'}
                    </h1>
                    <button
                      type="button"
                      title="Fijar pantalla"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm rotate-45">push_pin</span>
                    </button>
                  </div>

                  {/* Green "+ Crear" Button (Exact from Captura 1) */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowContactsModal(false);
                      onOpenBooking();
                    }}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="text-sm font-black leading-none">+</span>
                    <span>{language === 'en' ? 'Create' : 'Crear'}</span>
                  </button>

                  {/* Pill Search & Filter Bar with Bitrix24 Filter Popover (Capturas 2 & 3) */}
                  <div ref={searchDropdownRef} className="relative">
                    <div
                      onClick={() => setShowSearchDropdown(true)}
                      className={`bg-white dark:bg-slate-800 rounded-full pl-2 pr-3 py-1 flex items-center gap-2 border shadow-xs transition-all w-72 sm:w-96 cursor-text ${
                        showSearchDropdown
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      {/* Active Filter Chip (Funcional: clic en X lo quita) */}
                      {activeFilterTag && (
                        <span className="bg-[#e8f2fe] dark:bg-blue-950/70 text-[#1b6cd8] dark:text-blue-300 text-[11px] font-normal px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shrink-0 select-none">
                          <span>{activeFilterTag}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterTag(null);
                            }}
                            className="hover:text-blue-800 dark:hover:text-white cursor-pointer ml-0.5 leading-none font-bold"
                            title="Quitar etiqueta"
                          >
                            ✕
                          </button>
                        </span>
                      )}

                      {/* Input "buscar" */}
                      <input
                        type="text"
                        placeholder={language === 'en' ? 'search' : 'buscar'}
                        value={contactsSearch}
                        onFocus={() => setShowSearchDropdown(true)}
                        onChange={(e) => setContactsSearch(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none cursor-text"
                      />

                      {/* Search & Clear icons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-sm text-slate-400 pointer-events-none">
                          search
                        </span>
                        {(contactsSearch || activeFilterTag || Object.values(filterForm).some((v) => v.trim() !== '')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactsSearch('');
                              setActiveFilterTag(null);
                              setFilterForm({
                                nombre: '',
                                apellido: '',
                                creadoPor: '',
                                modificadoPor: '',
                                telefono: '',
                                email: '',
                                responsable: '',
                              });
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="Limpiar búsqueda y filtros"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Popover de Filtros Avanzados Bitrix24 (Captura 3) */}
                    {showSearchDropdown && (
                      <div className="absolute left-0 top-full mt-2 w-[620px] max-w-[90vw] z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex overflow-hidden text-xs text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Panel Izquierdo: Vistas de filtro predeterminadas */}
                        <div className="w-48 bg-slate-50/70 dark:bg-slate-950/50 border-r border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col justify-between shrink-0">
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFilterTag('Todos los contactos');
                                setShowSearchDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                                activeFilterTag === 'Todos los contactos'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <span>{language === 'en' ? 'All contacts' : 'Todos los contactos'}</span>
                              <span className="material-symbols-outlined text-xs text-slate-400">push_pin</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveFilterTag('Mis contactos');
                                setShowSearchDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                                activeFilterTag === 'Mis contactos'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <span>{language === 'en' ? 'My contacts' : 'Mis contactos'}</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                            <button
                              type="button"
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="font-bold">+</span>
                              <span>{language === 'en' ? 'Save filter' : 'Guardar filtro'}</span>
                            </button>
                            <button
                              type="button"
                              className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                              title="Ajustes de filtro"
                            >
                              <span className="material-symbols-outlined text-sm">settings</span>
                            </button>
                          </div>
                        </div>

                        {/* Panel Derecho: Campos del formulario */}
                        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between max-h-[480px] overflow-y-auto">
                          <div className="space-y-2.5">
                            {CRM_FILTER_FIELDS.filter((f) => activeFilterFieldIds.includes(f.id)).map((field) => (
                              <div key={field.id}>
                                <label className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal mb-1">
                                  {field.label}
                                </label>
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    placeholder={`Filtrar por ${field.label.toLowerCase()}...`}
                                    value={filterForm[field.id] || ''}
                                    onChange={(e) => setFilterForm({ ...filterForm, [field.id]: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all pr-8"
                                  />
                                  {['nombre', 'apellido', 'journey', 'origen', 'compania', 'cargo'].includes(field.id) && (
                                    <button
                                      type="button"
                                      className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
                                      title="Más opciones"
                                    >
                                      ···
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Action links: Agregar campo + Restaurar */}
                            <div className="flex items-center gap-4 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setTempFieldIds([...activeFilterFieldIds]);
                                  setFieldSearchFilter('');
                                  setActiveCategoryTab('all');
                                  setShowFieldSettingsModal(true);
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-[11px] cursor-pointer flex items-center gap-1"
                              >
                                <span>+</span>
                                <span>{language === 'en' ? 'Add field' : 'Agregar campo'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveFilterFieldIds(
                                    CRM_FILTER_FIELDS.filter((f) => f.default).map((f) => f.id)
                                  );
                                  setFilterForm({
                                    nombre: '',
                                    apellido: '',
                                    creadoPor: '',
                                    modificadoPor: '',
                                    telefono: '',
                                    email: '',
                                    responsable: '',
                                    tieneTelefono: '',
                                    tieneEmail: '',
                                    journey: '',
                                    origen: '',
                                    tipoContacto: '',
                                    compania: '',
                                    cargo: '',
                                    comentario: '',
                                    creadoEl: '',
                                    modificadoEl: '',
                                    utmSource: '',
                                    utmCampaign: '',
                                    actividadEstado: '',
                                    actividadTipo: '',
                                    actividadFechaLimite: '',
                                    origenActividad: '',
                                  });
                                }}
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-[11px] cursor-pointer transition-colors"
                              >
                                {language === 'en' ? 'Restore default fields' : 'Restaurar campos predeterminados'}
                              </button>
                            </div>
                          </div>

                          {/* Bottom Buttons: Buscar + Reiniciar */}
                          <div className="flex items-center justify-center gap-3 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setShowSearchDropdown(false)}
                              className="bg-[#0088e8] hover:bg-[#0077cc] text-white px-6 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">search</span>
                              <span>{language === 'en' ? 'Search' : 'Buscar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFilterForm({
                                  nombre: '',
                                  apellido: '',
                                  creadoPor: '',
                                  modificadoPor: '',
                                  telefono: '',
                                  email: '',
                                  responsable: '',
                                  tieneTelefono: '',
                                  tieneEmail: '',
                                  journey: '',
                                  origen: '',
                                  tipoContacto: '',
                                  compania: '',
                                  cargo: '',
                                  comentario: '',
                                  creadoEl: '',
                                  modificadoEl: '',
                                  utmSource: '',
                                  utmCampaign: '',
                                  actividadEstado: '',
                                  actividadTipo: '',
                                  actividadFechaLimite: '',
                                  origenActividad: '',
                                });
                                setContactsSearch('');
                                setActiveFilterTag(null);
                              }}
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-4 py-2 text-xs font-medium cursor-pointer transition-colors"
                            >
                              {language === 'en' ? 'Reset' : 'Reiniciar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Icons: Settings Gear + Close Modal X */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Configuración de vista de contactos"
                  >
                    <span className="material-symbols-outlined text-base">settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsContactsFullscreen((prev) => !prev)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={isContactsFullscreen ? (language === 'en' ? 'Restore size' : 'Restaurar tamaño') : (language === 'en' ? 'Fullscreen' : 'Pantalla completa')}
                  >
                    <span className="material-symbols-outlined text-base">
                      {isContactsFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowContactsModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Cerrar ventana"
                  >
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              </div>

              {/* Subheader Filters: 0 Entrante | 0 Planeado | Más ▾ (Funcionales) */}
              <div className="flex items-center gap-4 px-4 sm:px-6 mb-3 text-xs font-normal text-slate-500 dark:text-slate-400 select-none">
                <button
                  type="button"
                  onClick={() => setActiveFilterTag(activeFilterTag === 'Entrante' ? null : 'Entrante')}
                  className={`transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeFilterTag === 'Entrante'
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-normal">{incomingCount}</span>
                  <span>{language === 'en' ? 'Incoming' : 'Entrante'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTag(activeFilterTag === 'Planeado' ? null : 'Planeado')}
                  className={`transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeFilterTag === 'Planeado'
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="text-slate-400 font-normal">{plannedCount}</span>
                  <span>{language === 'en' ? 'Planned' : 'Planeado'}</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveFilterTag(activeFilterTag === 'Todos los contactos' ? null : 'Todos los contactos')}
                    className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="text-slate-400 font-normal">{contactsList.length}</span>
                    <span>{language === 'en' ? 'More' : 'Más'}</span>
                    <span className="material-symbols-outlined text-xs text-slate-400">arrow_drop_down</span>
                  </button>
                </div>
              </div>

              {/* Main White Card Container (Scrollable inside modal) */}
              <div className="flex-1 mx-4 sm:mx-6 mb-4 sm:mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
                {/* Table Head: 12-Column Grid Centrado y Ordenado */}
                <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-12 py-3 px-6 text-xs font-normal text-slate-500 dark:text-slate-400 items-center select-none shrink-0">
                  {/* Checkbox + Gear + Contacto ▴ (col-span-3) */}
                  <div className="col-span-3 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        filteredContacts.length > 0 &&
                        selectedContactIds.size === filteredContacts.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContactIds(
                            new Set(filteredContacts.map((c) => c.id || c.phone || c.name))
                          );
                        } else {
                          setSelectedContactIds(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                    />
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Configurar columnas"
                    >
                      <span className="material-symbols-outlined text-sm">settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactsSortAsc((prev) => !prev)}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-slate-600 dark:text-slate-300 font-medium"
                    >
                      <span>{language === 'en' ? 'Contact' : 'Contacto'}</span>
                      <span className="text-[10px] text-slate-400">
                        {contactsSortAsc ? '▴' : '▾'}
                      </span>
                    </button>
                  </div>

                  {/* Actividad (col-span-2) */}
                  <div className="col-span-2">
                    <span>{language === 'en' ? 'Activity' : 'Actividad'}</span>
                  </div>

                  {/* Responsable (col-span-2) */}
                  <div className="col-span-2">
                    <span>{language === 'en' ? 'Responsible' : 'Responsable'}</span>
                  </div>

                  {/* Creado (col-span-2) */}
                  <div className="col-span-2">
                    <span>{language === 'en' ? 'Created' : 'Creado'}</span>
                  </div>

                  {/* Recorrido del cliente (col-span-2, Centrado) */}
                  <div className="col-span-2 text-center">
                    <span>{language === 'en' ? 'Customer Journey' : 'Recorrido del cliente'}</span>
                  </div>

                  {/* Acciones (col-span-1, Centrado) */}
                  <div className="col-span-1 text-center">
                    <span>{language === 'en' ? 'Actions' : 'Acciones'}</span>
                  </div>
                </div>

                {/* Table Body / Scrollable Content */}
                <div className="flex-1 overflow-y-auto flex flex-col">
                  {filteredContacts.length === 0 ? (
                    /* Exact Empty State from Captura 1 */
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 select-none">
                      <div className="w-20 h-24 mb-4 relative flex items-center justify-center">
                        <svg
                          className="w-full h-full text-slate-300 dark:text-slate-700"
                          viewBox="0 0 48 56"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 6C2 3.79086 3.79086 2 6 2H30L46 18V50C46 52.2091 44.2091 54 42 54H6C3.79086 54 2 52.2091 2 50V6Z"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M30 2V18H46"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M18 30L30 42"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M30 30L18 42"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-normal text-slate-400 dark:text-slate-500 tracking-wider">
                        {language === 'en' ? '- No data -' : '- Sin datos -'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {filteredContacts.map((contact, idx) => {
                        const isSelected = selectedContactIds.has(contact.id || contact.phone || contact.name);
                        return (
                          <div
                            key={contact.id || idx}
                            className={`grid grid-cols-12 py-3 px-6 text-xs items-center transition-colors ${
                              isSelected
                                ? 'bg-blue-50/60 dark:bg-blue-950/30'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* Checkbox + Contact Info (col-span-3) */}
                            <div className="col-span-3 flex items-center gap-3 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  const key = contact.id || contact.phone || contact.name;
                                  const next = new Set(selectedContactIds);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  setSelectedContactIds(next);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer shrink-0"
                              />
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate min-w-0">
                                <span
                                  onClick={() => {
                                    setShowContactsModal(false);
                                    onOpenBooking({
                                      customer_name: contact.name,
                                      phone_number: contact.phone,
                                      service: contact.lastAppt?.service || '',
                                      date: selectedDateStr,
                                    });
                                  }}
                                  className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors block truncate"
                                >
                                  {contact.name}
                                </span>
                                {contact.phone && (
                                  <span className="text-[11px] font-mono text-slate-400 block truncate">
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actividad (col-span-2) */}
                            <div className="col-span-2 text-slate-600 dark:text-slate-300 truncate pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    contact.totalBookings > 0 ? 'bg-blue-500' : 'bg-slate-400'
                                  }`}
                                />
                                <span className="truncate">{contact.activity}</span>
                              </div>
                            </div>

                            {/* Responsable (col-span-2) */}
                            <div className="col-span-2 text-slate-700 dark:text-slate-300 truncate pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                                  person
                                </span>
                                <span className="truncate">{contact.responsible}</span>
                              </div>
                            </div>

                            {/* Creado (col-span-2) */}
                            <div className="col-span-2 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate">
                              {(() => {
                                try {
                                  const d = new Date(contact.created_at);
                                  if (isNaN(d.getTime())) return '-';
                                  const day = String(d.getDate()).padStart(2, '0');
                                  const m = String(d.getMonth() + 1).padStart(2, '0');
                                  const y = d.getFullYear();
                                  const hr = String(d.getHours()).padStart(2, '0');
                                  const min = String(d.getMinutes()).padStart(2, '0');
                                  return `${day}.${m}.${y} ${hr}:${min}`;
                                } catch {
                                  return '-';
                                }
                              })()}
                            </div>

                            {/* Recorrido del cliente (col-span-2, Centrado, Sin cortes de línea) */}
                            <div className="col-span-2 flex items-center justify-center px-2">
                              <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap select-none">
                                {contact.journey}
                              </span>
                            </div>

                            {/* Acciones (col-span-1, Centrado con WhatsApp y Calendario) */}
                            <div className="col-span-1 flex items-center justify-center gap-1.5">
                              {contact.phone && (
                                <a
                                  href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Abrir WhatsApp"
                                >
                                  <span className="material-symbols-outlined text-base">chat</span>
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setShowContactsModal(false);
                                  onOpenBooking({
                                    customer_name: contact.name,
                                    phone_number: contact.phone,
                                    service: contact.lastAppt?.service || '',
                                    date: selectedDateStr,
                                  });
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Agendar cita"
                              >
                                <span className="material-symbols-outlined text-base">event</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 1.1 MODAL: AJUSTES DEL CAMPO DE FILTROS (CAPTURA 1) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showFieldSettingsModal && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFieldSettingsModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                  {language === 'en' ? 'Filter field settings' : 'Ajustes del campo de filtros'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowFieldSettingsModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Sub-header: Search & Category Pills (Contacto / Actividad) */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
                {/* Search input */}
                <div className="relative w-60 sm:w-72">
                  <input
                    type="text"
                    placeholder={language === 'en' ? 'Search field' : 'Buscar campo'}
                    value={fieldSearchFilter}
                    onChange={(e) => setFieldSearchFilter(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <span className="material-symbols-outlined text-sm text-slate-400 absolute right-2.5 top-2 pointer-events-none">
                    search
                  </span>
                </div>

                {/* Category Pills (Contacto / Actividad) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCategoryTab(activeCategoryTab === 'contacto' ? 'all' : 'contacto')
                    }
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                      activeCategoryTab === 'contacto' || activeCategoryTab === 'all'
                        ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="text-xs">✓</span>
                    <span>{language === 'en' ? 'Contact' : 'Contacto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveCategoryTab(activeCategoryTab === 'actividad' ? 'all' : 'actividad')
                    }
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                      activeCategoryTab === 'actividad' || activeCategoryTab === 'all'
                        ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="text-xs">✓</span>
                    <span>{language === 'en' ? 'Activity' : 'Actividad'}</span>
                  </button>
                </div>
              </div>

              {/* Checkboxes Content Area */}
              <div className="p-6 overflow-y-auto max-h-[50vh] space-y-5">
                {/* Section Contacto */}
                {(activeCategoryTab === 'all' || activeCategoryTab === 'contacto') && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                      {language === 'en' ? 'Contact' : 'Contacto'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2.5 gap-x-4">
                      {CRM_FILTER_FIELDS.filter(
                        (f) =>
                          f.category === 'contacto' &&
                          (!fieldSearchFilter.trim() ||
                            f.label.toLowerCase().includes(fieldSearchFilter.toLowerCase().trim()))
                      ).map((field) => {
                        const isChecked = tempFieldIds.includes(field.id);
                        return (
                          <label
                            key={field.id}
                            className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer select-none group"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTempFieldIds((prev) => [...prev, field.id]);
                                } else {
                                  setTempFieldIds((prev) => prev.filter((id) => id !== field.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                            />
                            <span className="group-hover:translate-x-0.5 transition-transform">
                              {field.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section Actividad */}
                {(activeCategoryTab === 'all' || activeCategoryTab === 'actividad') && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                      {language === 'en' ? 'Activity' : 'Actividad'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2.5 gap-x-4">
                      {CRM_FILTER_FIELDS.filter(
                        (f) =>
                          f.category === 'actividad' &&
                          (!fieldSearchFilter.trim() ||
                            f.label.toLowerCase().includes(fieldSearchFilter.toLowerCase().trim()))
                      ).map((field) => {
                        const isChecked = tempFieldIds.includes(field.id);
                        return (
                          <label
                            key={field.id}
                            className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer select-none group"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTempFieldIds((prev) => [...prev, field.id]);
                                } else {
                                  setTempFieldIds((prev) => prev.filter((id) => id !== field.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                            />
                            <span className="group-hover:translate-x-0.5 transition-transform">
                              {field.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
                {/* Select All */}
                <button
                  type="button"
                  onClick={() => {
                    if (tempFieldIds.length === CRM_FILTER_FIELDS.length) {
                      setTempFieldIds([]);
                    } else {
                      setTempFieldIds(CRM_FILTER_FIELDS.map((f) => f.id));
                    }
                  }}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 cursor-pointer font-medium select-none"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                      tempFieldIds.length === CRM_FILTER_FIELDS.length
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : tempFieldIds.length > 0
                        ? 'bg-blue-50 border-blue-600 text-blue-600 font-bold'
                        : 'border-slate-300 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {tempFieldIds.length === CRM_FILTER_FIELDS.length ? '✓' : tempFieldIds.length > 0 ? '—' : ''}
                  </span>
                  <span>{language === 'en' ? 'Select all' : 'seleccionar todo'}</span>
                </button>

                {/* Buttons: Aplicar, Cancelar, Predeterminado */}
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilterFieldIds(tempFieldIds);
                      setShowFieldSettingsModal(false);
                    }}
                    className="bg-[#00a3e0] hover:bg-[#0092c9] text-white px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {language === 'en' ? 'Apply' : 'Aplicar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFieldSettingsModal(false)}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-2 text-xs font-semibold uppercase cursor-pointer transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : 'Cancelar'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTempFieldIds(CRM_FILTER_FIELDS.filter((f) => f.default).map((f) => f.id))
                    }
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs flex items-center gap-1 cursor-pointer transition-colors pl-2 border-l border-slate-200 dark:border-slate-700"
                    title="Restaurar a campos predeterminados"
                  >
                    <span className="font-bold">↺</span>
                    <span>{language === 'en' ? 'Default' : 'predeterminado'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 1.5 MODAL: EDITAR HORARIO DE ATENCIÓN DIRECTO */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-8 w-full max-w-md relative"
            >
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">schedule</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    {language === 'en' ? 'Operating Schedule' : 'Horario de Atención'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {language === 'en'
                      ? 'Set working days and opening/closing hours'
                      : 'Configura días laborables y horario comercial'}
                  </p>
                </div>
              </div>

              {/* Working Days */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {language === 'en' ? 'Working Days (Enabled)' : 'Días de Atención (Habilitados)'}
                    </label>
                    <span className="text-[10px] text-rose-500 dark:text-rose-400 font-bold">
                      {language === 'en' ? 'Unchecked = Red & Locked' : 'Desmarcados = Rojo y Bloqueados'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[
                      { id: 1, label: 'Lun' },
                      { id: 2, label: 'Mar' },
                      { id: 3, label: 'Mié' },
                      { id: 4, label: 'Jue' },
                      { id: 5, label: 'Vie' },
                      { id: 6, label: 'Sáb' },
                      { id: 0, label: 'Dom' },
                    ].map((day) => {
                      const isSelected = (configData?.business_days || []).includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const days = configData?.business_days || [];
                            const newDays = days.includes(day.id)
                              ? days.filter((d: number) => d !== day.id)
                              : [...days, day.id].sort();
                            setConfigData({ ...configData, business_days: newDays });
                          }}
                          className={`py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                              : 'bg-rose-50/60 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-100/60'
                          }`}
                        >
                          <span>{day.label}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {language === 'en'
                      ? '💡 Days not marked will be shown in red on the calendar and bookings will be locked until you check them.'
                      : '💡 Los días no marcados se mostrarán en rojo en el calendario y tendrán las reservas bloqueadas hasta que los actives.'}
                  </p>
                </div>

                {/* Hours inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      {language === 'en' ? 'Opening' : 'Hora de Apertura'}
                    </label>
                    <input
                      type="time"
                      value={configData?.business_start_hour || '09:00'}
                      onChange={(e) => setConfigData({ ...configData, business_start_hour: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      {language === 'en' ? 'Closing' : 'Hora de Cierre'}
                    </label>
                    <input
                      type="time"
                      value={configData?.business_end_hour || '18:00'}
                      onChange={(e) => setConfigData({ ...configData, business_end_hour: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const days = configData?.business_days || [1, 2, 3, 4, 5];
                    const start = configData?.business_start_hour || '09:00';
                    const end = configData?.business_end_hour || '18:00';
                    const ok = await onSaveSchedule({
                      business_days: days,
                      business_start_hour: start,
                      business_end_hour: end,
                    });
                    if (ok !== false) {
                      setShowScheduleModal(false);
                    }
                  }}
                  disabled={isSavingSchedule}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSchedule ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">save</span>
                  )}
                  <span>{language === 'en' ? 'Save Schedule' : 'Guardar Horario'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. MODAL: AGREGAR RECURSO */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAddResourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 w-full max-w-sm relative"
            >
              <button
                type="button"
                onClick={() => setShowAddResourceModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">person_add</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    {language === 'en' ? 'Add Resource / Specialist' : 'Agregar Recurso'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {language === 'en' ? 'E.g. Dr. Davis, Room 2, Advisor' : 'Ej. Dra. Pérez, Cabina 1, Asesor VIP'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <input
                  type="text"
                  placeholder="Nombre del especialista o recurso"
                  value={newResourceName}
                  onChange={(e) => setNewResourceName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddResourceModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddResource}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20"
                >
                  Agregar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. MODAL: DETALLES Y ACCIONES DE CITA */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedApptDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
            >
              {/* ======================================================= */}
              {/* MODO 1: REAGENDAR CITA */}
              {/* ======================================================= */}
              {apptModalMode === 'reschedule' && (
                <>
                  {/* Gradient Header */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setApptModalMode('details')}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                        >
                          <span className="material-symbols-outlined text-base">arrow_back</span>
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
                          <span className="material-symbols-outlined text-xl">event_repeat</span>
                        </div>
                        <div>
                          <h2 className="text-base font-black text-white leading-tight">
                            {language === 'en' ? 'Reschedule Appointment' : 'Reagendar Cita'}
                          </h2>
                          <p className="text-xs text-white/80 font-medium">
                            {selectedApptDetails.customer_name} • {selectedApptDetails.phone_number}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApptDetails(null);
                          setApptModalMode('details');
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Form */}
                  <div className="p-6 space-y-4 bg-white dark:bg-slate-900">
                    {/* Selector de Nueva Fecha */}
                    <div>
                      <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                        {language === 'en' ? 'New Date' : 'Nueva Fecha'} <span className="text-rose-500 font-normal">*</span>
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className={`w-full bg-slate-50/50 dark:bg-slate-800/40 border rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 focus:ring-2 outline-none transition-all ${
                          checkIsNonWorkingDay(rescheduleDate)
                            ? 'border-amber-300 dark:border-amber-700/60 focus:ring-amber-500/15 focus:border-amber-500'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-blue-500/15 focus:border-blue-500'
                        }`}
                      />
                      {checkIsNonWorkingDay(rescheduleDate) && (
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

                    {/* Selector de Horario estilo Google Calendar */}
                    <div>
                      {checkIsNonWorkingDay(rescheduleDate) ? (
                        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 text-center">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-1.5">
                            <span className="material-symbols-outlined text-base">event_busy</span>
                          </div>
                          <p className="text-xs font-normal text-slate-700 dark:text-slate-200">
                            {language === 'en'
                              ? 'No slots available on non-working days.'
                              : 'No hay horarios disponibles en días sin atención programada.'}
                          </p>
                          <p className="text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                            {language === 'en'
                              ? 'Please choose an active working day.'
                              : 'Por favor selecciona un día activo en tu horario de atención.'}
                          </p>
                        </div>
                      ) : (
                        <GoogleTimePicker
                          startTime={rescheduleTime || '09:00'}
                          endTime={rescheduleEndTime || '10:00'}
                          durationMinutes={rescheduleDuration || 60}
                          dateStr={rescheduleDate}
                          suggestedSlots={rescheduleSlots}
                          loadingSlots={loadingRescheduleSlots}
                          language={language}
                          onChange={({ startTime, endTime: newEnd, durationMinutes: newDur }) => {
                            setRescheduleTime(startTime);
                            setRescheduleEndTime(newEnd);
                            setRescheduleDuration(newDur);
                          }}
                        />
                      )}
                    </div>

                    {/* Selector de Especialista / Recurso */}
                    <div>
                      <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                        {language === 'en' ? 'Specialist / Resource' : 'Especialista / Recurso'}
                      </label>
                      <select
                        value={rescheduleResource}
                        onChange={(e) => setRescheduleResource(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 outline-none transition-all cursor-pointer"
                      >
                        <option value="">{language === 'en' ? 'General Attention' : 'Atención General'}</option>
                        {resourcesList.map((res) => (
                          <option key={res} value={res}>
                            {res}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setApptModalMode('details')}
                        disabled={isSubmittingModalAction}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 font-normal hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs cursor-pointer"
                      >
                        {language === 'en' ? 'Back' : 'Volver'}
                      </button>
                      <button
                        type="button"
                        disabled={checkIsNonWorkingDay(rescheduleDate) || !rescheduleDate || !rescheduleTime || isSubmittingModalAction || !!isPerformingAction}
                        onClick={async () => {
                          setIsSubmittingModalAction(true);
                          try {
                            const scheduled_time = `${rescheduleDate}T${rescheduleTime}:00-05:00`;
                            await onApptAction(selectedApptDetails.id, 'reschedule', {
                              scheduled_time,
                              duration_minutes: rescheduleDuration || 60,
                              end_time: rescheduleEndTime,
                              resource_name: rescheduleResource || undefined,
                            });
                            setSelectedApptDetails(null);
                            setApptModalMode('details');
                          } finally {
                            setIsSubmittingModalAction(false);
                          }
                        }}
                        className={`px-5 py-2 rounded-xl text-xs font-normal transition-all flex items-center justify-center gap-1.5 ${
                          checkIsNonWorkingDay(rescheduleDate) || !rescheduleDate || !rescheduleTime
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer'
                        }`}
                      >
                        {isSubmittingModalAction ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            <span>{language === 'en' ? 'Rescheduling...' : 'Reagendando...'}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">event_repeat</span>
                            <span>{language === 'en' ? 'Confirm Reschedule' : 'Confirmar Reagendamiento'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ======================================================= */}
              {/* MODO 2: CONFIRMAR ELIMINACIÓN PERMANENTE */}
              {/* ======================================================= */}
              {apptModalMode === 'confirm_delete' && (
                <>
                  {/* Header Rojo / Danger con gradiente RIFX */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setApptModalMode('details')}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                        >
                          <span className="material-symbols-outlined text-base">arrow_back</span>
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
                          <span className="material-symbols-outlined text-xl">delete_forever</span>
                        </div>
                        <div>
                          <h2 className="text-base font-black text-white leading-tight">
                            {language === 'en' ? 'Permanently Delete' : 'Eliminar Cita Definitivamente'}
                          </h2>
                          <p className="text-xs text-white/80 font-medium">
                            {selectedApptDetails.customer_name} • {selectedApptDetails.phone_number}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApptDetails(null);
                          setApptModalMode('details');
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Danger Card */}
                  <div className="p-6 space-y-5 bg-white dark:bg-slate-900">
                    <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0 border border-rose-500/20">
                          <span className="material-symbols-outlined text-xl">warning</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {language === 'en' ? 'Permanent Action' : 'Acción Irreversible'}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {language === 'en'
                              ? 'This appointment will be wiped from the CRM'
                              : 'Esta cita se eliminará permanentemente del sistema'}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-1 font-medium">
                        <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-blue-500">person</span>
                          <span>{selectedApptDetails.customer_name}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-semibold">{selectedApptDetails.service || 'Asesoría'}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-amber-500">schedule</span>
                          <span>
                            {new Intl.DateTimeFormat('es-EC', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            }).format(new Date(selectedApptDetails.scheduled_time))}
                          </span>
                        </p>
                      </div>

                      <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold leading-relaxed">
                        {language === 'en'
                          ? 'It will be deleted from Supabase and Google Calendar. It cannot be recovered.'
                          : 'Se borrará de la base de datos y de Google Calendar. No se podrá recuperar.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setApptModalMode('details')}
                        disabled={isSubmittingModalAction}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs"
                      >
                        {language === 'en' ? 'Cancel' : 'Cancelar'}
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingModalAction || !!isPerformingAction}
                        onClick={async () => {
                          setIsSubmittingModalAction(true);
                          try {
                            await onApptAction(selectedApptDetails.id, 'delete');
                            setSelectedApptDetails(null);
                            setApptModalMode('details');
                          } finally {
                            setIsSubmittingModalAction(false);
                          }
                        }}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
                      >
                        {isSubmittingModalAction ? (
                          <>
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            <span>{language === 'en' ? 'Deleting...' : 'Eliminando...'}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">delete_forever</span>
                            <span>{language === 'en' ? 'Yes, Delete' : 'Sí, Eliminar Definitivamente'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ======================================================= */}
              {/* MODO 3: DETALLES PRINCIPALES Y TODAS LAS ACCIONES */}
              {/* ======================================================= */}
              {apptModalMode === 'details' && (
                <>
                  {/* Signature RIFX Gradient Header */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
                          <span className="material-symbols-outlined text-xl">event_available</span>
                        </div>
                        <div>
                          <h2 className="text-base font-black text-white leading-tight">
                            {selectedApptDetails.customer_name}
                          </h2>
                          <p className="text-xs text-white/80 font-mono">
                            {selectedApptDetails.phone_number}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApptDetails(null);
                          setApptModalMode('details');
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Bento Cards */}
                  <div className="p-6 space-y-5 bg-white dark:bg-slate-900">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          {language === 'en' ? 'Service' : 'Servicio'}
                        </span>
                        <span className="text-xs font-black text-slate-800 dark:text-white truncate block">
                          {selectedApptDetails.service || 'Asesoría'}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          {language === 'en' ? 'Specialist' : 'Especialista'}
                        </span>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 truncate block">
                          {selectedApptDetails.resource_name || 'Atención General'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                          {language === 'en' ? 'Scheduled Date & Time' : 'Horario de la Cita'}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-slate-800 dark:text-white">
                            {new Intl.DateTimeFormat('es-EC', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            }).format(new Date(selectedApptDetails.scheduled_time))}
                            {' – '}
                            {new Intl.DateTimeFormat('es-EC', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            }).format(new Date(new Date(selectedApptDetails.scheduled_time).getTime() + (selectedApptDetails.duration_minutes || 60) * 60 * 1000))}
                          </span>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60 px-2 py-0.5 rounded-full">
                            {formatDurationLabel(selectedApptDetails.duration_minutes || 60)}
                          </span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${STATUS_CONFIG[selectedApptDetails.status]?.badgeBg || 'bg-slate-100'}`}>
                        {STATUS_CONFIG[selectedApptDetails.status]?.label || selectedApptDetails.status}
                      </span>
                    </div>

                    {/* Actions Section */}
                    <div className="space-y-3 pt-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {language === 'en' ? 'Actions' : 'Acciones Disponibles'}
                      </p>

                      {/* Fila 1: Asistencia */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onApptAction(selectedApptDetails.id, 'complete');
                            setSelectedApptDetails(null);
                          }}
                          disabled={!!isPerformingAction}
                          className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          <span>{language === 'en' ? 'Attended' : 'Asistió'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            await onApptAction(selectedApptDetails.id, 'no_show');
                            setSelectedApptDetails(null);
                          }}
                          disabled={!!isPerformingAction}
                          className="p-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">cancel</span>
                          <span>{language === 'en' ? 'No Show' : 'No Asistió'}</span>
                        </button>
                      </div>

                      {/* Fila 2: WhatsApp y Reagendar */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const phone = (selectedApptDetails.phone_number || '').replace(/[^0-9]/g, '');
                            if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                          }}
                          className="p-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setApptModalMode('reschedule')}
                          disabled={!!isPerformingAction}
                          className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">event_repeat</span>
                          <span>{language === 'en' ? 'Reschedule' : 'Reagendar'}</span>
                        </button>
                      </div>

                      {/* Fila 3: Cancelar y Eliminar */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onApptAction(selectedApptDetails.id, 'cancel');
                            setSelectedApptDetails(null);
                          }}
                          disabled={selectedApptDetails.status === 'cancelled' || !!isPerformingAction}
                          className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                            selectedApptDetails.status === 'cancelled'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-pointer'
                          }`}
                          title={selectedApptDetails.status === 'cancelled' ? 'La cita ya se encuentra cancelada' : 'Cancelar cita'}
                        >
                          <span className="material-symbols-outlined text-base">block</span>
                          <span>{language === 'en' ? 'Cancel' : 'Cancelar Cita'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setApptModalMode('confirm_delete')}
                          disabled={!!isPerformingAction}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">delete_forever</span>
                          <span>{language === 'en' ? 'Delete' : 'Eliminar Cita'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4. MODAL: ¿CÓMO FUNCIONA LA LISTA DE ESPERA? (BITRIX24 STYLE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showWaitlistHelpModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowWaitlistHelpModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 max-h-[92vh] flex flex-col text-slate-800 dark:text-slate-100"
            >
              {/* Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-5 text-white flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm">
                      <span className="material-symbols-outlined text-white text-2xl">help_outline</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white leading-tight">
                        {language === 'en' ? 'How Does the Waitlist Work?' : '¿Cómo Funciona la Lista de Espera?'}
                      </h2>
                      <p className="text-xs text-white/85 font-medium">
                        {language === 'en'
                          ? 'Online booking, specialist assignment, and agile slot reassignment'
                          : 'Gestión de citas, asignación de especialistas y reasignación ágil de espacios'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWaitlistHelpModal(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 transition-colors flex items-center justify-center text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300">
                {/* Intro summary */}
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl">
                  <p className="leading-relaxed font-medium text-slate-700 dark:text-slate-200">
                    {language === 'en'
                      ? 'Online booking allows you to manage appointments with specialists and team equipment allocation. When immediate availability is not present, clients can be placed on the waitlist with three critical benefits:'
                      : 'La reserva online te permite gestionar citas con especialistas y la asignación de equipos. Cuando no haya disponibilidad inmediata, puedes incluir clientes a la lista de espera, lo que brinda estos beneficios:'}
                  </p>
                </div>

                {/* 3 Beneficios Clave (Tarjetas) */}
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                    {language === 'en' ? 'Core Waitlist Benefits' : 'Beneficios de la Lista de Espera'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined text-base">contact_phone</span>
                      </div>
                      <h5 className="font-black text-slate-900 dark:text-white text-xs">
                        {language === 'en' ? 'Client data & preferences' : 'Guardar datos y preferencias'}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {language === 'en'
                          ? 'Stores customer contact info and exact schedule preferences.'
                          : 'Registra los datos de contacto y preferencias horarias del cliente.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined text-base">bolt</span>
                      </div>
                      <h5 className="font-black text-slate-900 dark:text-white text-xs">
                        {language === 'en' ? 'Agile slot reassignment' : 'Reasignar espacios con agilidad'}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {language === 'en'
                          ? 'Quickly reallocate slots with 1-click when cancellations occur.'
                          : 'Reasigna espacios al instante cuando ocurran cancelaciones en el calendario.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined text-base">trending_up</span>
                      </div>
                      <h5 className="font-black text-slate-900 dark:text-white text-xs">
                        {language === 'en' ? 'Max occupancy & retention' : 'Maximizar ocupación'}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {language === 'en'
                          ? 'Maximize calendar occupancy and retain prospective clients.'
                          : 'Maximiza la ocupación de agenda y evita perder clientes potenciales.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Paso a paso */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {language === 'en' ? 'Workflow & Features Guide' : 'Flujo Oficial de Gestión'}
                  </h4>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs">
                          {language === 'en' ? 'Add or select client from CRM' : 'Agregar o seleccionar cliente'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'en'
                            ? 'Click "+ (Add)". Choose an existing CRM contact or click "Create new contact" (new contacts are automatically saved in your CRM).'
                            : 'Haz clic en + (Agregar). Elige un contacto existente de tu CRM o haz clic en "Crear un nuevo contacto" (se guardará automáticamente en tu base de datos CRM).'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs">
                          {language === 'en' ? 'Add note for schedule preferences' : 'Agregar nota de horario'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'en'
                            ? 'Use "Add note" to record customer schedule preferences (e.g. mornings only, fridays, etc.) or other relevant instructions.'
                            : 'Utiliza "Agregar nota" para registrar preferencias de horario del cliente (ej. sólo mañanas, cancelaciones de viernes) u otra información relevante.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs">
                          {language === 'en' ? 'Automatic grouping by seniority' : 'Organización por antigüedad'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'en'
                            ? 'The system organizes requests by age: Today, Current week, and Previous week / Older, facilitating prioritized attention.'
                            : 'El sistema organiza las solicitudes por antigüedad: hoy, semana actual y semana anterior, facilitando la atención prioritaria.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs">
                          {language === 'en' ? 'Transfer to calendar or discard' : 'Trasladar al calendario o descartar'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'en'
                            ? 'When a slot opens up, transfer the entry directly to the calendar. To remove obsolete requests, delete them.'
                            : 'Al liberarse un espacio, traslada la entrada al calendario. Para descartar solicitudes obsoletas, elimínalas con un solo clic.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        5
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-xs">
                          {language === 'en' ? 'Collapse / Expand the block' : 'Ocultar / Mostrar lista de espera'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'en'
                            ? 'To hide or show the waitlist block in the sidebar, click Collapse/Expand.'
                            : 'Para ocultar o mostrar el bloque de Lista de espera en la barra lateral, haz clic en Contraer/Expandir.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWaitlistHelpModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  {language === 'en' ? 'Close' : 'Cerrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowWaitlistHelpModal(false);
                    onOpenAddWaitlist();
                  }}
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>{language === 'en' ? 'Add Entry Now' : 'Agregar Entrada a Lista de Espera'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
