import React, { useState, useEffect, useCallback } from 'react';

// ---- Constants ----

const VALID_ROLES = [
  { value: 'Administrador', label: 'Administrador', description: 'Acceso total al panel' },
  { value: 'Supervisor', label: 'Supervisor', description: 'Puede supervisar y gestionar equipo' },
  { value: 'Asesor', label: 'Asesor', description: 'Acceso limitado según secciones asignadas' },
] as const;

const ASSIGNABLE_SECTIONS = [
  { key: 'dashboard', icon: 'dashboard', label: 'Panel Principal' },
  { key: 'crm', icon: 'group', label: 'Usuarios / CRM' },
  { key: 'conversations', icon: 'sms', label: 'Conversaciones' },
  { key: 'wa_campaigns', icon: 'campaign', label: 'Campañas WA' },
  { key: 'orders', icon: 'receipt_long', label: 'Pedidos' },
  { key: 'basic_bot', icon: 'forum', label: 'Bot Básico' },
  { key: 'appointments', icon: 'calendar_month', label: 'Citas y Reservas' },
  { key: 'banners', icon: 'palette', label: 'Pancartas' },
  { key: 'campaigns', icon: 'campaign', label: 'Pautas Publicitarias' },
  { key: 'social', icon: 'rocket_launch', label: 'OmniPublish' },
  { key: 'segments', icon: 'pie_chart', label: 'Segmentos' },
  { key: 'analytics', icon: 'monitoring', label: 'Análisis' },
] as const;

// ---- Types ----

interface TeamAgent {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  departments: { allowed_sections?: string[] } | null;
  created_at: string;
  updated_at: string;
}

// ---- Component ----

