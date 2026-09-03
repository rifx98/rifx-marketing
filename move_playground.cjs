const fs = require('fs');
const path = require('path');
const file = path.join('app', 'panel', 'panel-client.tsx');
let content = fs.readFileSync(file, 'utf8');

const startTag = "{activeTab === 'playground' && (";
const startIndex = content.indexOf(startTag);
if (startIndex === -1) {
  console.error("Start tag not found.");
  process.exit(1);
}

// Find the end by regex
const endRegex = /<\/motion\.div>\s*\)\}\s*\{activeTab === 'banners'/;
const match = content.substring(startIndex).match(endRegex);
if (!match) {
  console.error("End tag not found.");
  process.exit(1);
}

const endMatchStr = match[0];
const endTagString = "</motion.div>\n        )}";
const endIndex = startIndex + match.index + endMatchStr.indexOf("{activeTab === 'banners'") - 1; // pointing to whitespace before banners

const fullBlock = content.substring(startIndex, endIndex);

// Remove the block from the original location
content = content.substring(0, startIndex) + content.substring(endIndex);

// The raw JSX is inside fullBlock, we just need to strip the condition:
let innerJsx = fullBlock.trim();
innerJsx = innerJsx.substring(startTag.length);
innerJsx = innerJsx.substring(0, innerJsx.lastIndexOf('}'));
innerJsx = innerJsx.substring(0, innerJsx.lastIndexOf(')'));
innerJsx = innerJsx.trim(); // This is just the <motion.div>...</motion.div>

const metricsJsx = `
      <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl border border-purple-200 mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-slate-800">FlowZap AI</h2>
            <span className="bg-purple-600 text-white text-[10px] uppercase font-black px-2 py-1 rounded-full tracking-wider">Premium</span>
          </div>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            IA generativa de alto rendimiento integrada en tu flujo. Puedes usar un bloque de Inteligencia Artificial para responder consultas complejas sin crear menús rígidos.
          </p>
        </div>
        <div className="text-right">
          <strong className="text-4xl font-bold text-purple-700 block">0</strong>
          <span className="text-xs text-slate-500">Créditos disponibles</span>
          <div className="mt-2 inline-block bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-full font-bold">Sin IA configurada</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">💸</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Utilizados este mes</span>
            <strong className="text-xl font-bold text-slate-800 block">0</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">🧠</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Consultas IA</span>
            <strong className="text-xl font-bold text-slate-800 block">0</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-[0_4px_16px_rgba(31,41,55,0.035)] flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl">📉</div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Costo proveedor</span>
            <strong className="text-xl font-bold text-slate-800 block">$0.0000</strong>
          </div>
        </div>
      </div>
`;

const targetStrMatch = content.match(/\{botSection === 'flowzap' && \(\s*<FlowZapAI \/>\s*\)\}/);
if (!targetStrMatch) {
  console.error("Target replacement string not found.");
  process.exit(1);
}
const targetStr = targetStrMatch[0];

const newTargetStr = "{botSection === 'flowzap' && (\n  <div className=\"w-full text-left font-inter text-slate-800 flex flex-col gap-4\">\n" + metricsJsx + "\n" + innerJsx + "\n  </div>\n)}";

content = content.replace(targetStr, newTargetStr);

// Also remove playground from the main sidebar tab definitions
content = content.replace(/{ key: 'playground', icon: 'smart_toy', labelEs: 'Playground IA', labelEn: 'AI Playground' },/g, "");

fs.writeFileSync(file, content, 'utf8');
console.log('Success!');
