'use client';

import { useState } from 'react';
import { Mail, Phone, ArrowLeft } from 'lucide-react';
import { AuthComponent } from '@/components/ui/sign-up';
import PhoneAuthForm from '@/components/PhoneAuthForm';

interface AuthSelectorProps {
  mode: 'login' | 'register';
  logo?: React.ReactNode;
  onLogin?: (email: string, password: string) => Promise<void>;
  onRegister?: (email: string, password: string, acceptedTerms: boolean) => Promise<void>;
  onSwitchToRegister?: () => void;
  onSwitchToLogin?: () => void;
  externalError?: string;
  onGoogleClick?: () => void;
  googleInitNode?: React.ReactNode;
}

export default function AuthSelector({
  mode,
  logo,
  onLogin,
  onRegister,
  onSwitchToRegister,
  onSwitchToLogin,
  externalError,
  onGoogleClick,
  googleInitNode,
}: AuthSelectorProps) {
  const [authMethod, setAuthMethod] = useState<'select' | 'email' | 'phone'>('select');

  // Selection screen
  if (authMethod === 'select') {
    return (
      <div className="min-h-screen w-full bg-[#060918] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {logo && <div className="flex justify-center mb-4">{logo}</div>}
            <h1 className="text-3xl font-bold text-white mb-2">
              {mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
            </h1>
            <p className="text-gray-400">
              Elige cómo deseas {mode === 'register' ? 'registrarte' : 'iniciar sesión'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Email/Password Option */}
            <button
              onClick={() => setAuthMethod('email')}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-[#4a6cf7] to-[#7c3aed] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-white font-semibold mb-1">Email y contraseña</h3>
                  <p className="text-gray-400 text-sm">
                    Usa tu correo electrónico
                  </p>
                </div>
              </div>
            </button>

            {/* Phone Option */}
            <button
              onClick={() => setAuthMethod('phone')}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-6 hover:border-white/20 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-white font-semibold mb-1">Número de teléfono</h3>
                  <p className="text-gray-400 text-sm">
                    Recibe un código por SMS
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Switch between login/register */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {mode === 'register' ? (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={onSwitchToLogin}
                    className="text-[#4a6cf7] hover:underline font-medium"
                  >
                    Inicia sesión
                  </button>
                </>
              ) : (
                <>
                  ¿No tienes cuenta?{' '}
                  <button
                    onClick={onSwitchToRegister}
                    className="text-[#4a6cf7] hover:underline font-medium"
                  >
                    Regístrate
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Email/Password Auth
  if (authMethod === 'email') {
    return (
      <div className="relative">
        <button
          onClick={() => setAuthMethod('select')}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
        <AuthComponent
          mode={mode}
          logo={logo}
          onLogin={onLogin}
          onRegister={onRegister}
          onSwitchToLogin={onSwitchToLogin}
          onSwitchToRegister={onSwitchToRegister}
          externalError={externalError}
          onGoogleClick={onGoogleClick}
          googleInitNode={googleInitNode}
        />
      </div>
    );
  }

  // Phone Auth
  return (
    <div className="min-h-screen w-full bg-[#060918] flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <button
          onClick={() => setAuthMethod('select')}
          className="absolute -top-12 left-0 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
        <PhoneAuthForm
          mode={mode}
          logo={logo}
        />

        {/* Switch between login/register */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            {mode === 'register' ? (
              <>
                ¿Ya tienes cuenta?{' '}
                <button
                  onClick={onSwitchToLogin}
                  className="text-[#4a6cf7] hover:underline font-medium"
                >
                  Inicia sesión
                </button>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{' '}
                <button
                  onClick={onSwitchToRegister}
                  className="text-[#4a6cf7] hover:underline font-medium"
                >
                  Regístrate
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
