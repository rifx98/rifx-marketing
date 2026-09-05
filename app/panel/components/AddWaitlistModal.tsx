'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    customer_name?: string;
    phone_number?: string;
    company?: string;
    email?: string;
    conversation_id?: string;
    service?: string;
    resource_name?: string;
    desired_date?: string;
    preferred_time_range?: string;
    notes?: string;
  };
  language: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  setToast: (toast: any) => void;
  teamAgents?: any[];
  contacts?: any[];
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
  contacts = [],
}: AddWaitlistModalProps) {
  // Mode: 'select_crm' vs 'create_new'
  const [clientMode, setClientMode] = useState<'select_crm' | 'create_new'>('select_crm');
  
  // Client info
  const [crmSearch, setCrmSearch] = useState('');
  const [selectedCrmContact, setSelectedCrmContact] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [company, setCompany] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [autoSaveToCrm, setAutoSaveToCrm] = useState(true);

  // Reservation & preferences info
  const [desiredDate, setDesiredDate] = useState('');
  const [preferredTimeRange, setPreferredTimeRange] = useState('any');
  const [service, setService] = useState('Asesoría Comercial');
  const [resourceName, setResourceName] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setCustomerName(initialData?.customer_name || '');
      setPhoneNumber(initialData?.phone_number || '');
      setCompany(initialData?.company || '');
      setEmail(initialData?.email || '');
      setService(initialData?.service || 'Asesoría Comercial');
      setDesiredDate(initialData?.desired_date || tomorrow);
      setPreferredTimeRange(initialData?.preferred_time_range || 'any');
      setResourceName(initialData?.resource_name || '');
      setNotes(initialData?.notes || '');
      setConversationId(initialData?.conversation_id || '');
      setSelectedCrmContact(null);
      setCrmSearch('');
      setAutoSaveToCrm(true);

      // If initial data has a name or phone, check if contact exists in CRM
      if (initialData?.phone_number && contacts && contacts.length > 0) {
        const found = contacts.find(
          (c) => c.phone_number === initialData.phone_number || c.id === initialData.conversation_id
        );
        if (found) {
          setSelectedCrmContact(found);
          setClientMode('select_crm');
          if (found.company && !initialData.company) setCompany(found.company);
          if (found.email && !initialData.email) setEmail(found.email);
        } else {
          setClientMode('create_new');
        }
      } else {
        // Default to select if we have contacts, otherwise create
        setClientMode(contacts && contacts.length > 0 ? 'select_crm' : 'create_new');
      }
    }
  }, [isOpen, initialData, contacts]);

  // Filtered CRM contacts for search
  const filteredCrmContacts = useMemo(() => {
    if (!contacts || contacts.length === 0) return [];
    if (!crmSearch.trim()) return contacts.slice(0, 15);
    const query = crmSearch.toLowerCase().trim();
    return contacts
      .filter((c: any) => {
        const name = (c.customer_name || c.name || '').toLowerCase();
        const phone = (c.phone_number || c.phone || '').toLowerCase();
        const comp = (c.company || '').toLowerCase();
        const mail = (c.email || '').toLowerCase();
        return name.includes(query) || phone.includes(query) || comp.includes(query) || mail.includes(query);
      })
      .slice(0, 20);
  }, [contacts, crmSearch]);

  const handleSelectContact = (contact: any) => {
    setSelectedCrmContact(contact);
    setCustomerName(contact.customer_name || contact.name || '');
    setPhoneNumber(contact.phone_number || contact.phone || '');
    setCompany(contact.company || '');
    setEmail(contact.email || '');
    setConversationId(contact.id || '');
    setCrmSearch('');
  };

  const handleClearSelectedContact = () => {
    setSelectedCrmContact(null);
    setCustomerName('');
    setPhoneNumber('');
    setCompany('');
    setEmail('');
    setConversationId('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phoneNumber.trim() || !desiredDate) {
      setToast({
        type: 'error',
        message: language === 'en'
          ? 'Name, phone and desired date are required'
          : 'Nombre, teléfono y fecha deseada son requeridos'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let finalConvId = conversationId;

      // If in create_new mode and autoSaveToCrm is checked, create contact in CRM
      if (clientMode === 'create_new' && autoSaveToCrm && !finalConvId) {
        try {
          const createContactRes = await authFetch('/api/panel/add-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: customerName.trim(),
              phone: phoneNumber.trim(),
              message: '', // empty message avoids sending unsolicited WhatsApp
            }),
          });
          const contactData = await createContactRes.json();
          if (contactData?.id) {
            finalConvId = contactData.id;
          }
        } catch (contactErr) {
          console.warn('[AddWaitlistModal] Could not auto-save contact to CRM:', contactErr);
        }
      }

      // Build metadata prefix for notes: [Empresa: ... | Correo: ...]
      const metaParts: string[] = [];
      if (company.trim()) metaParts.push(`Empresa: ${company.trim()}`);
      if (email.trim()) metaParts.push(`Correo: ${email.trim()}`);
      
      const metaPrefix = metaParts.length > 0 ? `[${metaParts.join(' | ')}] ` : '';
      const formattedNotes = `${metaPrefix}${notes.trim()}`.trim();

      const res = await authFetch('/api/panel/appointments/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
          desired_date: desiredDate,
          preferred_time_range: preferredTimeRange,
          service: service.trim() || 'General',
          resource_name: resourceName || undefined,
          conversation_id: finalConvId || undefined,
          notes: formattedNotes || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast({
          type: 'success',
          message: language === 'en'
            ? '✓ Added to waitlist. Client will be notified upon availability.'
            : '✓ Registrado en lista de espera. Se organizará por antigüedad y se le notificará si se libera un espacio.'
        });
        onSuccess();
        onClose();
      } else {
        setToast({
          type: 'error',
          message: data.error || (language === 'en' ? 'Error adding to waitlist' : 'Error al añadir a lista de espera')
        });
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
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden my-8 max-h-[92vh] flex flex-col"
        >
          {/* Header Corporativo Limpio */}
          <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-lg">hourglass_top</span>
              </div>
              <div>
                <h2 className="text-sm font-normal text-slate-800 dark:text-slate-100 leading-tight">
                  {language === 'en' ? 'Add entry to waitlist' : 'Agregar entrada a lista de espera'}
                </h2>
                <p className="text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">
                  {language === 'en'
                    ? 'Online booking management and agile space reassignment'
                    : 'Gestión de reserva online y asignación ágil de espacios cancelados'}
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4.5 flex-1 bg-white dark:bg-slate-900">
            {/* 1. SECCIÓN CLIENTE: MODO SELECCIONAR O CREAR */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-normal text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400">person</span>
                  <span>{language === 'en' ? 'Client Information' : 'Datos del cliente'}</span>
                </span>

                {/* Segmented Control Tabs */}
                <div className="inline-flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('select_crm');
                      if (selectedCrmContact) {
                        handleSelectContact(selectedCrmContact);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-normal rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      clientMode === 'select_crm'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">group</span>
                    <span>{language === 'en' ? 'Select from CRM' : 'Seleccionar del CRM'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode('create_new');
                      handleClearSelectedContact();
                    }}
                    className={`px-3 py-1 text-xs font-normal rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      clientMode === 'create_new'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>{language === 'en' ? 'Create new contact' : 'Crear nuevo contacto'}</span>
                  </button>
                </div>
              </div>

              {/* Mode A: Seleccionar del CRM */}
              {clientMode === 'select_crm' && (
                <div className="space-y-2.5">
                  {selectedCrmContact ? (
                    <div className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-normal flex items-center justify-center border border-amber-500/20">
                          {(customerName || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-normal text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span>{customerName}</span>
                            {company && (
                              <span className="text-[11px] font-normal text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                {company}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-normal text-slate-400 dark:text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>{phoneNumber}</span>
                            {email && <span>• {email}</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSelectedContact}
                        className="px-2.5 py-1 text-xs font-normal text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      >
                        {language === 'en' ? 'Change' : 'Cambiar'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          placeholder={language === 'en' ? 'Search client by name, company, phone or email...' : 'Buscar cliente por nombre, compañía, teléfono o correo...'}
                          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                        />
                      </div>

                      {/* Dropdown list */}
                      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                        {filteredCrmContacts.length > 0 ? (
                          filteredCrmContacts.map((c: any) => (
                            <div
                              key={c.id || c.phone_number}
                              onClick={() => handleSelectContact(c)}
                              className="px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-normal flex items-center justify-center">
                                  {(c.customer_name || c.name || 'C')[0].toUpperCase()}
                                </span>
                                <div>
                                  <p className="text-xs font-normal text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                    {c.customer_name || c.name}
                                  </p>
                                  <p className="text-[11px] font-normal text-slate-400 font-mono">
                                    {c.phone_number || c.phone} {c.company ? `• ${c.company}` : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-normal text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                <span>{language === 'en' ? 'Select' : 'Seleccionar'}</span>
                                <span className="material-symbols-outlined text-xs">arrow_forward</span>
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-xs font-normal text-slate-400">
                            {language === 'en' ? 'No matching contacts found in CRM.' : 'No se encontraron contactos en tu CRM.'}
                            <button
                              type="button"
                              onClick={() => setClientMode('create_new')}
                              className="block mx-auto mt-1 text-amber-600 dark:text-amber-400 font-normal hover:underline cursor-pointer"
                            >
                              + {language === 'en' ? 'Create new contact' : 'Crear nuevo contacto'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Crear nuevo contacto */}
              {clientMode === 'create_new' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                        {language === 'en' ? 'Client Name' : 'Nombre del cliente'} <span className="text-rose-500 font-normal">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Laura Gómez"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                        {language === 'en' ? 'Company' : 'Compañía / Empresa'}
                      </label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Ej: Inversiones Alfa"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                        {language === 'en' ? 'Email Address' : 'Correo electrónico'}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ej: cliente@correo.com"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={autoSaveToCrm}
                      onChange={(e) => setAutoSaveToCrm(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      {language === 'en'
                        ? 'Automatically save new contact in CRM database'
                        : 'Guardar nuevo contacto automáticamente en el CRM'}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* 2. SECCIÓN DETALLES DE RESERVA & PREFERENCIAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'Service / Equipment' : 'Servicio / Equipo requerido'} <span className="text-rose-500 font-normal">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ej: Asesoría Comercial"
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{language === 'en' ? 'Preferred Specialist' : 'Especialista preferido'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">opcional</span>
                </label>
                {teamAgents && teamAgents.length > 0 ? (
                  <select
                    value={resourceName}
                    onChange={(e) => setResourceName(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- {language === 'en' ? 'Any available' : 'Cualquiera disponible'} --</option>
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
                    className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'Desired Date' : 'Fecha deseada'} <span className="text-rose-500 font-normal">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5">
                  {language === 'en' ? 'Preferred Time Range' : 'Franja horaria preferida'}
                </label>
                <select
                  value={preferredTimeRange}
                  onChange={(e) => setPreferredTimeRange(e.target.value)}
                  className="w-full bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-normal text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all cursor-pointer"
                >
                  <option value="any">{language === 'en' ? 'Any time' : 'Cualquier horario'}</option>
                  <option value="morning">{language === 'en' ? 'Morning (09:00 - 13:00)' : 'Mañana (09:00 - 13:00)'}</option>
                  <option value="afternoon">{language === 'en' ? 'Afternoon (14:00 - 18:00)' : 'Tarde (14:00 - 18:00)'}</option>
                  <option value="evening">{language === 'en' ? 'Evening (18:00 - 21:00)' : 'Noche (18:00 - 21:00)'}</option>
                </select>
              </div>
            </div>

            {/* 3. AGREGAR NOTA (PREFERENCIAS DE HORARIO DEL CLIENTE) */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/60">
              <label className="block text-xs font-normal text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400">edit_note</span>
                <span>{language === 'en' ? 'Schedule preferences and notes' : 'Notas y preferencias de horario'}</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'E.g., Client prefers appointments after 10:00 AM, or any cancellation on Friday afternoons...'
                    : 'Ej: El cliente prefiere mañanas a partir de las 10:00 AM, o cualquier turno cancelado los viernes...'
                }
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 outline-none transition-all"
              />
              <p className="text-[11px] font-normal text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-500">lightbulb</span>
                <span>
                  {language === 'en'
                    ? 'Notes will facilitate agile reassignment when slots open up.'
                    : 'Esta información permitirá al equipo reasignar citas con agilidad cuando ocurran cancelaciones.'}
                </span>
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 flex-shrink-0">
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
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-normal text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-sm shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    <span>{language === 'en' ? 'Saving...' : 'Guardando...'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">hourglass_top</span>
                    <span>{language === 'en' ? 'Save in waitlist' : 'Guardar en lista de espera'}</span>
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
