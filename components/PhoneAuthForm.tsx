'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';

interface PhoneAuthFormProps {
  mode: 'register' | 'login';
  onSuccess?: () => void;
  logo?: React.ReactNode;
}

export default function PhoneAuthForm({ mode, onSuccess, logo }: PhoneAuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);

  // Timer for OTP expiration
  useEffect(() => {
    if (expiresIn > 0) {
      const interval = setInterval(() => {
        setExpiresIn(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [expiresIn]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar código');
      }

      setExpiresIn(data.expiresIn || 600);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          code,
          companyName: mode === 'register' ? companyName : undefined,
          ownerName: mode === 'register' ? ownerName : undefined,
          acceptedTerms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código incorrecto');
      }

      // Success - redirect or call callback
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/panel');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar código');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (step === 'verify') {
    return (
      <div className="w-full max-w-md mx-auto">
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="text-center mb-6">
            {logo && <div className="flex justify-center mb-4">{logo}</div>}
            <h2 className="text-2xl font-bold text-white mb-2">Verificar código</h2>
            <p className="text-gray-400 text-sm">
              Ingresa el código de 6 dígitos enviado a<br />
              <span className="text-white font-medium">{phone}</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-center text-2xl tracking-widest text-white placeholder-gray-500"
              placeholder="000000"
              required
              disabled={loading}
              autoComplete="one-time-code"
            />
            {expiresIn > 0 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Expira en: <span className="text-white font-medium">{formatTime(expiresIn)}</span>
              </p>
            )}
          </div>

          {mode === 'register' && (
            <>
              <div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white placeholder-gray-500"
                  placeholder="Nombre de la empresa"
                  maxLength={160}
                  disabled={loading}
                />
              </div>

              <div>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white placeholder-gray-500"
                  placeholder="Tu nombre"
                  maxLength={160}
                  disabled={loading}
                />
              </div>

              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-[#4a6cf7] focus:ring-[#4a6cf7] border-white/20 rounded bg-white/5"
                  required
                  disabled={loading}
                />
                <label htmlFor="terms" className="ml-2 text-xs text-gray-400">
                  Acepto el{' '}
                  <a href="/aviso-legal" className="text-[#4a6cf7] hover:underline" target="_blank">
                    Aviso Legal
                  </a>{' '}
                  y la{' '}
                  <a href="/privacidad" className="text-[#4a6cf7] hover:underline" target="_blank">
                    Política de Privacidad
                  </a>
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              className="flex-1 py-3 px-4 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white"
              disabled={loading}
            >
              Cambiar número
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 6 || (mode === 'register' && !acceptedTerms)}
              className="flex-1 bg-gradient-to-r from-[#4a6cf7] to-[#7c3aed] text-white py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>

          {expiresIn === 0 && (
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
              className="w-full text-[#4a6cf7] hover:underline text-sm"
            >
              Reenviar código
            </button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSendOTP} className="space-y-4">
        <div className="text-center mb-6">
          {logo && <div className="flex justify-center mb-4">{logo}</div>}
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'register' ? 'Crear cuenta con teléfono' : 'Iniciar sesión con teléfono'}
          </h2>
          <p className="text-gray-400 text-sm">
            Te enviaremos un código de verificación por SMS
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white placeholder-gray-500"
              placeholder="0984123456 o +593984123456"
              required
              disabled={loading}
              autoComplete="tel"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-1">
            Formato: 0984123456 o +593984123456 (Ecuador)
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !phone}
          className="w-full bg-gradient-to-r from-[#4a6cf7] to-[#7c3aed] text-white py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          {loading ? 'Enviando...' : 'Enviar código'}
        </button>
      </form>
    </div>
  );
}
