import React from 'react';

export default function PoliticaPrivacidad() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          Política de Privacidad
        </h1>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-200">1. Información que recopilamos</h2>
          <p className="text-gray-400 leading-relaxed">
            Cuando inicias sesión utilizando servicios de terceros como Google o Facebook, recopilamos información básica de tu perfil público que estos proveedores nos comparten. Esto incluye tu nombre, dirección de correo electrónico y foto de perfil.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-200">2. Uso de la información</h2>
          <p className="text-gray-400 leading-relaxed">
            Utilizamos la información recopilada exclusivamente para los siguientes propósitos:
          </p>
          <ul className="list-disc pl-6 text-gray-400 space-y-2">
            <li>Crear, autenticar y gestionar tu cuenta en nuestra plataforma.</li>
            <li>Personalizar y mejorar tu experiencia de usuario.</li>
            <li>Proveer el servicio que has solicitado.</li>
            <li>Comunicarnos contigo sobre actualizaciones de nuestro servicio o información relevante a tu cuenta.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-200">3. Protección de tus datos</h2>
          <p className="text-gray-400 leading-relaxed">
            Implementamos medidas de seguridad técnicas y organizativas para mantener segura tu información personal. No vendemos, alquilamos, intercambiamos ni transferimos a terceros tu información de identificación personal bajo ninguna circunstancia.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-200">4. Proveedores de Autenticación</h2>
          <p className="text-gray-400 leading-relaxed">
            Nuestra aplicación utiliza servicios de autenticación de terceros (OAuth). Al usar estos servicios, también estás sujeto a las políticas de privacidad del proveedor que elijas:
          </p>
          <ul className="list-disc pl-6 text-gray-400 space-y-2">
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Política de Privacidad de Google</a></li>
            <li><a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Política de Privacidad de Facebook (Meta)</a></li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-200">5. Tus derechos sobre tus datos</h2>
          <p className="text-gray-400 leading-relaxed">
            Tienes derecho a acceder, rectificar o solicitar la eliminación de tus datos personales almacenados en nuestra plataforma en cualquier momento. Si deseas eliminar tu cuenta o revocar el acceso a tus datos, puedes hacerlo contactándonos directamente.
          </p>
        </section>
        
        <div className="pt-10 border-t border-gray-800 text-sm text-gray-500">
          Última actualización: {new Date().toLocaleDateString('es-ES')}
        </div>
      </div>
    </div>
  );
}
