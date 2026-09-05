'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface GoogleTimePickerProps {
  startTime: string; // "09:00" (24h)
  endTime?: string;  // "10:00" (24h)
  durationMinutes?: number; // default 60
  onChange: (val: { startTime: string; endTime: string; durationMinutes: number }) => void;
  dateStr?: string; // "2026-09-05"
  suggestedSlots?: Array<{ start: string; end?: string; label?: string } | string>;
  loadingSlots?: boolean;
  disabled?: boolean;
  language?: string;
  className?: string;
}

// Helper: Convert "09:00" -> 540 minutes
export function time24ToMinutes(timeStr: string): number {
  if (!timeStr) return 540;
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 540;
  return parts[0] * 60 + parts[1];
}

// Helper: Convert 540 -> "09:00"
export function minutesToTime24(totalMinutes: number): string {
  const bounded = Math.min(1439, Math.max(0, totalMinutes));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Helper: Convert 540 -> "9:00am", 750 -> "12:30pm"
export function minutesTo12h(totalMinutes: number): string {
  const bounded = Math.min(1439, Math.max(0, totalMinutes));
  const h24 = Math.floor(bounded / 60);
  const m = bounded % 60;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

// Helper: Duration label "15 min", "1 h", "1.5 h", "2 h", "1 h 15 min"
export function formatDurationLabel(durationMinutes: number): string {
  if (durationMinutes < 60) return `${durationMinutes} min`;
  if (durationMinutes === 60) return '1 h';
  if (durationMinutes % 60 === 0) return `${durationMinutes / 60} h`;
  if (durationMinutes % 30 === 0) return `${durationMinutes / 60} h`;
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  return `${h} h ${m} min`;
}

// All start time options in 15-minute intervals across 24h
const START_TIME_OPTIONS: Array<{ minutes: number; time24: string; label12h: string }> = (() => {
  const options = [];
  for (let m = 0; m < 1440; m += 15) {
    options.push({
      minutes: m,
      time24: minutesToTime24(m),
      label12h: minutesTo12h(m),
    });
  }
  return options;
})();

// Standard duration steps offered by Google Calendar
const DURATION_STEPS = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 480
];

export default function GoogleTimePicker({
  startTime,
  endTime,
  durationMinutes = 60,
  onChange,
  dateStr,
  suggestedSlots = [],
  loadingSlots = false,
  disabled = false,
  language = 'es',
  className = '',
}: GoogleTimePickerProps) {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startListRef = useRef<HTMLDivElement>(null);
  const endListRef = useRef<HTMLDivElement>(null);

  // Compute minutes
  const startMins = useMemo(() => time24ToMinutes(startTime), [startTime]);

  const effectiveDuration = useMemo(() => {
    if (endTime) {
      const endMins = time24ToMinutes(endTime);
      const diff = endMins - startMins;
      if (diff > 0) return diff;
    }
    return durationMinutes || 60;
  }, [endTime, startMins, durationMinutes]);

  const endMins = useMemo(() => {
    if (endTime) {
      const parsed = time24ToMinutes(endTime);
      if (parsed > startMins) return parsed;
    }
    return Math.min(1439, startMins + effectiveDuration);
  }, [endTime, startMins, effectiveDuration]);

  // Labels for the pills
  const startPillLabel = useMemo(() => minutesTo12h(startMins), [startMins]);
  const endPillLabel = useMemo(() => minutesTo12h(endMins), [endMins]);
  const durationBadgeLabel = useMemo(() => formatDurationLabel(effectiveDuration), [effectiveDuration]);

  // End time options relative to current start time
  const endTimeOptions = useMemo(() => {
    return DURATION_STEPS.map((step) => {
      const targetMins = startMins + step;
      if (targetMins > 1440) return null;
      return {
        minutes: targetMins,
        time24: minutesToTime24(targetMins),
        duration: step,
        label: `${minutesTo12h(targetMins)} (${formatDurationLabel(step)})`,
      };
    }).filter(Boolean) as Array<{ minutes: number; time24: string; duration: number; label: string }>;
  }, [startMins]);

  // Formatted date string (e.g. "Sábado, 5 de septiembre")
  const formattedDate = useMemo(() => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const dateObj = new Date(y, m - 1, d, 12, 0, 0);
      const str = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-EC', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(dateObj);
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return dateStr;
    }
  }, [dateStr, language]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsStartOpen(false);
        setIsEndOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll start dropdown to selected
  useEffect(() => {
    if (isStartOpen && startListRef.current) {
      const selectedEl = startListRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [isStartOpen]);

  // Auto-scroll end dropdown to selected
  useEffect(() => {
    if (isEndOpen && endListRef.current) {
      const selectedEl = endListRef.current.querySelector('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [isEndOpen]);

  // Handle choosing a new start time
  const handleSelectStart = (newStart24: string) => {
    const newStartMins = time24ToMinutes(newStart24);
    // Keep the current duration if possible
    const newEndMins = Math.min(1439, newStartMins + effectiveDuration);
    const newEnd24 = minutesToTime24(newEndMins);
    onChange({
      startTime: newStart24,
      endTime: newEnd24,
      durationMinutes: effectiveDuration,
    });
    setIsStartOpen(false);
  };

  // Handle choosing a new end time
  const handleSelectEnd = (option: { time24: string; duration: number }) => {
    onChange({
      startTime: minutesToTime24(startMins),
      endTime: option.time24,
      durationMinutes: option.duration,
    });
    setIsEndOpen(false);
  };

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`}>
      {/* Date & Time Row (Google Calendar Style) */}
      <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
        {/* Header: Date with Clock Icon */}
        {formattedDate && (
          <div className="flex items-center gap-2 mb-2.5 text-slate-700 dark:text-slate-200">
            <span className="material-symbols-outlined text-lg text-blue-600 dark:text-blue-400">
              schedule
            </span>
            <span className="text-xs font-black tracking-tight">{formattedDate}</span>
            <span className="ml-auto text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {durationBadgeLabel}
            </span>
          </div>
        )}

        {/* The Two Time Selector Pills: [ 9:00am ] – [ 10:00am ] */}
        <div className="flex items-center gap-2 relative">
          {/* Start Time Pill & Dropdown */}
          <div className="relative flex-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsEndOpen(false);
                setIsStartOpen((prev) => !prev);
              }}
              className={`w-full py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-between cursor-pointer border ${
                isStartOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-blue-500 dark:text-blue-400">
                  play_circle
                </span>
                <span>{startPillLabel}</span>
              </div>
              <span className="material-symbols-outlined text-xs opacity-70">
                {isStartOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Start Time Dropdown */}
            {isStartOpen && (
              <div
                ref={startListRef}
                className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-50 max-h-56 overflow-y-auto"
              >
                <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700/60 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs">
                  {language === 'en' ? 'Start Time' : 'Hora de Inicio'}
                </div>
                {START_TIME_OPTIONS.map((opt) => {
                  const isSelected = opt.minutes === startMins;
                  return (
                    <button
                      key={opt.time24}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => handleSelectStart(opt.time24)}
                      className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-slate-700 font-black text-blue-600 dark:text-blue-400 border-l-4 border-blue-600'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-semibold'
                      }`}
                    >
                      <span>{opt.label12h}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-xs text-blue-600 dark:text-blue-400">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separator Dash */}
          <span className="text-slate-400 font-black select-none">–</span>

          {/* End Time Pill & Dropdown */}
          <div className="relative flex-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsStartOpen(false);
                setIsEndOpen((prev) => !prev);
              }}
              className={`w-full py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-between cursor-pointer border ${
                isEndOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-xs text-indigo-500 dark:text-indigo-400">
                  stop_circle
                </span>
                <span className="truncate">{endPillLabel}</span>
              </div>
              <span className="material-symbols-outlined text-xs opacity-70">
                {isEndOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* End Time Dropdown */}
            {isEndOpen && (
              <div
                ref={endListRef}
                className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-50 max-h-56 overflow-y-auto"
              >
                <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700/60 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs">
                  {language === 'en' ? 'End Time (Duration)' : 'Hora de Fin (Duración)'}
                </div>
                {endTimeOptions.map((opt) => {
                  const isSelected = opt.minutes === endMins;
                  return (
                    <button
                      key={opt.time24}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => handleSelectEnd(opt)}
                      className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-slate-700 font-black text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-semibold'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-xs text-indigo-600 dark:text-indigo-400">
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Slots from Google Calendar (if any) */}
      {suggestedSlots && suggestedSlots.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-blue-500">event_available</span>
              <span>{language === 'en' ? 'Google Calendar Free Slots:' : 'Horarios Libres de Google Calendar:'}</span>
            </span>
            {loadingSlots && (
              <span className="text-[10px] text-blue-500 font-bold animate-pulse flex items-center gap-1">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                <span>{language === 'en' ? 'Syncing...' : 'Sincronizando...'}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {suggestedSlots.map((slot, idx) => {
              const slotLabel = typeof slot === 'string' ? slot : (slot.label || slot.start.split('T')[1]?.substring(0, 5) || '');
              const slotMins = time24ToMinutes(slotLabel);
              const isSelected = slotMins === startMins;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectStart(slotLabel)}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  {minutesTo12h(slotMins)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
