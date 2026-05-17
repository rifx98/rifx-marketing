$file = "c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"

# --- REPLACEMENT 1: Replace style block (lines 821-893, 0-indexed 820-892) ---
$newStyles = @'
        <style>{`
          .hero-bg {
            background-color: #060918;
            background-image:
              radial-gradient(ellipse 80% 60% at 70% 50%, rgba(74,108,247,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 50% 40% at 60% 60%, rgba(147,51,234,0.06) 0%, transparent 70%);
            position: relative;
            overflow: hidden;
          }
          .hero-bg::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
            background-size: 60px 60px;
            pointer-events: none;
            z-index: 0;
          }
          .wave-container {
            position: absolute;
            top: 50%;
            right: -10%;
            transform: translateY(-50%);
            width: 70%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
          }
          .blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.3;
          }
          .blob-1 {
            width: 500px;
            height: 500px;
            background: linear-gradient(135deg, #4a6cf7, #7c3aed);
            top: 15%;
            right: 5%;
            animation: float 25s infinite alternate;
          }
          .blob-2 {
            width: 400px;
            height: 400px;
            background: linear-gradient(135deg, #06b6d4, #3b82f6);
            bottom: 15%;
            right: 25%;
            animation: float 20s infinite alternate-reverse;
          }
          @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -20px) scale(1.05); }
            100% { transform: translate(-20px, 30px) scale(0.95); }
          }
          .glass-input {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .glass-input:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(74, 108, 247, 0.5);
            outline: none;
            box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.1);
          }
          .logo-text {
            letter-spacing: 0.15em;
            font-weight: 800;
            font-family: 'Manrope', sans-serif;
          }
          .welcome-text {
            font-size: 4.5rem;
            line-height: 1;
            font-weight: 800;
            font-family: 'Manrope', sans-serif;
            letter-spacing: -0.02em;
            color: #ffffff;
          }
          .login-btn {
            background: linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .login-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 30px rgba(74, 108, 247, 0.3);
          }
          .login-btn:active { transform: scale(0.98); }
          .feature-pill {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
          }
        `}</style>
'@

# --- REPLACEMENT 2: Replace header + main section (lines 895-1047) ---
$newBody = @'
        {/* MainHeader */}
        <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <span className="logo-text text-base uppercase text-white">RIFX</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            <a className="hover:text-white transition-colors duration-300" href="#">Acerca de</a>
            <a className="hover:text-white transition-colors duration-300" href="#">Precios</a>
            <a className="hover:text-white transition-colors duration-300" href="#">Contacto</a>
          </nav>
        </header>

        <main className="h-full flex flex-col md:flex-row hero-bg">
          <div className="wave-container">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
          </div>

          {/* Left Login Panel */}
          <section className="relative z-10 w-full md:w-[420px] lg:w-[460px] h-full flex flex-col justify-center px-10 md:px-14 border-r border-white/[0.04]" style={{background: 'rgba(6,9,24,0.6)', backdropFilter: 'blur(40px)'}}>
            <div className="mb-10">
              <h2 className="text-2xl font-extrabold text-white mb-1" style={{fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.01em'}}>
                {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesion'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isRegistering ? 'Completa los datos para registrarte' : 'Ingresa tus credenciales para continuar'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {isRegistering && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Correo</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </span>
                    <input 
                      type="email" 
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                      placeholder="correo@ejemplo.com" 
                      required={isRegistering}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Usuario</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  </span>
                  <input 
                    type="text" 
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                    placeholder="admin" 
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Contrasena</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </span>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                    placeholder="Tu contrasena" 
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-600 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {loginError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-xs flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 py-2.5 rounded-xl"
                  >
                    <X className="w-3 h-3" /> {loginError}
                  </motion.p>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full py-3.5 login-btn text-white rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoggingIn ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isRegistering ? 'REGISTRARSE' : 'INGRESAR')}
              </button>

              <div className="flex items-center justify-between text-[10px] tracking-wider text-gray-500 uppercase pt-1">
                {!isRegistering ? (
                  <>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input type="checkbox" className="rounded-sm bg-transparent border-gray-700 text-brand-blue focus:ring-brand-blue/30 focus:ring-offset-0 w-3.5 h-3.5" />
                      <span className="group-hover:text-gray-300 transition-colors">Recordarme</span>
                    </label>
                    <a href="#" className="hover:text-gray-300 transition-colors">Recuperar acceso</a>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsRegistering(false)} className="hover:text-white transition-colors w-full text-center">
                    Ya tengo una cuenta
                  </button>
                )}
              </div>
            </form>

            <div className="mt-10 pt-6 border-t border-white/[0.04]">
              <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-wider">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                Conexion segura con cifrado de extremo a extremo
              </div>
            </div>
          </section>

          {/* Right Welcome Panel */}
          <section className="relative z-10 hidden md:flex flex-1 flex-col justify-center items-start px-16 lg:px-24">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-[2px] bg-brand-blue rounded-full"></div>
                <span className="text-brand-blue text-xs font-bold uppercase tracking-widest">Panel de Control</span>
              </div>
              <h1 className="welcome-text mb-6">Bienvenido.</h1>
              <p className="text-gray-400 leading-relaxed max-w-md text-base mb-10">
                Accede a tu centro de inteligencia. Gestiona conversaciones, analiza datos y controla tu asistente de IA desde un solo lugar.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                  Analytics en tiempo real
                </div>
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  CRM inteligente
                </div>
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  IA Avanzada
                </div>
              </div>
              <div className="text-sm text-gray-500">
                No tienes cuenta? <button type="button" onClick={() => setIsRegistering(true)} className="text-brand-blue font-semibold hover:text-white transition-colors">Registrate ahora</button>
              </div>
            </div>
          </section>

          <div className="md:hidden p-8 text-center text-xs text-gray-500 uppercase tracking-widest relative z-10 mt-auto">
            No tienes cuenta? <button type="button" onClick={() => setIsRegistering(true)} className="text-brand-blue font-semibold ml-1">Registrate</button>
          </div>
        </main>
'@

# Build new lines array
$before = $lines[0..819]     # lines 1-820
$after = $lines[1046..($lines.Length - 1)]  # lines 1048+

$newContent = ($before -join "`n") + "`n" + $newStyles + "`n`n" + $newBody + "`n" + ($after -join "`n")

[System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done! File updated successfully."
