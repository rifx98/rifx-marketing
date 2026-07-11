'use client';

import React from 'react';

const sections = [
  { id: 'quienes-somos', title: '1. Quiénes somos' },
  { id: 'datos-recopilados', title: '2. Información que recopilamos' },
  { id: 'uso-informacion', title: '3. Cómo usamos tu información' },
  { id: 'base-legal', title: '4. Base legal del tratamiento' },
  { id: 'con-quien-compartimos', title: '5. Con quién compartimos tu información' },
  { id: 'proveedores-terceros', title: '6. Proveedores de autenticación de terceros' },
  { id: 'seguridad', title: '7. Cómo protegemos tus datos' },
  { id: 'retencion', title: '8. Retención y eliminación de datos' },
  { id: 'derechos', title: '9. Tus derechos sobre tus datos' },
  { id: 'cookies', title: '10. Cookies y tecnologías de seguimiento' },
  { id: 'menores', title: '11. Privacidad de menores de edad' },
  { id: 'transferencias', title: '12. Transferencias internacionales' },
  { id: 'cambios', title: '13. Cambios a esta política' },
  { id: 'contacto', title: '14. Contacto' },
];

export default function PoliticaPrivacidadClient() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen">
        <main className="pt-24 pb-20">
          <section className="relative px-6 py-20 max-w-4xl mx-auto">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#f27121] blur-[150px] opacity-10 rounded-full"></div>

            <h1 className="text-4xl md:text-6xl text-white mb-6 font-bold font-space uppercase">
              Política de <br /><span className="text-gradient">Privacidad</span>
            </h1>
            <p className="text-slate-400 text-sm mb-10">Última actualización: 10 de julio de 2026</p>

            {/* Tabla de contenidos */}
            <nav className="glass rounded-2xl p-6 md:p-8 mb-8 border-white/5">
              <h2 className="text-sm font-bold text-white uppercase font-space mb-4 tracking-widest">Contenido</h2>
              <ul className="grid sm:grid-cols-2 gap-2">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-slate-400 hover:text-[#f27121] transition-colors text-sm">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="glass rounded-[2rem] p-8 md:p-12 space-y-10 text-slate-300 border-white/5 leading-relaxed text-sm">

              <p>
                En Rifx Marketing ("nosotros", "nuestro" o "la plataforma") respetamos tu privacidad y nos
                comprometemos a proteger los datos personales que recopilamos a través de nuestro sitio web,
                nuestro panel de control y las integraciones asociadas (incluyendo WhatsApp Business API, Meta
                Graph API, Google APIs y TikTok API). Esta Política de Privacidad explica qué información
                recopilamos, por qué la recopilamos, cómo la usamos y protegemos, y qué derechos tienes sobre
                ella.
              </p>

              <section id="quienes-somos" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">1. Quiénes somos</h2>
                <p>
                  Rifx Marketing es una plataforma de marketing digital que ofrece un panel de control con un
                  asistente de ventas por WhatsApp impulsado por IA, gestión de campañas publicitarias en Meta
                  Ads, publicación automatizada en redes sociales y herramientas de CRM para negocios. Si tienes
                  dudas sobre esta política, puedes contactarnos usando los datos de la sección 14.
                </p>
              </section>

              <section id="datos-recopilados" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">2. Información que recopilamos</h2>
                <p>Recopilamos distintos tipos de información dependiendo de cómo usas la plataforma:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña (almacenada siempre cifrada, nunca en texto plano) al registrarte.</li>
                  <li><strong>Inicio de sesión con terceros:</strong> si usas Google o Facebook para iniciar sesión, recibimos tu nombre, correo y foto de perfil pública que ese proveedor comparte con nosotros.</li>
                  <li><strong>Tokens de integración OAuth:</strong> al conectar cuentas de Meta (Facebook/Instagram), Google (YouTube, Google Calendar) o TikTok desde tu panel, almacenamos de forma cifrada los tokens de acceso necesarios para publicar contenido o gestionar tus anuncios en tu nombre.</li>
                  <li><strong>Conversaciones de WhatsApp:</strong> números de teléfono, nombres de contacto y el contenido de las conversaciones que tus clientes tienen con tu asistente de WhatsApp, para poder brindar el servicio de atención automatizada y CRM.</li>
                  <li><strong>Datos comerciales:</strong> citas agendadas, registros de ventas y pagos asociados a tu cuenta.</li>
                  <li><strong>Información de pago:</strong> al procesar cobros a través de pasarelas como PayPhone, cierta información de facturación es gestionada directamente por el proveedor de pagos; no almacenamos números de tarjeta completos en nuestros servidores.</li>
                  <li><strong>Datos de uso y analítica:</strong> utilizamos Vercel Analytics para entender el tráfico agregado de nuestro sitio (páginas vistas, país aproximado, dispositivo). Esta herramienta no usa cookies ni identifica visitantes individuales.</li>
                </ul>
              </section>

              <section id="uso-informacion" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">3. Cómo usamos tu información</h2>
                <p>Usamos la información recopilada exclusivamente para:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Crear, autenticar y administrar tu cuenta en la plataforma.</li>
                  <li>Operar el asistente de WhatsApp impulsado por IA y tu panel de CRM.</li>
                  <li>Ejecutar las publicaciones, campañas publicitarias y automatizaciones que tú ordenas desde tu panel.</li>
                  <li>Procesar pagos y gestionar tu plan de suscripción.</li>
                  <li>Enviarte notificaciones operativas sobre tu cuenta o el servicio.</li>
                  <li>Detectar y prevenir fraude, abuso o accesos no autorizados.</li>
                  <li>Mejorar el rendimiento y la estabilidad de la plataforma mediante analítica agregada y anónima.</li>
                </ul>
              </section>

              <section id="base-legal" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">4. Base legal del tratamiento</h2>
                <p>
                  Tratamos tus datos personales porque es necesario para ejecutar el contrato de servicio que
                  aceptas al registrarte, porque tienes un interés legítimo en que tu asistente de WhatsApp y
                  tus campañas funcionen correctamente, porque nos das tu consentimiento explícito al conectar
                  una cuenta de terceros (OAuth), o porque debemos cumplir con obligaciones legales aplicables
                  (por ejemplo, en materia fiscal o de facturación).
                </p>
              </section>

              <section id="con-quien-compartimos" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">5. Con quién compartimos tu información</h2>
                <p>
                  No vendemos, alquilamos ni intercambiamos tu información personal con terceros para fines
                  publicitarios. Solo compartimos datos con los proveedores estrictamente necesarios para operar
                  el servicio que solicitas, entre ellos:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Supabase</strong> (base de datos y almacenamiento).</li>
                  <li><strong>Vercel</strong> (hospedaje, funciones del servidor y analítica).</li>
                  <li><strong>Meta (Facebook/Instagram/WhatsApp)</strong>, <strong>Google</strong> y <strong>TikTok</strong>, únicamente cuando tú conectas esas cuentas para publicar contenido o gestionar anuncios.</li>
                  <li><strong>PayPhone</strong>, para el procesamiento de pagos.</li>
                  <li><strong>OpenAI / Groq / Google Gemini</strong>, como proveedores del modelo de inteligencia artificial que redacta las respuestas de tu asistente de WhatsApp.</li>
                </ul>
                <p>Solo divulgaríamos información adicional si la ley nos obliga a hacerlo.</p>
              </section>

              <section id="proveedores-terceros" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">6. Proveedores de autenticación de terceros</h2>
                <p>
                  Al iniciar sesión o conectar una cuenta mediante OAuth, también quedas sujeto a la política de
                  privacidad del proveedor que elijas:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-[#ffb692] hover:underline">Política de Privacidad de Google</a></li>
                  <li><a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer" className="text-[#ffb692] hover:underline">Política de Privacidad de Meta (Facebook/Instagram/WhatsApp)</a></li>
                  <li><a href="https://www.tiktok.com/legal/page/row/privacy-policy/es" target="_blank" rel="noreferrer" className="text-[#ffb692] hover:underline">Política de Privacidad de TikTok</a></li>
                </ul>
              </section>

              <section id="seguridad" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">7. Cómo protegemos tus datos</h2>
                <p>
                  Aplicamos medidas técnicas y organizativas para proteger tu información: las contraseñas se
                  almacenan con hashing criptográfico (nunca en texto plano), los tokens de acceso a redes
                  sociales se guardan cifrados, y el acceso a la base de datos está restringido mediante
                  controles de seguridad a nivel de fila (Row Level Security), de forma que solo nuestros
                  servidores autorizados pueden leer o modificar tu información.
                </p>
              </section>

              <section id="retencion" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">8. Retención y eliminación de datos</h2>
                <p>
                  Conservamos tu información mientras tu cuenta esté activa y sea necesaria para prestarte el
                  servicio. Puedes desconectar cualquier cuenta de redes sociales vinculada en cualquier momento
                  desde tu panel de control; al hacerlo, el token correspondiente se elimina de forma permanente
                  de nuestra base de datos. Si solicitas el cierre de tu cuenta, eliminamos o anonimizamos tus
                  datos personales dentro de un plazo razonable, salvo que debamos conservar cierta información
                  por obligaciones legales o contables.
                </p>
              </section>

              <section id="derechos" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">9. Tus derechos sobre tus datos</h2>
                <p>En relación con tus datos personales, tienes derecho a:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Acceder</strong> a la información que tenemos sobre ti.</li>
                  <li><strong>Rectificar</strong> datos inexactos o incompletos.</li>
                  <li><strong>Solicitar la eliminación</strong> de tu cuenta y datos personales.</li>
                  <li><strong>Revocar tu consentimiento</strong> a integraciones OAuth en cualquier momento.</li>
                  <li><strong>Solicitar una copia</strong> de tus datos en un formato portable.</li>
                </ul>
                <p>Para ejercer cualquiera de estos derechos, contáctanos usando los datos de la sección 14.</p>
              </section>

              <section id="cookies" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">10. Cookies y tecnologías de seguimiento</h2>
                <p>
                  Nuestro sitio público utiliza <strong>Vercel Analytics</strong>, una herramienta de analítica que
                  no utiliza cookies ni almacena identificadores individuales en tu navegador — solo agrega datos
                  estadísticos de tráfico. El panel de control utiliza almacenamiento local del navegador
                  (localStorage) únicamente para mantener tu sesión iniciada y tus preferencias de interfaz; no
                  se usa con fines publicitarios ni de rastreo entre sitios.
                </p>
              </section>

              <section id="menores" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">11. Privacidad de menores de edad</h2>
                <p>
                  Nuestros servicios están dirigidos a negocios y personas mayores de 18 años. No recopilamos
                  intencionalmente información de menores de edad. Si tienes conocimiento de que un menor nos ha
                  proporcionado datos personales, contáctanos para eliminarlos.
                </p>
              </section>

              <section id="transferencias" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">12. Transferencias internacionales</h2>
                <p>
                  Nuestros proveedores de infraestructura (Supabase, Vercel) pueden procesar y almacenar datos en
                  servidores ubicados fuera de tu país de residencia. En todos los casos, exigimos que estos
                  proveedores mantengan estándares de seguridad adecuados para proteger tu información.
                </p>
              </section>

              <section id="cambios" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">13. Cambios a esta política</h2>
                <p>
                  Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en el
                  servicio o en la normativa aplicable. Publicaremos cualquier cambio en esta misma página junto
                  con la fecha de última actualización.
                </p>
              </section>

              <section id="contacto" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">14. Contacto</h2>
                <p>
                  Si tienes preguntas sobre esta Política de Privacidad o quieres ejercer tus derechos sobre tus
                  datos personales, escríbenos a{' '}
                  <a href="mailto:ventas@franmotion.com" className="text-[#ffb692] hover:underline">ventas@franmotion.com</a>{' '}
                  o llámanos al{' '}
                  <a href="tel:+593983910712" className="text-[#ffb692] hover:underline">+593 98 391 0712</a>.
                </p>
              </section>

            </div>
          </section>
        </main>
      </div>
    </>
  );
}
