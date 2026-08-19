'use client';

import { useState, useEffect } from 'react';
import { Phone, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ForcePhoneVerification({ onVerified }: { onVerified: () => void }) {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
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
      const response = await fetch('/api/auth/phone/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código incorrecto');
      }

      onVerified();
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

  return (
    <div className="min-h-screen w-full bg-[#060918] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-gradient-to-b from-[#4a6cf7]/20 to-transparent blur-3xl rounded-full -z-10 opacity-50" />

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#4a6cf7]/20 to-[#7c3aed]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#4a6cf7]/30">
            <Phone className="w-8 h-8 text-[#4a6cf7]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verifica tu teléfono</h2>
          <p className="text-gray-400 text-sm">
            Para continuar usando la plataforma, es necesario vincular y verificar tu número de teléfono.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Número de celular (con código de país)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white placeholder-gray-500 transition-all"
                placeholder="+593 99 999 9999"
                required
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || phone.length < 8}
              className="w-full bg-gradient-to-r from-[#4a6cf7] to-[#7c3aed] text-white py-3.5 px-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-lg mt-2 shadow-[0_0_15px_rgba(74,108,247,0.4)]"
            >
              {loading ? 'Enviando...' : 'Enviar código SMS'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <p className="text-sm text-center text-gray-400 mb-4">
                Ingresa el código enviado al <strong className="text-white">{phone}</strong>
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-center text-3xl tracking-[0.5em] text-white placeholder-gray-600 font-mono transition-all"
                placeholder="000000"
                required
                disabled={loading}
                autoComplete="one-time-code"
              />
              {expiresIn > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  Expira en: <span className="text-[#4a6cf7] font-medium">{formatTime(expiresIn)}</span>
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                className="w-1/3 py-3.5 px-4 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white font-medium"
                disabled={loading}
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-2/3 bg-gradient-to-r from-[#4a6cf7] to-[#7c3aed] text-white py-3.5 px-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-[0_0_15px_rgba(74,108,247,0.4)]"
              >
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>
            </div>
            
            {expiresIn === 0 && (
              <button
                type="button"
                onClick={handleSendOTP}
                className="w-full text-[#4a6cf7] hover:text-white transition-colors text-sm mt-2"
                disabled={loading}
              >
                Reenviar código
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
