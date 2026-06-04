'use client';

import React from 'react';

export default function TerminosClient() {
  return (
    <>
      <style jsx global>{`
        body { font-family: 'Montserrat', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .selection-orange::selection { background-color: #f27121; color: white; }
        .glass { background: rgba(24, 30, 54, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .text-gradient { background: linear-gradient(to right, #ffb692, #f27121); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      <div className="bg-[#0b1229] text-[#dce1ff] selection-orange antialiased overflow-x-hidden min-h-screen">
        <main className="pt-24 pb-20">
          <section className="relative px-6 py-20 max-w-4xl mx-auto">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#f27121] blur-[150px] opacity-10 rounded-full"></div>
             
             <h1 className="text-4xl md:text-6xl text-white mb-6 font-bold font-space uppercase">
               Términos de <br /><span className="text-gradient">Servicio</span>
             </h1>
             
             <div className="glass rounded-[2rem] p-8 md:p-12 space-y-6 text-slate-300 border-white/5 leading-relaxed text-sm">
               <p><strong>Última actualización:</strong> 3 de Junio de 2026</p>
               
               <p>Bienvenido a Rifx Marketing. Al acceder o utilizar nuestro sitio web, panel de control y herramientas asociadas (incluyendo integraciones como la API de TikTok), usted acepta estar sujeto a estos Términos de Servicio de manera legal.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">1. Uso del Servicio</h2>
               <p>Rifx Marketing proporciona herramientas de automatización de marketing y distribución de contenido de video para múltiples redes sociales. Usted es responsable de garantizar que todo el contenido publicado a través de nuestra plataforma cumpla con las leyes locales y las políticas de la comunidad de cada red social respectiva (por ejemplo, las directrices de la comunidad de TikTok).</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">2. Cuentas y Seguridad</h2>
               <p>Al conectar sus cuentas de redes sociales (por ejemplo, mediante OAuth de Facebook, YouTube o TikTok), Rifx almacena sus credenciales en forma cifrada. Usted es responsable de mantener la seguridad de su sesión de usuario y contraseña.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">3. Propiedad del Contenido</h2>
               <p>Usted conserva todos los derechos de propiedad y autor sobre los videos o textos que suba a nuestra plataforma. Rifx actúa únicamente como un intermediario técnico para facilitar la transferencia y distribución a sus cuentas vinculadas.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">4. Cancelación y Modificación</h2>
               <p>Nos reservamos el derecho de modificar o suspender el servicio en cualquier momento. Nos comprometemos a notificar con antelación razonable cualquier cambio sustancial que afecte el uso continuo de la plataforma.</p>
             </div>
          </section>
        </main>
      </div>
    </>
  );
}
