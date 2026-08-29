'use client';

import { useState, useEffect } from 'react';
import { Phone, AlertCircle } from 'lucide-react';

const COUNTRIES = [
  { code: '+1', name: 'Estados Unidos / Canadá / PR', flag: '🇺🇸', max: 10 },
  { code: '+52', name: 'México', flag: '🇲🇽', max: 10 },
  { code: '+501', name: 'Belice', flag: '🇧🇿', max: 7 },
  { code: '+502', name: 'Guatemala', flag: '🇬🇹', max: 8 },
  { code: '+503', name: 'El Salvador', flag: '🇸🇻', max: 8 },
  { code: '+504', name: 'Honduras', flag: '🇭🇳', max: 8 },
  { code: '+505', name: 'Nicaragua', flag: '🇳🇮', max: 8 },
  { code: '+506', name: 'Costa Rica', flag: '🇨🇷', max: 8 },
  { code: '+507', name: 'Panamá', flag: '🇵🇦', max: 8 },
  { code: '+57', name: 'Colombia', flag: '🇨🇴', max: 10 },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪', max: 10 },
  { code: '+593', name: 'Ecuador', flag: '🇪🇨', max: 9 },
  { code: '+51', name: 'Perú', flag: '🇵🇪', max: 9 },
  { code: '+591', name: 'Bolivia', flag: '🇧🇴', max: 8 },
  { code: '+56', name: 'Chile', flag: '🇨🇱', max: 9 },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', max: 10 },
  { code: '+598', name: 'Uruguay', flag: '🇺🇾', max: 8 },
  { code: '+595', name: 'Paraguay', flag: '🇵🇾', max: 9 },
  { code: '+55', name: 'Brasil', flag: '🇧🇷', max: 11 },
  { code: '+53', name: 'Cuba', flag: '🇨🇺', max: 8 },
  { code: '+1809', name: 'Rep. Dominicana', flag: '🇩🇴', max: 7 },
];

export default function ForcePhoneVerification({ onVerified }: { onVerified: () => void }) {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [countryCode, setCountryCode] = useState('+593');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[11];
  const phoneLengthRequired = selectedCountry.max;

  // Timer for OTP expiration
  useEffect(() => {
    if (expiresIn > 0) {
      const interval = setInterval(() => {
        setExpiresIn(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [expiresIn]);

  const getFullPhone = () => {
    // Si el usuario por error pega el código del país en el número, no lo duplicamos
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${countryCode}${cleanPhone}`;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fullPhone = getFullPhone();
      const response = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
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
      const fullPhone = getFullPhone();
      const response = await fetch('/api/auth/phone/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code }),
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
                Número de celular
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    setPhoneNumber(''); // Reset phone when country changes
                  }}
                  className="w-[140px] px-3 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white transition-all outline-none appearance-none cursor-pointer"
                  disabled={loading}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.code} className="bg-[#060918] text-white">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, phoneLengthRequired);
                    let formatted = '';
                    if (digits.length > 0) formatted += digits.substring(0, 2);
                    if (digits.length > 2) formatted += ' ' + digits.substring(2, 5);
                    if (digits.length > 5) formatted += ' ' + digits.substring(5);
                    setPhoneNumber(formatted);
                  }}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#4a6cf7] focus:border-transparent text-white placeholder-gray-500 transition-all"
                  placeholder={(() => {
                    const nines = '9'.repeat(phoneLengthRequired);
                    let formatted = '';
                    if (nines.length > 0) formatted += nines.substring(0, 2);
                    if (nines.length > 2) formatted += ' ' + nines.substring(2, 5);
                    if (nines.length > 5) formatted += ' ' + nines.substring(5);
                    return formatted;
                  })()}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || phoneNumber.replace(/\D/g, '').length !== phoneLengthRequired}
              className="w-full bg-gradient-to-r from-[#4a6cf7] to-[#7c3aed] text-white py-3.5 px-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-lg mt-2 shadow-[0_0_15px_rgba(74,108,247,0.4)]"
            >
              {loading ? 'Enviando...' : 'Enviar código SMS'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <p className="text-sm text-center text-gray-400 mb-4">
                Ingresa el código enviado al <strong className="text-white">{getFullPhone()}</strong>
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