export default function TeamTab({ language }: { language: string }) {
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Invite form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Asesor',
    allowedSections: [] as string[],
  });

  // Permissions modal state
  const [editingAgent, setEditingAgent] = useState<TeamAgent | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editSections, setEditSections] = useState<string[]>([]);

  // Delete confirmation
  const [deletingAgent, setDeletingAgent] = useState<TeamAgent | null>(null);

  const t = useCallback((en: string, es: string) => language === 'en' ? en : es, [language]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/panel/team');
      const data = await res.json();
      if (data.agents) setAgents(data.agents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // ---- Invite (POST) ----
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/panel/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', email: '', role: 'Asesor', allowedSections: [] });
        fetchAgents();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al invitar agente');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // ---- Update permissions (PATCH) ----
  const handleSavePermissions = async () => {
    if (!editingAgent) return;
    setSaving(true);
    try {
      const res = await fetch('/api/panel/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: editingAgent.id,
          role: editRole,
          allowedSections: editSections,
        }),
      });
      if (res.ok) {
        setEditingAgent(null);
        fetchAgents();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al actualizar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete agent ----
  const handleDelete = async () => {
    if (!deletingAgent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/panel/team?agentId=${deletingAgent.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingAgent(null);
        fetchAgents();
      } else {
        alert('Error al eliminar');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ---- Helpers ----
  const openEditModal = (agent: TeamAgent) => {
    setEditingAgent(agent);
    setEditRole(agent.role);
    setEditSections(agent.departments?.allowed_sections || []);
  };

  const toggleFormSection = (key: string) => {
    setFormData(prev => ({
      ...prev,
      allowedSections: prev.allowedSections.includes(key)
        ? prev.allowedSections.filter(s => s !== key)
        : [...prev.allowedSections, key],
    }));
  };

  const toggleEditSection = (key: string) => {
    setEditSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const selectAllSections = (setter: (keys: string[]) => void) => {
    setter(ASSIGNABLE_SECTIONS.map(s => s.key));
  };

  const clearAllSections = (setter: (keys: string[]) => void) => {
    setter([]);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Administrador': return 'bg-indigo-100 text-indigo-700';
      case 'Supervisor': return 'bg-amber-100 text-amber-700';
      case 'Asesor': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getSectionCount = (agent: TeamAgent) => {
    const sections = agent.departments?.allowed_sections;
    if (!sections || !Array.isArray(sections)) return 0;
    return sections.length;
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500">
        <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
        {t('Loading team...', 'Cargando equipo...')}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <section className="mb-8 flex justify-between items-end flex-wrap gap-4">
        <div>
          <span className="text-primary-container font-extrabold tracking-[0.2em] text-[10px] uppercase mb-2 block">
            {t('Settings', 'Gestión')}
          </span>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight mb-3">
            {t('Team Management', 'Gestión de Equipo')}
          </h1>
          <p className="text-base text-slate-500 font-light">
            {t('Manage agents, roles and section access.', 'Gestiona los asesores, sus roles y el acceso a secciones.')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2.5 bg-primary-container text-white rounded-xl font-bold hover:bg-primary transition-all shadow-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {showForm ? t('Cancel', 'Cancelar') : t('Invite Agent', 'Invitar Agente')}
        </button>
      </section>

      {/* ============ INVITE FORM ============ */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            {t('Invite New Agent', 'Invitar Nuevo Agente')}
          </h2>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Name + Email row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('Full Name', 'Nombre Completo')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  placeholder="Ej: Carlos Méndez"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('Email', 'Correo Electrónico')} *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  placeholder="agente@tuempresa.com"
                />
              </div>
            </div>

            {/* Role select */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('Role', 'Rol')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {VALID_ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: r.value })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      formData.role === r.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`text-sm font-bold ${formData.role === r.value ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {r.label}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Section Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-slate-700">
                  {t('Allowed Sections', 'Secciones Permitidas')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectAllSections((s) => setFormData(prev => ({ ...prev, allowedSections: s })))}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {t('Select All', 'Todas')}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => clearAllSections((s) => setFormData(prev => ({ ...prev, allowedSections: s })))}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {t('Clear', 'Ninguna')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {ASSIGNABLE_SECTIONS.map(s => (
                  <label
                    key={s.key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      formData.allowedSections.includes(s.key)
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.allowedSections.includes(s.key)}
                      onChange={() => toggleFormSection(s.key)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="material-symbols-outlined text-[16px] text-slate-500">{s.icon}</span>
                    <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                {t('Send Invitation', 'Enviar Invitación')}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
              >
                {t('Cancel', 'Cancelar')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ AGENTS TABLE ============ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">{t('Name', 'Nombre')}</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Email</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">{t('Role', 'Rol')}</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">{t('Sections', 'Secciones')}</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">{t('Status', 'Estado')}</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">{t('Actions', 'Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">group_off</span>
                  <p className="text-slate-500 font-medium">{t('No agents in the team.', 'No hay agentes en el equipo.')}</p>
                  <p className="text-slate-400 text-xs mt-1">{t('Invite your first agent to get started.', 'Invita a tu primer agente para empezar.')}</p>
                </td>
              </tr>
            ) : (
              agents.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-4 px-6">
                    <span className="font-bold text-primary">{a.name || '—'}</span>
                  </td>
                  <td className="py-4 px-6 text-slate-600">{a.email}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${getRoleBadgeColor(a.role)}`}>
                      {a.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {a.role === 'Administrador' ? (
                      <span className="text-xs text-indigo-600 font-semibold">{t('All', 'Todas')}</span>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">
                        {getSectionCount(a) > 0
                          ? `${getSectionCount(a)} ${t('sections', 'secciones')}`
                          : <span className="text-amber-500">{t('None assigned', 'Sin asignar')}</span>
                        }
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs font-bold ${a.status === 'Disponible' ? 'text-green-600' : 'text-slate-400'}`}>
                      {a.status || t('Active', 'Activo')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(a)}
                        className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                        title={t('Edit permissions', 'Editar permisos')}
                      >
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                      </button>
                      <button
                        onClick={() => setDeletingAgent(a)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title={t('Remove', 'Eliminar')}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ============ PERMISSIONS MODAL ============ */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditingAgent(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">tune</span>
                    {t('Edit Permissions', 'Editar Permisos')}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{editingAgent.name} · {editingAgent.email}</p>
                </div>
                <button onClick={() => setEditingAgent(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-[20px] text-slate-400">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Role selection */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">{t('Role', 'Rol')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {VALID_ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setEditRole(r.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        editRole === r.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className={`text-xs font-bold ${editRole === r.value ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {r.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-slate-700">
                    {t('Allowed Sections', 'Secciones Permitidas')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllSections(setEditSections)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {t('All', 'Todas')}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => clearAllSections(setEditSections)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {t('None', 'Ninguna')}
                    </button>
                  </div>
                </div>

                {editRole === 'Administrador' ? (
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                    <span className="material-symbols-outlined text-indigo-500 text-2xl block mb-1">verified</span>
                    <p className="text-sm text-indigo-700 font-semibold">
                      {t('Administrators have access to all sections', 'Los Administradores tienen acceso a todas las secciones')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {ASSIGNABLE_SECTIONS.map(s => (
                      <label
                        key={s.key}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          editSections.includes(s.key)
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editSections.includes(s.key)}
                          onChange={() => toggleEditSection(s.key)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="material-symbols-outlined text-[16px] text-slate-500">{s.icon}</span>
                        <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-5 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
              >
                {t('Cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
                {t('Save Changes', 'Guardar Cambios')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ DELETE CONFIRMATION ============ */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDeletingAgent(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-red-500 text-4xl block mb-3">warning</span>
              <h3 className="text-lg font-bold text-slate-800">
                {t('Remove agent?', '¿Eliminar agente?')}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                {t(
                  `Are you sure you want to remove ${deletingAgent.name || deletingAgent.email} from the team?`,
                  `¿Estás seguro de eliminar a ${deletingAgent.name || deletingAgent.email} del equipo?`
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingAgent(null)}
                className="flex-1 px-4 py-2.5 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
              >
                {t('Cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {t('Remove', 'Eliminar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
