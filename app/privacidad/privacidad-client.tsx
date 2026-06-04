'use client';

import React from 'react';

export default function PrivacidadClient() {
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
               Política de <br /><span className="text-gradient">Privacidad</span>
             </h1>
             
             <div className="glass rounded-[2rem] p-8 md:p-12 space-y-6 text-slate-300 border-white/5 leading-relaxed text-sm">
               <p><strong>Última actualización:</strong> 3 de Junio de 2026</p>
               
               <p>En Rifx Marketing, valoramos la privacidad de nuestros usuarios y estamos comprometidos con la protección de sus datos personales. Esta Política de Privacidad describe cómo recopilamos, utilizamos y protegemos la información recopilada a través de nuestra plataforma y servicios.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">1. Datos Recopilados</h2>
               <p>Recopilamos información necesaria para la autenticación de usuarios (correo electrónico y contraseñas) y tokens de acceso OAuth proporcionados voluntariamente al vincular perfiles de terceros (Facebook, YouTube, TikTok). También guardamos de forma temporal los archivos de video e imágenes cargados para su procesamiento y publicación automatizada.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">2. Uso de la Información</h2>
               <p>Los datos y tokens OAuth se utilizan estrictamente para ejecutar las operaciones de publicación que usted ordene desde su panel de control. Los tokens de autenticación de TikTok, Facebook e Instagram se almacenan de manera fuertemente encriptada mediante algoritmos estándar (AES-256) en nuestros servidores y base de datos.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">3. Eliminación de Datos</h2>
               <p>Usted puede desconectar o borrar cualquier cuenta de red social vinculada en cualquier momento desde el panel de control de Rifx. Al hacerlo, el token se elimina permanentemente de nuestra base de datos. De igual manera, los archivos de video temporales subidos a nuestro almacenamiento se eliminan automáticamente del servidor una vez que finaliza su flujo de publicación.</p>
               
               <h2 className="text-xl font-bold text-white uppercase font-space pt-4">4. Enlaces a Servicios de Terceros</h2>
               <p>Nuestra plataforma interactúa con las APIs oficiales de TikTok, Facebook y Google YouTube. El uso de estas integraciones está sujeto a las Políticas de Privacidad de dichos servicios externos.</p>
             </div>
          </section>
        </main>
      </div>
    </>
  );
}
