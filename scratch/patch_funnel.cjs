const fs = require('fs');
const file = 'app/home-client.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newSection = `        {/* Services Section — Embudo de Ventas Scroll-driven */}
        <section ref={containerRef} className="relative bg-[#0b1229] border-b border-white/5 py-12 lg:py-0" data-purpose="services-section">
          {/* Subtle grid background for high-tech feel */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          <div className="hidden lg:block lg:min-h-[350vh] relative w-full">
            {/* Desktop: Sticky scroll stacked cards */}
            <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rocket-orange/5 via-[#0b1229] to-[#0b1229] pointer-events-none" />

              <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-16 items-center relative z-10 w-full">
                
                {/* Left Column (Sticky info) */}
                <div className="lg:col-span-5 space-y-8">
                  <div>
                    <div className="inline-flex items-center gap-2 mb-6 bg-white/5 border border-white/10 rounded-full px-4 py-2 backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-rocket-orange animate-pulse" />
                      <span className="text-rocket-orange font-mono text-xs uppercase tracking-[0.3em] font-bold">
                        Embudo de Ventas RIFX
                      </span>
                    </div>
                    <h2 className="text-white text-5xl lg:text-7xl font-space-grotesk font-black leading-[0.9] tracking-tighter mb-6 uppercase drop-shadow-xl">
                      Sistema De<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-rocket-orange to-yellow-400 drop-shadow-[0_0_20px_rgba(242,113,33,0.5)]">Crecimiento</span>
                    </h2>
                    <p className="text-gray-400 text-lg lg:text-xl font-light tracking-wide max-w-md font-inter leading-relaxed">
                      Guiamos a tus clientes desde el primer impacto hasta la recompra automatizada. Cada fase es letal.
                    </p>
                  </div>

                  {/* Funnel Progress Indicator */}
                  <div className="space-y-6 pt-8 border-t border-white/10 max-w-sm">
                    {[
                      { index: 0, label: "Atracción Explosiva" },
                      { index: 1, label: "Interacción IA" },
                      { index: 2, label: "Conversión Inmersiva" },
                      { index: 3, label: "Escalamiento Global" },
                    ].map(step => (
                      <div key={step.index} className="flex items-center gap-6 group">
                        <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono border-2 transition-all duration-500 \${activeService === step.index ? 'bg-rocket-orange border-rocket-orange text-white scale-125 shadow-[0_0_20px_rgba(242,113,33,0.6)]' : 'bg-[#161e3d] border-white/10 text-gray-500 group-hover:border-white/30'}\`}>
                          {step.index + 1}
                        </div>
                        <span className={\`text-base font-bold transition-all duration-500 uppercase tracking-widest \${activeService === step.index ? 'text-white translate-x-2' : 'text-gray-600 group-hover:text-gray-400'}\`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column (Stacked Cards) */}
                <div className="lg:col-span-7 relative h-[650px] w-full flex items-center justify-center">
                  
                  {/* Card 1: Ads */}
                  <motion.div style={{ y: y1, scale: scale1, opacity: opacity1, zIndex: 10 }} className="absolute w-full max-w-2xl">
                    <Link href="/servicios/anuncios-de-alta-velocidad" className="block group">
                      <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 lg:p-12 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-500 group-hover:border-rocket-orange/50">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rocket-orange/20 rounded-full blur-[80px] group-hover:bg-rocket-orange/30 transition-all duration-500" />
                        <span className="text-7xl block mb-8 drop-shadow-2xl">🚀</span>
                        <span className="text-xs font-mono font-bold text-rocket-orange uppercase tracking-[0.3em] bg-rocket-orange/10 border border-rocket-orange/20 px-3 py-1.5 rounded-lg mb-4 inline-block">
                          Fase 1: Tráfico
                        </span>
                        <h3 className="text-white text-4xl lg:text-5xl font-space-grotesk font-black mb-4 tracking-tighter uppercase group-hover:text-rocket-orange transition-colors duration-300">
                          Ads de Alta Velocidad
                        </h3>
                        <div className={\`transition-all duration-500 origin-top \${activeService === 0 ? 'opacity-100 max-h-[300px] mt-0' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}\`}>
                          <p className="text-gray-300 text-lg leading-relaxed mb-8 font-light tracking-wide">
                            Campañas optimizadas con IA en Meta y Google. Dominamos la pauta digital para inyectar tráfico calificado directo a tu embudo y detonar ventas inmediatas.
                          </p>
                          <span className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 bg-rocket-orange/20 hover:bg-rocket-orange py-3 px-6 rounded-full w-max transition-all group-hover:shadow-[0_0_20px_rgba(242,113,33,0.5)]">
                            Explorar <span className="material-symbols-outlined">east</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>

                  {/* Card 2: WhatsApp IA */}
                  <motion.div style={{ y: y2, scale: scale2, opacity: opacity2, zIndex: 20 }} className="absolute w-full max-w-2xl">
                    <Link href="/servicios/whatsapp-ai" className="block group">
                      <div className="bg-[#0b162c]/80 backdrop-blur-3xl border border-white/10 p-10 lg:p-12 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.9)] relative overflow-hidden transition-all duration-500 group-hover:border-blue-500/50">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] group-hover:bg-blue-500/30 transition-all duration-500" />
                        <span className="text-7xl block mb-8 drop-shadow-2xl">💬</span>
                        <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-[0.3em] bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg mb-4 inline-block">
                          Fase 2: Interacción
                        </span>
                        <h3 className="text-white text-4xl lg:text-5xl font-space-grotesk font-black mb-4 tracking-tighter uppercase group-hover:text-blue-400 transition-colors duration-300">
                          Agentes IA en WhatsApp
                        </h3>
                        <div className={\`transition-all duration-500 origin-top \${activeService === 1 ? 'opacity-100 max-h-[300px] mt-0' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}\`}>
                          <p className="text-gray-300 text-lg leading-relaxed mb-8 font-light tracking-wide">
                            Automatización radical. IA conversacional que responde, envía catálogos y cierra ventas 24/7. Transforma tu WhatsApp en una máquina autónoma de facturación.
                          </p>
                          <span className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 bg-blue-500/20 hover:bg-blue-600 py-3 px-6 rounded-full w-max transition-all group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                            Explorar <span className="material-symbols-outlined">east</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>

                  {/* Card 3: UX/UI Design */}
                  <motion.div style={{ y: y3, scale: scale3, opacity: opacity3, zIndex: 30 }} className="absolute w-full max-w-2xl">
                    <Link href="/servicios/diseno-web-inmersivo" className="block group">
                      <div className="bg-[#120d2b]/80 backdrop-blur-3xl border border-white/10 p-10 lg:p-12 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.9)] relative overflow-hidden transition-all duration-500 group-hover:border-violet-500/50">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-[80px] group-hover:bg-violet-500/30 transition-all duration-500" />
                        <span className="text-7xl block mb-8 drop-shadow-2xl">🎨</span>
                        <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-[0.3em] bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-lg mb-4 inline-block">
                          Fase 3: Estructura
                        </span>
                        <h3 className="text-white text-4xl lg:text-5xl font-space-grotesk font-black mb-4 tracking-tighter uppercase group-hover:text-violet-400 transition-colors duration-300">
                          Diseño UX/UI Inmersivo
                        </h3>
                        <div className={\`transition-all duration-500 origin-top \${activeService === 2 ? 'opacity-100 max-h-[300px] mt-0' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}\`}>
                          <p className="text-gray-300 text-lg leading-relaxed mb-8 font-light tracking-wide">
                            Páginas y Landing Pages magnéticas. Diseñamos con un nivel visual obsesivo para retener la atención y forzar la conversión del usuario sin fricción.
                          </p>
                          <span className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 bg-violet-500/20 hover:bg-violet-600 py-3 px-6 rounded-full w-max transition-all group-hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                            Explorar <span className="material-symbols-outlined">east</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>

                  {/* Card 4: E-commerce */}
                  <motion.div style={{ y: y4, scale: scale4, opacity: opacity4, zIndex: 40 }} className="absolute w-full max-w-2xl">
                    <Link href="/servicios/ecommerce-interestelar" className="block group">
                      <div className="bg-[#0a201b]/80 backdrop-blur-3xl border border-white/10 p-10 lg:p-12 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.9)] relative overflow-hidden transition-all duration-500 group-hover:border-emerald-500/50">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] group-hover:bg-emerald-500/30 transition-all duration-500" />
                        <span className="text-7xl block mb-8 drop-shadow-2xl">🛒</span>
                        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-[0.3em] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg mb-4 inline-block">
                          Fase 4: Escalamiento
                        </span>
                        <h3 className="text-white text-4xl lg:text-5xl font-space-grotesk font-black mb-4 tracking-tighter uppercase group-hover:text-emerald-400 transition-colors duration-300">
                          E-commerce Interestelar
                        </h3>
                        <div className={\`transition-all duration-500 origin-top \${activeService === 3 ? 'opacity-100 max-h-[300px] mt-0' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}\`}>
                          <p className="text-gray-300 text-lg leading-relaxed mb-8 font-light tracking-wide">
                            Construimos tiendas online brutales. Checkouts sin caídas, logística integrada y pasarelas de pago globales para escalar tu marca a otro nivel.
                          </p>
                          <span className="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-600 py-3 px-6 rounded-full w-max transition-all group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                            Explorar <span className="material-symbols-outlined">east</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>

                </div>
              </div>
            </div>
          </div>

          <div className="block lg:hidden">
            {/* Mobile: Flow layout cards with entry animation */}
            <div className="container mx-auto px-6 py-16 space-y-12 relative z-10">
              <div className="text-left mb-12">
                <span className="text-rocket-orange font-mono text-[10px] uppercase tracking-[0.3em] block mb-3 bg-rocket-orange/10 border border-rocket-orange/20 px-3 py-1 rounded-full w-max">
                  Embudo RIFX
                </span>
                <h2 className="text-white text-4xl font-space-grotesk font-black uppercase tracking-tight leading-[0.9]">
                  Sistema de <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-rocket-orange to-yellow-400">Crecimiento</span>
                </h2>
              </div>

              {[
                { phase: "Fase 1: Tráfico", title: "Ads de Alta Velocidad", desc: "Campañas publicitarias optimizadas con IA en Meta y Google para captar leads masivos.", link: "/servicios/anuncios-de-alta-velocidad", emoji: "🚀", glow: "from-rocket-orange/20", border: "border-rocket-orange/30", text: "text-rocket-orange" },
                { phase: "Fase 2: Interacción", title: "Agentes IA WhatsApp", desc: "Automatización radical en tus chats. Agentes IA que responden y venden 24/7.", link: "/servicios/whatsapp-ai", emoji: "💬", glow: "from-blue-500/20", border: "border-blue-500/30", text: "text-blue-400" },
                { phase: "Fase 3: Estructura", title: "Diseño UX/UI", desc: "Landing Pages magnéticas y sitios web inmersivos de alta conversión.", link: "/servicios/diseno-web-inmersivo", emoji: "🎨", glow: "from-violet-500/20", border: "border-violet-500/30", text: "text-violet-400" },
                { phase: "Fase 4: Escalamiento", title: "E-commerce Interestelar", desc: "Tiendas online brutales con checkouts optimizados y logística automatizada.", link: "/servicios/ecommerce-interestelar", emoji: "🛒", glow: "from-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-400" },
              ].map((s, idx) => (
                <Link key={idx} href={s.link} className="block group">
                  <div className={\`p-8 rounded-3xl border \${s.border} bg-[#161e3d]/60 backdrop-blur-xl relative overflow-hidden\`}>
                    <div className={\`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl \${s.glow} to-transparent rounded-full blur-2xl\`} />
                    <span className="text-5xl block mb-4 relative z-10 drop-shadow-xl">{s.emoji}</span>
                    <span className={\`text-[10px] font-mono font-bold \${s.text} uppercase tracking-[0.2em] block mb-2\`}>{s.phase}</span>
                    <h3 className="text-white text-2xl font-space-grotesk font-black mb-3 uppercase tracking-tight">{s.title}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6 font-light">{s.desc}</p>
                    <span className={\`font-bold text-xs flex items-center gap-2 uppercase tracking-widest \${s.text}\`}>
                      Ver servicio <span className="material-symbols-outlined text-sm">east</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>`;
lines.splice(248, 202, newSection);
fs.writeFileSync(file, lines.join('\n'));
