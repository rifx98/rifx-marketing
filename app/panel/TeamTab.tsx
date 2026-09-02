import React, { useState, useEffect } from 'react';


export default function TeamTab({ language }: { language: string }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'agent'
  });

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/panel/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ email: '', role: 'agent' });
        fetchAgents();
      } else {
        alert("Error al invitar agente");
      }
    } catch (e) {
      console.error(e);
      alert("Error");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Cargando equipo...</div>;

  return (
    <div>
      <section className="mb-8 flex justify-between items-end flex-wrap gap-4">
        <div>
          <span className="text-primary-container font-extrabold tracking-[0.2em] text-[10px] uppercase mb-2 block">Settings</span>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight mb-3">
            {language === 'en' ? 'Team Management' : 'Gestión de Equipo'}
          </h1>
          <p className="text-base text-slate-500 font-light">
            {language === 'en' ? 'Manage agents and their roles.' : 'Gestiona los asesores y sus roles en tu empresa.'}
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2.5 bg-primary-container text-white rounded-xl font-bold hover:bg-primary transition-all shadow-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {showForm ? (language === 'en' ? 'Cancel' : 'Cancelar') : (language === 'en' ? 'Invite Agent' : 'Invitar Agente')}
        </button>
      </section>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold text-primary mb-6">Invitar Nuevo Agente</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Correo Electrónico</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none"
                placeholder="agente@tuempresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Rol</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none bg-white"
              >
                <option value="admin">Administrador</option>
                <option value="agent">Asesor (Agente)</option>
                <option value="viewer">Solo Lectura</option>
              </select>
            </div>

            <button type="submit" className="px-8 py-3 mt-4 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all">
              Enviar Invitación
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Email</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Rol</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Estado</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {agents.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-6 text-center text-slate-500">No hay agentes en el equipo.</td>
              </tr>
            ) : (
              agents.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">{a.email}</td>
                  <td className="py-4 px-6">
                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider bg-slate-100 text-slate-600">
                      {a.role}
                    </span>
                  </td>
                  <td className="py-4 px-6"><span className="text-green-600 font-bold text-xs">Activo</span></td>
                  <td className="py-4 px-6 text-slate-400 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
