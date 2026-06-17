const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'home-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove scroll variables
const varsStart = content.indexOf('  // Framer Motion scroll calculations for sales funnel sticky reveal');
const varsEnd = content.indexOf('  return (');
if (varsStart !== -1 && varsEnd !== -1) {
  content = content.substring(0, varsStart) + '  // Scroll anims replaced\n' + content.substring(varsEnd);
}

// Replace funnel section
const funnelStart = content.indexOf('        {/* Services Section — Embudo de Ventas Scroll-driven */}');
const funnelEnd = content.indexOf('        {/* Testimonials Section */}');

if (funnelStart !== -1 && funnelEnd !== -1) {
  const newFunnel = `        {/* Services Section — Embudo de Ventas Zig-Zag */}
        <section className="bg-[#0b1229] py-24 lg:py-32 relative border-t border-white/5" id="funnel-section">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-24">
              <span className="text-rocket-orange font-mono text-xs uppercase tracking-[0.3em] block mb-2">
                Embudo de Ventas RIFX
              </span>
              <h2 className="text-white text-4xl lg:text-6xl font-space-grotesk font-black leading-tight mb-4 uppercase drop-shadow-lg">
                SISTEMA DE<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rocket-orange to-yellow-400">CRECIMIENTO</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light">
                Guiamos a tus clientes desde el primer impacto hasta la conversión y la recompra automatizada. Solo los resultados importan.
              </p>
            </div>

            <div className="space-y-24 lg:space-y-32 relative pt-8">
              {/* Central Line */}
              <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-rocket-orange/0 via-rocket-orange/30 to-rocket-orange/0 -translate-x-1/2" />

              {[
                { phase: "Fase 1: Atracción de Leads", title: "Anuncios de Alta Velocidad", desc: "Campañas publicitarias optimizadas con inteligencia artificial para captar leads calificados en Meta y Google, escalando tus ventas de forma inmediata y constante.", emoji: "🚀", align: "left" },
                { phase: "Fase 2: Interacción Inteligente", title: "WhatsApp con IA", desc: "Automatización e Inteligencia Artificial en tus chats. Agentes IA conversacionales entrenados para responder preguntas, enviar catálogos y concretar ventas 24/7.", emoji: "💬", align: "right" },
                { phase: "Fase 3: Conversión y Estructura", title: "Diseño UX/UI", desc: "Páginas web inmersivas y Landing Pages de alta conversión que guían al usuario de manera intuitiva y visualmente impactante, maximizando la retención y la conversión.", emoji: "🎨", align: "left" },
                { phase: "Fase 4: Conversión y Escalamiento", title: "E-commerce Interestelar", desc: "Pasarelas de pago integradas, logística automatizada y optimización de checkout estelar. Tu tienda en línea construida para vender a escala mundial sin fricción.", emoji: "🛒", align: "right" },
              ].map((s, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: s.align === "left" ? -50 : 50, y: 30 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={\`flex flex-col lg:flex-row items-center gap-8 lg:gap-24 \${s.align === 'right' ? 'lg:flex-row-reverse' : ''}\`}
                >
                  <div className={\`w-full lg:w-1/2 flex flex-col \${s.align === 'left' ? 'lg:items-end lg:text-right' : 'lg:items-start lg:text-left'} text-center\`}>
                    <span className="text-rocket-orange font-mono text-xs font-bold uppercase tracking-widest mb-3 block">
                      {s.phase}
                    </span>
                    <h3 className="text-white text-3xl lg:text-5xl font-space-grotesk font-black mb-6 drop-shadow-md hover:text-rocket-orange transition-colors duration-300">
                      {s.title}
                    </h3>
                    <p className="text-gray-300 text-lg font-light leading-relaxed max-w-md">
                      {s.desc}
                    </p>
                  </div>
                  
                  <div className="w-full lg:w-1/2 flex justify-center lg:justify-start">
                    <div className="text-8xl lg:text-[10rem] opacity-30 filter drop-shadow-[0_0_30px_rgba(242,113,33,0.3)] hover:opacity-100 hover:scale-110 transition-all duration-500 cursor-default">
                      {s.emoji}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>\n\n`;

  content = content.substring(0, funnelStart) + newFunnel + content.substring(funnelEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Success");
} else {
  console.log("Error finding sections", { funnelStart, funnelEnd });
}
