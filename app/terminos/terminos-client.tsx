'use client';

import React from 'react';
import Image from 'next/image';

const sections = [
  { id: 'titular', title: '1. Titular del sitio' },
  { id: 'objeto', title: '2. Objeto y aceptación' },
  { id: 'servicios', title: '3. Servicios ofrecidos' },
  { id: 'condiciones-uso', title: '4. Condiciones de uso' },
  { id: 'cuentas-seguridad', title: '5. Cuentas y seguridad' },
  { id: 'propiedad-intelectual', title: '6. Propiedad intelectual' },
  { id: 'contenido-usuario', title: '7. Contenido publicado por el usuario' },
  { id: 'enlaces-terceros', title: '8. Enlaces a sitios de terceros' },
  { id: 'responsabilidad', title: '9. Limitación de responsabilidad' },
  { id: 'cancelacion', title: '10. Cancelación y modificación del servicio' },
  { id: 'legislacion', title: '11. Legislación aplicable y jurisdicción' },
  { id: 'cambios', title: '12. Modificaciones a este aviso' },
  { id: 'contacto', title: '13. Contacto' },
];

export default function TerminosClient() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes al-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .al-title { animation: al-fade-up 700ms cubic-bezier(0.16,1,0.3,1) both; }
        .al-subtitle { animation: al-fade-up 700ms cubic-bezier(0.16,1,0.3,1) 180ms both; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap" rel="stylesheet" />

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen" data-no-reveal>
        <main className="pt-24 pb-20">
          <section className="relative px-6 py-20 max-w-4xl mx-auto">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#f27121] blur-[150px] opacity-10 rounded-full"></div>
            <div className="absolute top-24 left-0 w-72 h-72 bg-[#5865f2] blur-[160px] opacity-[0.08] rounded-full"></div>

            <div className="al-title relative flex items-center gap-4 mb-6">
              <h1 className="text-4xl md:text-6xl text-white font-bold font-space uppercase leading-[1.05]">
                Aviso <br />Legal
              </h1>
              <Image
                src="/images/rifx-logo-particles-clean.png"
                alt="Rifx Marketing"
                width={220}
                height={220}
                className="w-28 h-28 md:w-48 md:h-48 object-contain shrink-0"
              />
            </div>
            <p className="al-subtitle text-slate-400 text-sm mb-10 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm leading-none text-slate-500">update</span>
              Última actualización: 11 de julio de 2026
            </p>

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
                Este Aviso Legal regula el acceso y uso del sitio web, el panel de control y las herramientas
                asociadas de Rifx Marketing ("nosotros", "nuestro" o "la plataforma"). Al navegar en nuestro
                sitio o utilizar nuestros servicios, aceptas los términos aquí descritos. Si no estás de acuerdo
                con ellos, te pedimos no utilizar la plataforma.
              </p>

              <section id="titular" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">1. Titular del sitio</h2>
                <p>
                  Este sitio web es operado por <strong>Rifx Marketing</strong>, agencia de marketing digital con
                  domicilio de contacto en Ecuador. Para cualquier consulta relacionada con la identidad del
                  titular o este aviso, puedes escribir a{' '}
                  <a href="mailto:ventas@franmotion.com" className="text-[#ffb692] hover:underline">ventas@franmotion.com</a>.
                </p>
              </section>

              <section id="objeto" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">2. Objeto y aceptación</h2>
                <p>
                  Rifx Marketing ofrece un sitio web informativo/comercial y una plataforma de panel de control
                  para la gestión de marketing digital. El acceso y uso de cualquiera de los dos implica la
                  aceptación plena de este Aviso Legal, de nuestra{' '}
                  <a href="/politica-privacidad" className="text-[#ffb692] hover:underline">Política de Privacidad</a>{' '}
                  y de cualquier condición particular aplicable al servicio contratado.
                </p>
              </section>

              <section id="servicios" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">3. Servicios ofrecidos</h2>
                <p>A través de la plataforma, Rifx Marketing presta los siguientes servicios:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Un asistente de ventas por WhatsApp impulsado por inteligencia artificial.</li>
                  <li>Gestión y automatización de campañas publicitarias en Meta Ads.</li>
                  <li>Publicación y programación automatizada de contenido en redes sociales.</li>
                  <li>Herramientas de CRM, gestión de citas y seguimiento de ventas.</li>
                  <li>Diseño web, e-commerce y otros servicios de marketing digital descritos en nuestra sección de Servicios.</li>
                </ul>
              </section>

              <section id="condiciones-uso" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">4. Condiciones de uso</h2>
                <p>
                  Te comprometes a usar la plataforma de forma lícita, sin infringir derechos de terceros y
                  cumpliendo las leyes locales aplicables a tu negocio, así como las políticas de la comunidad de
                  cada red social conectada (por ejemplo, las políticas comerciales de Meta o las directrices de
                  la comunidad de TikTok). Está prohibido utilizar la plataforma para enviar spam, contenido
                  fraudulento, difamatorio o que infrinja derechos de propiedad intelectual de terceros.
                </p>
              </section>

              <section id="cuentas-seguridad" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">5. Cuentas y seguridad</h2>
                <p>
                  Al conectar tus cuentas de redes sociales (por ejemplo, mediante OAuth de Facebook, Google o
                  TikTok), Rifx almacena tus credenciales de forma cifrada. Eres responsable de mantener la
                  confidencialidad de tu sesión y contraseña, y de notificarnos ante cualquier uso no autorizado
                  de tu cuenta.
                </p>
              </section>

              <section id="propiedad-intelectual" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">6. Propiedad intelectual</h2>
                <p>
                  El diseño, código, marca, logotipo y demás contenidos propios de este sitio y de la plataforma
                  Rifx Marketing son propiedad de Rifx Marketing o de sus licenciantes, y están protegidos por la
                  legislación de propiedad intelectual aplicable. Queda prohibida su reproducción, distribución o
                  modificación total o parcial sin autorización previa y por escrito.
                </p>
              </section>

              <section id="contenido-usuario" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">7. Contenido publicado por el usuario</h2>
                <p>
                  Conservas todos los derechos de propiedad y autoría sobre los videos, imágenes y textos que
                  subas a la plataforma. Rifx actúa únicamente como intermediario técnico para facilitar la
                  transferencia y distribución de ese contenido hacia tus cuentas vinculadas, y no reclama
                  ninguna titularidad sobre él.
                </p>
              </section>

              <section id="enlaces-terceros" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">8. Enlaces a sitios de terceros</h2>
                <p>
                  Nuestro sitio puede contener enlaces a plataformas de terceros (Meta, Google, TikTok, PayPhone,
                  entre otros). No somos responsables del contenido, políticas o prácticas de esos sitios; te
                  recomendamos revisar sus propios términos y políticas de privacidad.
                </p>
              </section>

              <section id="responsabilidad" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">9. Limitación de responsabilidad</h2>
                <p>
                  Rifx Marketing pone sus mejores esfuerzos para garantizar la disponibilidad y correcto
                  funcionamiento de la plataforma, pero no garantiza que el servicio sea ininterrumpido o esté
                  libre de errores, incluyendo eventuales interrupciones causadas por proveedores externos (Meta,
                  Google, TikTok, WhatsApp Business API, proveedores de infraestructura). En la medida permitida
                  por la ley, no seremos responsables por daños indirectos derivados del uso o la imposibilidad de
                  uso de la plataforma.
                </p>
              </section>

              <section id="cancelacion" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">10. Cancelación y modificación del servicio</h2>
                <p>
                  Nos reservamos el derecho de modificar, suspender o discontinuar cualquier funcionalidad del
                  servicio en cualquier momento. Nos comprometemos a notificar con antelación razonable cualquier
                  cambio sustancial que afecte el uso continuo de la plataforma.
                </p>
              </section>

              <section id="legislacion" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">11. Legislación aplicable y jurisdicción</h2>
                <p>
                  Este Aviso Legal se rige por las leyes de Ecuador. Para cualquier controversia derivada del uso
                  de la plataforma, las partes se someten a los jueces y tribunales competentes de Ecuador, salvo
                  que la ley aplicable disponga expresamente lo contrario.
                </p>
              </section>

              <section id="cambios" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">12. Modificaciones a este aviso</h2>
                <p>
                  Podemos actualizar este Aviso Legal periódicamente para reflejar cambios en nuestros servicios o
                  en la normativa aplicable. Publicaremos cualquier cambio en esta misma página junto con la fecha
                  de última actualización.
                </p>
              </section>

              <section id="contacto" className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-white uppercase font-space pt-2">13. Contacto</h2>
                <p>
                  Si tienes preguntas sobre este Aviso Legal, escríbenos a{' '}
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
