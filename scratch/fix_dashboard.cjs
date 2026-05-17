const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'app', 'panel', 'panel-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Step 1: Replace dashboard tab (lines 597-701, 0-indexed 596-700)
const dashboardNew = `            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* MainContent Grid */}
                <div className="grid grid-cols-12 gap-6">
                  {/* LeftPromoBanner */}
                  <section className="col-span-12 lg:col-span-3">
                    <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 h-full min-h-[600px] flex flex-col">
                      <div className="h-full w-full relative bg-cover bg-center" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkFYKNPmbOfDrJR4jvreG_YAPMRT6PP7fnlw6HOCUOsp_07W4lfKECuFOFvYiQimv7oQJVF3mJFDgl7qUROOStziAkQTW2x3ZNFDZTJ5KivlAzS3pz7t66XaKXadK_n4asnSMe75p9QXMAYGkOYs9xPZqK9gDhBsv6Qg306ADaOTsis2-EkWk5jOiHvptmIGfd0_hVGXOEAWX-UQBCgUEBk0tIGZ3jzifT5-w-vUw8XGQmVYsOckh8gwz9K7Yxy9TQWdIpelgZRWGz')", backgroundPosition: 'left center'}}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent lg:hidden"></div>
                        <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                          <div className="space-y-4">
                            <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Nuevo</span>
                            <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
                              \\u00a1Ya est\\u00e1 disponible la nueva <span className="text-primary-container">Academia Chatea Pro V2!</span>
                            </h2>
                            <p className="text-slate-700 text-lg">Aprende a manejar la herramienta <span className="font-bold underline decoration-primary-container">como un experto</span>.</p>
                          </div>
                          <div className="mt-auto">
                            <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                              Ir a la academia
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" fillRule="evenodd"></path></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* RightDashboardArea */}
                  <section className="col-span-12 lg:col-span-9 space-y-6">
                    {/* ExpertTeamSection */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="bg-primary-container p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-none">Equipo de Expertos IA</h3>
                            <p className="text-xs text-white/80 mt-1">0 de 4 expertos activos</p>
                          </div>
                        </div>
                      </div>
                      {/* Plan Info Bar */}
                      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary-container/20 text-primary-container p-1.5 rounded">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold text-slate-600">Plan actual</p>
                            <p className="text-primary-container">Prueba gratuita (14 d\\u00edas)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-800 leading-none">14 / <span className="text-slate-400 font-normal">14</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-tight">d\\u00edas usados</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-primary-container/10 px-2 py-1 rounded text-[10px] font-bold text-primary-container border border-primary-container/20">1/200</div>
                            <div className="bg-green-50 px-2 py-1 rounded text-[10px] font-bold text-green-600 border border-green-100">1/1</div>
                            <div className="bg-orange-50 px-2 py-1 rounded text-[10px] font-bold text-orange-600 border border-orange-100">0/1.0 GB</div>
                          </div>
                        </div>
                      </div>
                      {/* Expert Cards */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                          {name:'Experta en ventas WhatsApp', img:'AB6AXuDWSe1_L4wZI5vciZ440fFRXGRX_Jy9mCsJqKWeDk4HE-Ljl3Gu1E5Pv7_L5NcYJqr2ETTpZFeExyCE2XypIEK2vjXJ0SCDYSJq2e6JfyCMI1LiPfaGw-Rc7j5TAylDR9nwUkBTwNbCNVnfE-Vc3MP-d0zr9TEtqCyQ8oWyL8YTEdNqstELBp_-riW1gRIx0nsqFnvVXus0zVvMi-eEMcgGTj2vSQ5OntWsKkBqzkLYJ0jOJrd9yO6AC96gavZF11KkwhvPXDVE5YNa', online:true},
                          {name:'Experto en log\\u00edstica', img:'AB6AXuBarYnXjTbS-YJFpfnLAYCtwnxMj4ecyo7lrGhGhkFAUtOluIPILBVpU9s63y6cW4s4lP4roXHMufp8eRBhm9RUVHPxC3cg8rWAbH5PnPjYIn_DSTgbolwSjPY1h_8tkVvEHCoOA7w0CWds5V9KapKNkkL2WPLYK_nhweD_by8E8fCUJRTw51XISU4En28JsnHZJRL9c262ihr6zZc44qvxfM0aPZbmQkEHOHvu_FgXciisI5QLgbr7Fn3B3Lb4oKTrGQeoaDrxd3ns', online:false},
                          {name:'Especialista en carritos', img:'AB6AXuDw1TVF3SLRu-VMyIJGiH1m5ts4tKm4LYiPHm4oxOyzu3eZ_T6mp7gbMK1PN5IaC9_tDFYa3xZJoovjUvZg8iCJMP_kOlN5-m9zgjdYRo-U3LC3iIN38ckThN3YvkwB2ufNpLclTsPRElladsSOymDJYSApwZt1bcyG9Y4l_O17x3T0dcXG6tAXzDx21fulMb7Ife5-VDGCD7DiKXVMZBDR1EV7e-RLU_uKmpb4mA_pBVEcgwJ6bYZ_P0KPerwVqyi0AC1o6aH42daD', online:true},
                          {name:'Mediadora de comentarios', img:'AB6AXuC1YTh3EdBAV_bv7N9aDXXB4YN4CgT4dUWwGTMvsPQesCRs_6YrPjx0uQKlZaivH1UYEwHBjzm6RR8Z2yImFDqmeDTukmPil6BBLbJzstpdCzuXxpsSk6GxYtJ4ak2QExlzDvVUEtlXnYtSq_qHXrhHTEo732Sm8qtAxRNcl_xxYh7WQ1zHQsDR6eXrqLTR4bNRzDvRw90ND0ODSVcSrkaliCv_GTtiJ9v0CUnnM_9_xwIhh-1bxMhpg9ymyIw4DaUREtW32ruDnX7J', online:true},
                        ].map((expert, i) => (
                          <div key={i} className="bg-crm-surface-container-low border border-slate-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                            <div className="relative w-20 h-20 mx-auto mb-4">
                              <img alt={expert.name} className="rounded-full w-full h-full object-cover border-2 border-white shadow-sm" src={\`https://lh3.googleusercontent.com/aida-public/\${expert.img}\`} />
                              <span className={\`absolute bottom-1 right-1 w-4 h-4 \${expert.online ? 'bg-green-500' : 'bg-slate-300'} border-2 border-white rounded-full\`}></span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{expert.name}</h4>
                            <p className={\`text-xs font-medium mt-1 \${expert.online ? 'text-primary-container' : 'text-slate-400'}\`}>{expert.online ? 'Disponible' : 'Desconectado'}</p>
                          </div>
                        ))}
                      </div>
                      {/* CTA Bar */}
                      <div className="bg-primary-container/5 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-primary">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd"></path></svg>
                          <span className="text-sm font-semibold">Te faltan 4 expertos para optimizar tu flujo</span>
                        </div>
                        <button className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center gap-2">
                          Completar equipo
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Updates */}
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                        <div className="bg-secondary p-4 flex justify-between items-center text-white rounded-t-2xl">
                          <div>
                            <h3 className="font-bold text-lg leading-none">Actualizaciones</h3>
                            <p className="text-xs text-white/70 mt-1">Nuevas funciones disponibles</p>
                          </div>
                          <div className="relative">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <span className="absolute -top-1 -right-1 bg-white text-secondary text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">4</span>
                          </div>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                          <div className="border border-secondary/20 bg-secondary/5 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase">Video soluci\\u00f3n</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase">30 ene 2026</span>
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Error de m\\u00e9todo de pago en Meta</h5>
                            <p className="text-xs text-slate-600">Hemos publicado un video instructivo para solucionar el error com\\u00fan de validaci\\u00f3n de tarjetas...</p>
                          </div>
                          <div className="border border-secondary/20 bg-secondary/5 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase">Nuevo</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase">20 ene 2026</span>
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Panel de notificaciones de ventas</h5>
                            <p className="text-xs text-slate-600">Recibe alertas autom\\u00e1ticas en tiempo real cada vez que un cliente complete un pago.</p>
                          </div>
                        </div>
                      </div>

                      {/* Trainings */}
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                        <div className="bg-primary-container p-4 flex justify-between items-center text-white rounded-t-2xl">
                          <div>
                            <h3 className="font-bold text-lg leading-none">Capacitaciones</h3>
                            <p className="text-xs text-white/70 mt-1">Pr\\u00f3ximas sesiones importantes</p>
                          </div>
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                          <div className="border border-primary-container/10 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                            <h5 className="text-sm font-bold text-slate-800 mb-2">Primeros pasos de Chatea PRO</h5>
                            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>Lunes a Viernes</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>03:00 p.m. \\u2022 60 min</span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></button>
                            </div>
                          </div>
                          <div className="border border-primary-container/10 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                            <h5 className="text-sm font-bold text-slate-800 mb-2">Preguntas y respuestas con soporte</h5>
                            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>Martes y Jueves</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>04:30 p.m. \\u2022 45 min</span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            )}`;

// Replace lines 597-701 (0-indexed 596-700)
lines.splice(596, 105, dashboardNew);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Dashboard replaced successfully! Lines:', lines.length);
