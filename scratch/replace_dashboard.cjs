const fs = require('fs');
const path = require('path');
const f = path.join(process.cwd(), 'app', 'panel', 'panel-client.tsx');
const lines = fs.readFileSync(f, 'utf8').split('\n');

// Dashboard starts at line 1463 (0-indexed: 1462), ends at line 1722 (0-indexed: 1721)
const dashStart = 1462; // {activeTab === 'dashboard' && (
const dashEnd = 1721;   // )}

const newDashboard = `        {activeTab === 'dashboard' && (
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
                    <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                      <div className="space-y-4">
                        <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Nuevo</span>
                        <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
                          \\u00a1Ya est\\u00e1 disponible la nueva <span className="text-primary-container">Academia Chatea Pro V2!</span>
                        </h2>
                        <p className="text-slate-700 text-lg">Aprende a manejar la herramienta <span className="font-bold underline decoration-primary-container">como un experto</span></p>
                        <p className="text-slate-600 text-sm">domina las automatizaciones y lleva tus ventas y entregas <strong>al siguiente nivel</strong></p>
                        <div className="mt-2">
                          <p className="text-slate-500 text-sm">Todo lo que necesitas para</p>
                          <p className="text-2xl font-black text-slate-900">vender m\\u00e1s</p>
                          <p className="text-slate-500 text-sm">entregar mejor y escalar sin l\\u00edmites</p>
                        </div>
                      </div>
                      <div className="mt-auto pt-6">
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
                  {/* Plan Info Bar */}
                  <div className="px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-primary-container to-blue-600">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-1.5 rounded">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <div className="text-xs text-white">
                          <p className="font-semibold">Plan actual</p>
                          <p className="text-white/80">Prueba gratuita (14 d\\u00edas)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right text-white">
                          <p className="text-lg font-bold leading-none">14 / <span className="font-normal opacity-70">14</span></p>
                          <p className="text-[10px] uppercase tracking-tight opacity-70">d\\u00edas usados</p>
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{width: '100%'}}></div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-white/70">La prueba gratis te expira el 28 feb 2026 \\u00b7 <span className="underline cursor-pointer hover:text-white">Ver planes</span></p>
                      <div className="flex gap-2">
                        <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">1/200</div>
                        <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">1/1</div>
                        <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">M 1/1</div>
                        <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">0/1.0 GB</div>
                      </div>
                    </div>
                  </div>
                  {/* Expert Cards */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      {name:'Experta en ventas por WhatsApp', img:'AB6AXuDWSe1_L4wZI5vciZ440fFRXGRX_Jy9mCsJqKWeDk4HE-Ljl3Gu1E5Pv7_L5NcYJqr2ETTpZFeExyCE2XypIEK2vjXJ0SCDYSJq2e6JfyCMI1LiPfaGw-Rc7j5TAylDR9nwUkBTwNbCNVnfE-Vc3MP-d0zr9TEtqCyQ8oWyL8YTEdNqstELBp_-riW1gRIx0nsqFnvVXus0zVvMi-eEMcgGTj2vSQ5OntWsKkBqzkLYJ0jOJrd9yO6AC96gavZF11KkwhvPXDVE5YNa', online:true},
                      {name:'Experto en log\\u00edstica', img:'AB6AXuBarYnXjTbS-YJFpfnLAYCtwnxMj4ecyo7lrGhGhkFAUtOluIPILBVpU9s63y6cW4s4lP4roXHMufp8eRBhm9RUVHPxC3cg8rWAbH5PnPjYIn_DSTgbolwSjPY1h_8tkVvEHCoOA7w0CWds5V9KapKNkkL2WPLYK_nhweD_by8E8fCUJRTw51XISU4En28JsnHZJRL9c262ihr6zZc44qvxfM0aPZbmQkEHOHvu_FgXciisI5QLgbr7Fn3B3Lb4oKTrGQeoaDrxd3ns', online:true},
                      {name:'Especialista en recuperar carritos', img:'AB6AXuDw1TVF3SLRu-VMyIJGiH1m5ts4tKm4LYiPHm4oxOyzu3eZ_T6mp7gbMK1PN5IaC9_tDFYa3xZJoovjUvZg8iCJMP_kOlN5-m9zgjdYRo-U3LC3iIN38ckThN3YvkwB2ufNpLclTsPRElladsSOymDJYSApwZt1bcyG9Y4l_O17x3T0dcXG6tAXzDx21fulMb7Ife5-VDGCD7DiKXVMZBDR1EV7e-RLU_uKmpb4mA_pBVEcgwJ6bYZ_P0KPerwVqyi0AC1o6aH42daD', online:true},
                      {name:'Mediadora de comentarios', img:'AB6AXuC1YTh3EdBAV_bv7N9aDXXB4YN4CgT4dUWwGTMvsPQesCRs_6YrPjx0uQKlZaivH1UYEwHBjzm6RR8Z2yImFDqmeDTukmPil6BBLbJzstpdCzuXxpsSk6GxYtJ4ak2QExlzDvVUEtlXnYtSq_qHXrhHTEo732Sm8qtAxRNcl_xxYh7WQ1zHQsDR6eXrqLTR4bNRzDvRw90ND0ODSVcSrkaliCv_GTtiJ9v0CUnnM_9_xwIhh-1bxMhpg9ymyIw4DaUREtW32ruDnX7J', online:true},
                    ].map((expert, i) => (
                      <div key={i} className="bg-crm-surface-container-low border border-slate-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow group">
                        <div className="relative w-20 h-20 mx-auto mb-4">
                          <img alt={expert.name} className="rounded-full w-full h-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" src={\`https://lh3.googleusercontent.com/aida-public/\${expert.img}\`} />
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
                      <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd"></path></svg>
                      <span className="text-sm font-semibold">Te faltan 4 expertos para optimizar tu flujo</span>
                    </div>
                    <button onClick={() => setActiveTab('billing')} className="bg-primary-container text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary-container/90 shadow-sm transition-all flex items-center gap-2">
                      Completar
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </button>
                  </div>
                </div>

                {/* Bottom two cards row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Actualizaciones */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] overflow-hidden">
                    <div className="bg-orange-500 p-4 flex justify-between items-center text-white rounded-t-2xl">
                      <div>
                        <h3 className="font-bold text-lg leading-none">Actualizaciones</h3>
                        <p className="text-xs text-white/80 mt-1">Nuevas funciones disponibles</p>
                      </div>
                      <div className="relative">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        <span className="absolute -top-1 -right-1 bg-white text-orange-500 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">4</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Video soluci\\u00f3n</span>
                          <span className="text-[10px] text-slate-400 font-medium">10 mar 2026</span>
                        </div>
                        <h5 className="text-sm font-bold text-slate-800 mb-1">Video instructivo para solucionar el error del m\\u00e9todo de pago en Meta</h5>
                        <p className="text-xs text-slate-600">La soluci\\u00f3n para añadir el m\\u00e9todo de pago a nivel del BM. A continuaci\\u00f3n el paso a paso...</p>
                      </div>
                      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Nuevo</span>
                          <span className="text-[10px] text-slate-400 font-medium">20 ene 2026</span>
                        </div>
                        <h5 className="text-sm font-bold text-slate-800 mb-1">Nuevo panel de notificaciones de ventas</h5>
                        <p className="text-xs text-slate-600">Recibe alertas autom\\u00e1ticas en WhatsApp cuando se complete una venta o surja una novedad importante.</p>
                      </div>
                    </div>
                  </div>

                  {/* Capacitaciones */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] overflow-hidden">
                    <div className="bg-primary-container p-4 flex justify-between items-center text-white rounded-t-2xl">
                      <div>
                        <h3 className="font-bold text-lg leading-none">Capacitaciones</h3>
                        <p className="text-xs text-white/80 mt-1">Pr\\u00f3ximas sesiones importantes</p>
                      </div>
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                      <div className="border border-blue-100 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                        <h5 className="text-sm font-bold text-slate-800 mb-2">Primeros pasos de Chatea PRO</h5>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">calendar_today</span><span>Todos los d\\u00edas de lunes a viernes</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">schedule</span><span>03:00 p.m.</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">timer</span><span>Dura: 60 min</span></div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <span className="material-symbols-outlined text-xs">open_in_new</span></button>
                        </div>
                      </div>
                      <div className="border border-blue-100 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                        <h5 className="text-sm font-bold text-slate-800 mb-2">Preguntas y respuestas con Chatea PRO</h5>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">calendar_today</span><span>Todos los d\\u00edas de lunes a viernes</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">schedule</span><span>03:30 p.m.</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">timer</span><span>Dura: 50 min</span></div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <span className="material-symbols-outlined text-xs">open_in_new</span></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}`;

// Replace lines
const before = lines.slice(0, dashStart);
const after = lines.slice(dashEnd + 1);
const result = [...before, ...newDashboard.split('\n'), ...after].join('\n');
fs.writeFileSync(f, result);
console.log('Dashboard replaced! New total lines:', result.split('\n').length);
