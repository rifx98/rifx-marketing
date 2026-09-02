import React, { useState, useEffect } from 'react';


export default function CampaignsTab({ language, isTest }: { language: string, isTest: boolean }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    whatsapp_account_id: '',
    template_name: '',
    template_language: 'es'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campRes, accRes] = await Promise.all([
        fetch('/api/panel/wa-campaigns').then((r: any) => r.json()),
        fetch('/api/panel/whatsapp-accounts').then((r: any) => r.json())
      ]);
      if (campRes.campaigns) setCampaigns(campRes.campaigns);
      if (accRes.accounts) {
        setWhatsappAccounts(accRes.accounts);
        if (accRes.accounts.length > 0) {
          setFormData(prev => ({ ...prev, whatsapp_account_id: accRes.accounts[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/panel/wa-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', whatsapp_account_id: whatsappAccounts[0]?.id || '', template_name: '', template_language: 'es' });
        fetchData();
      } else {
        alert("Error creating campaign");
      }
    } catch (e) {
      console.error(e);
      alert("Error");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Cargando campañas...</div>;

  return (
    <div>
      <section className="mb-8 flex justify-between items-end flex-wrap gap-4">
        <div>
          <span className="text-primary-container font-extrabold tracking-[0.2em] text-[10px] uppercase mb-2 block">WhatsApp</span>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight mb-3">
            {language === 'en' ? 'Outbound Campaigns' : 'Campañas Outbound'}
          </h1>
          <p className="text-base text-slate-500 font-light">
            {language === 'en' ? 'Send massive template messages to your audience.' : 'Envía mensajes de plantilla de forma masiva a tu audiencia.'}
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2.5 bg-primary-container text-white rounded-xl font-bold hover:bg-primary transition-all shadow-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">campaign</span>
          {showForm ? (language === 'en' ? 'Cancel' : 'Cancelar') : (language === 'en' ? 'New Campaign' : 'Nueva Campaña')}
        </button>
      </section>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-xl font-bold text-primary mb-6">Crear Nueva Campaña</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nombre de la Campaña</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container/30 outline-none"
                placeholder="Ej: Promo Verano 2024"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Cuenta de WhatsApp</label>
              <select 
                value={formData.whatsapp_account_id}
                onChange={e => setFormData({...formData, whatsapp_account_id: e.target.value})}
                className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container/30 outline-none bg-white"
              >
                {whatsappAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name || acc.phone_number_id}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Template Oficial</label>
                <input 
                  type="text" 
                  required
                  value={formData.template_name}
                  onChange={e => setFormData({...formData, template_name: e.target.value})}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none"
                  placeholder="ej: hello_world"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Idioma</label>
                <input 
                  type="text" 
                  value={formData.template_language}
                  onChange={e => setFormData({...formData, template_language: e.target.value})}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 outline-none"
                  placeholder="ej: es"
                />
              </div>
            </div>

            <button type="submit" className="px-8 py-3 mt-4 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all">
              Crear y Programar
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Campaña</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Estado</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Template</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Métricas</th>
              <th className="py-4 px-6 font-bold text-slate-600 text-xs uppercase tracking-wider">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-6 text-center text-slate-500">No hay campañas creadas.</td>
              </tr>
            ) : (
              campaigns.map(camp => (
                <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-bold text-primary">{camp.name}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                      camp.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                      camp.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      camp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {camp.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-500">{camp.template_name} ({camp.template_language})</td>
                  <td className="py-4 px-6">
                    <div className="text-xs text-slate-500 flex gap-3">
                      <span className="text-indigo-600 font-bold" title="Enviados"><span className="material-symbols-outlined text-[12px] align-middle mr-1">send</span>{camp.sent_count}</span>
                      <span className="text-green-600 font-bold" title="Entregados"><span className="material-symbols-outlined text-[12px] align-middle mr-1">done_all</span>{camp.delivered_count}</span>
                      <span className="text-blue-600 font-bold" title="Leídos"><span className="material-symbols-outlined text-[12px] align-middle mr-1">done_all</span>{camp.read_count}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-400 text-xs">{new Date(camp.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
