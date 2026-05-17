import fs from 'fs';

let content = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

// Insert the missing menu items in the nav block
const navStart = content.indexOf('<nav className="flex-1 flex flex-col gap-1">');
if (navStart === -1) { console.error('Nav not found'); process.exit(1); }
const insertNavPoint = content.indexOf('</nav>', navStart);

const navButtons = `
          <button onClick={() => setActiveTab('playground')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'playground' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">smart_toy</span>
            <span>{language === 'en' ? 'AI Playground' : 'Playground IA'}</span>
          </button>
          <button onClick={() => setActiveTab('segments')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'segments' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">pie_chart</span>
            <span>{language === 'en' ? 'Segments' : 'Segmentos'}</span>
          </button>
          <button onClick={() => setActiveTab('analytics')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'analytics' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">monitoring</span>
            <span>{language === 'en' ? 'Analytics' : 'Análisis'}</span>
          </button>
`;

content = content.substring(0, insertNavPoint) + navButtons + content.substring(insertNavPoint);

// Insert the rendering logic for the new tabs inside <main>
const mainEnd = content.lastIndexOf('</main>');

const mockViews = `
        {activeTab === 'playground' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-8 font-headline">{language === 'en' ? 'AI Playground' : 'Playground IA'}</h1>
            <div className="bg-crm-surface-container-lowest p-8 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-slate-500 font-medium text-center">
                {language === 'en' ? 'AI experimentation environment coming soon.' : 'Entorno de experimentación de IA próximamente.'}
              </p>
            </div>
          </div>
        )}
        {activeTab === 'segments' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-8 font-headline">{language === 'en' ? 'Segments' : 'Segmentos'}</h1>
            <div className="bg-crm-surface-container-lowest p-8 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-slate-500 font-medium text-center">
                {language === 'en' ? 'Audience segmentation controls coming soon.' : 'Controles de segmentación de audiencia próximamente.'}
              </p>
            </div>
          </div>
        )}
        {activeTab === 'analytics' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-8 font-headline">{language === 'en' ? 'Analytics' : 'Análisis'}</h1>
            <div className="bg-crm-surface-container-lowest p-8 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-slate-500 font-medium text-center">
                {language === 'en' ? 'Advanced metrics and analytics coming soon.' : 'Métricas y análisis avanzados próximamente.'}
              </p>
            </div>
          </div>
        )}
`;

content = content.substring(0, mainEnd) + mockViews + content.substring(mainEnd);

fs.writeFileSync('app/panel/panel-client.tsx', content);
console.log('Successfully patched app/panel/panel-client.tsx with new sections');
