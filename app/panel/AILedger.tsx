import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';

export default function AILedger({ language }: { language: string }) {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/panel/ai-ledger')
      .then(res => res.json())
      .then(data => {
        if (data.ledgers) setLedgers(data.ledgers);
        if (data.balance !== undefined) setBalance(data.balance);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4 text-slate-500">Cargando movimientos...</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-primary">{language === 'en' ? 'AI Credits History' : 'Historial de Saldo IA'}</h3>
          <p className="text-sm text-slate-500">{language === 'en' ? 'Track your AI credit usage and recharges' : 'Monitorea el uso y recargas de tus créditos de IA'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Available Balance' : 'Saldo Disponible'}</p>
          <p className="text-3xl font-black text-indigo-600">{balance}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Fecha</th>
              <th className="py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Tipo</th>
              <th className="py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Descripción</th>
              <th className="py-3 px-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {ledgers.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-slate-500">No hay movimientos registrados.</td></tr>
            ) : (
              ledgers.map(l => (
                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                      l.transaction_type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {l.transaction_type === 'credit' ? 'Recarga' : 'Consumo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{l.description}</td>
                  <td className={`py-3 px-4 text-right font-bold ${Number(l.amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(l.amount) > 0 ? '+' : ''}{l.amount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
