const fs = require('fs');
const path = require('path');

const file = path.join('app', 'panel', 'panel-client.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables
const stateHookStr = "const [botPreviewInput, setBotPreviewInput] = useState('');";
const newStateVars = `
  const [rechargeAmount, setRechargeAmount] = useState<number>(1000);
  const [rechargeNote, setRechargeNote] = useState<string>('Recarga manual');
  const [isRecharging, setIsRecharging] = useState(false);

  const handleRechargeCredits = async () => {
    if (!rechargeAmount || rechargeAmount <= 0) return;
    setIsRecharging(true);
    try {
      const res = await fetch('/api/panel/ai-ledger/recharge', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('rifx_session_token') ? { 'Authorization': \`Bearer \${localStorage.getItem('rifx_session_token')}\` } : {})
        },
        body: JSON.stringify({ amount: rechargeAmount, note: rechargeNote })
      });
      if (res.ok) {
        alert('Créditos agregados con éxito');
        setRechargeAmount(1000);
        setRechargeNote('Recarga manual');
      } else {
        const data = await res.json();
        alert('Error: ' + (data.error || 'No autorizado'));
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    } finally {
      setIsRecharging(false);
    }
  };
`;
if (content.includes(stateHookStr) && !content.includes('const [rechargeAmount')) {
  content = content.replace(stateHookStr, stateHookStr + "\n" + newStateVars);
}

// 2. Change lg:col-span-12 to lg:col-span-8
content = content.replace(
  '<div className="col-span-12 lg:col-span-12 space-y-8">',
  '<div className="col-span-12 lg:col-span-8 space-y-8">'
);

// 3. Insert right column
const rightColumnJsx = `
              {/* Right Column: AI Credits and Testing */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* Recharge Credits */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Recargar créditos</h3>
                  <p className="text-xs text-slate-500 mb-5">Saldo que venderás/administrarás</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Cantidad</label>
                      <input 
                        type="number"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0058bc]/20 transition-all outline-none text-slate-800"
                        placeholder="1000"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Nota</label>
                      <input 
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#0058bc]/20 transition-all outline-none text-slate-800"
                        placeholder="Recarga manual"
                        value={rechargeNote}
                        onChange={(e) => setRechargeNote(e.target.value)}
                      />
                    </div>
                    
                    <button 
                      onClick={handleRechargeCredits}
                      disabled={isRecharging}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-[#0b1c30] font-bold text-sm rounded-xl transition-all border border-slate-200 flex justify-center items-center gap-2"
                    >
                      {isRecharging ? 'Procesando...' : '+ Agregar créditos'}
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setRechargeAmount((prev) => prev + 1000)} className="py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">+1.000</button>
                      <button onClick={() => setRechargeAmount((prev) => prev + 5000)} className="py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">+5.000</button>
                      <button onClick={() => setRechargeAmount((prev) => prev + 10000)} className="py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">+10.000</button>
                    </div>
                  </div>
                </div>

                {/* Probar IA */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Probar IA</h3>
                  <p className="text-xs text-slate-500 mb-5">Una prueba real consume créditos</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Mensaje de prueba</label>
                      <textarea
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#10b981]/20 transition-all outline-none min-h-[100px] text-slate-800"
                        placeholder="Hola, preséntate brevemente como asistente de FlowZap."
                        value={botPreviewInput}
                        onChange={(e) => setBotPreviewInput(e.target.value)}
                      />
                    </div>
                    
                    <button 
                      onClick={() => alert('Simulador en construcción')}
                      className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl transition-all flex justify-center items-center gap-2 shadow-md shadow-emerald-500/20"
                    >
                      <span className="material-symbols-outlined text-sm">science</span> Ejecutar prueba
                    </button>
                  </div>
                </div>

                {/* Cómo se cobra */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Cómo se cobra</h3>
                  <p className="text-xs text-slate-500 mb-5">Separado de FlowZap base</p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-xs text-slate-500">FlowZap base</span>
                      <strong className="text-xs text-slate-800">Tu plan normal</strong>
                    </div>
                    <div className="text-center text-slate-400 text-lg">+</div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-xs text-slate-500">Módulo AI</span>
                      <strong className="text-xs text-slate-800">$25.00 / mes</strong>
                    </div>
                    <div className="text-center text-slate-400 text-lg">+</div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-xs text-slate-500">Consumo</span>
                      <strong className="text-xs text-slate-800">$10.00 / 1K créditos</strong>
                    </div>
                  </div>
                </div>
              </div>
`;

if (!content.includes('Recargar créditos')) {
  content = content.replace(
    "            </div>{/* end grid grid-cols-12 */}",
    rightColumnJsx + "\n            </div>{/* end grid grid-cols-12 */}"
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('UI updated successfully!');
