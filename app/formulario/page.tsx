'use client';

import React, { useState, useMemo, useEffect } from 'react';

const COUNTRIES = [
  { code: 'EC', name: 'Ecuador', dial: '+593' },
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'MX', name: 'México', dial: '+52' },
  { code: 'PE', name: 'Perú', dial: '+51' },
  { code: 'ES', name: 'España', dial: '+34' },
  { code: 'US', name: 'USA', dial: '+1' },
  { code: 'CR', name: 'Costa Rica', dial: '+506' },
  { code: 'CU', name: 'Cuba', dial: '+53' },
  { code: 'PA', name: 'Panamá', dial: '+507' },
  { code: 'UY', name: 'Uruguay', dial: '+598' },
  { code: 'VE', name: 'Venezuela', dial: '+58' },
];

const SERVICES = [
  { id: 'ads', label: 'Anuncios de Alta Velocidad', icon: '🚀' },
  { id: 'whatsapp', label: 'WhatsApp con IA', icon: '🤖' },
  { id: 'uxui', label: 'Diseño UX/UI Inmersivo', icon: '🎨' },
  { id: 'ecommerce', label: 'E-commerce Interestelar', icon: '🛒' },
  { id: 'other', label: 'Otro proyecto', icon: '💡' },
];

export default function FormularioPage() {
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    celular: '',
    country: COUNTRIES[0],
    necesidad: SERVICES[0],
    descripcion: '',
    privacy: false,
    tips: false,
  });

  const filteredCountries = useMemo(() =>
    COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    ), [countrySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.custom-dropdown')) {
        setIsServiceOpen(false);
        setIsCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formData.celular.replace(/\s/g, '');
    if (cleanPhone.length < 10) {
      alert('El número de celular debe tener exactamente 10 dígitos');
      return;
    }
    if (!formData.privacy) {
      alert('Debes aceptar la política de privacidad');
      return;
    }
    console.log('Form submitted:', { ...formData, celular: cleanPhone });
    setSubmitted(true);
  };

  return (
    <>
      <head>
        <title>Cuéntanos Tu Proyecto — Rifx Marketing</title>
        <meta name="robots" content="noindex" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>

      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0C0C0C 0%, #111111 50%, #1a0a00 100%)',
          fontFamily: "'Montserrat', sans-serif",
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '80px 40px', color: 'white' }}>
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🚀</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px', color: '#f27121' }}>
              ¡Mensaje recibido!
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>
              Te contactaremos en menos de 24 horas.
            </p>
            <button
              onClick={() => window.close()}
              style={{
                background: '#f27121', color: 'white', border: 'none',
                padding: '14px 32px', borderRadius: '9999px',
                fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
              }}
            >
              Cerrar ventana
            </button>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'white',
              borderRadius: '2rem',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header naranja */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f27121, #e94d1a)',
                padding: '32px 48px 28px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '6px 16px', borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: 'white', marginBottom: '16px',
                }}
              >
                🚀 Formulario Express
              </div>
              <h1
                style={{
                  fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900,
                  color: 'white', margin: 0, lineHeight: 1.2,
                }}
              >
                Cuéntanos Tu Proyecto
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontSize: '0.9rem' }}>
                Solo necesitamos algunos datos para crear tu propuesta personalizada
              </p>
            </div>

            {/* Form body */}
            <div style={{ padding: '40px 48px' }}>
              {/* Badges */}
              <div
                style={{
                  background: '#f8f9fa', borderRadius: '1rem', padding: '20px',
                  textAlign: 'center', marginBottom: '32px',
                  border: '1px solid #f0f0f0',
                }}
              >
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#333', marginBottom: '12px' }}>
                  Cuéntanos qué necesitas y te contactamos
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  {[
                    { icon: '⏱', label: 'Respuesta en 24h' },
                    { icon: '🔒', label: '100% Seguro' },
                    { icon: '❤️', label: 'Sin compromiso' },
                  ].map(b => (
                    <span key={b.label} style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#f27121' }}>{b.icon}</span> {b.label}
                    </span>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Nombre */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                    Tu nombre *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="¿Cómo te llamas?"
                    style={inputStyle}
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.target.style, inputStyle)}
                  />
                </div>

                {/* Email + Teléfono */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                      Email *
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="tu@email.com"
                      style={inputStyle}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                      onBlur={e => Object.assign(e.target.style, inputStyle)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                      Celular <span style={{ fontWeight: 400, color: '#aaa' }}>(min. 10 dígitos) *</span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* País dropdown */}
                      <div className="custom-dropdown" style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIsCountryOpen(!isCountryOpen)}
                          style={{ ...inputStyle, width: 'auto', minWidth: '90px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        >
                          <span style={{ color: '#888', fontSize: '12px' }}>{formData.country.code}</span>
                          <span style={{ color: '#111', fontWeight: 700, fontSize: '12px' }}>{formData.country.dial}</span>
                          <span style={{ color: '#aaa', fontSize: '12px' }}>▾</span>
                        </button>
                        {isCountryOpen && (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                            width: '220px', background: 'white', borderRadius: '1rem',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #f0f0f0',
                            zIndex: 100, overflow: 'hidden',
                          }}>
                            <div style={{ padding: '10px' }}>
                              <input
                                autoFocus
                                type="text"
                                placeholder="Buscar país..."
                                style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
                                value={countrySearch}
                                onChange={e => setCountrySearch(e.target.value)}
                              />
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {filteredCountries.map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => { setFormData({ ...formData, country: c }); setIsCountryOpen(false); setCountrySearch(''); }}
                                  style={{
                                    width: '100%', padding: '10px 16px', display: 'flex',
                                    justifyContent: 'space-between', alignItems: 'center',
                                    background: formData.country.code === c.code ? '#fff4ee' : 'transparent',
                                    border: 'none', cursor: 'pointer', fontSize: '13px',
                                  }}
                                >
                                  <span style={{ color: '#444' }}>{c.code} — {c.name}</span>
                                  <span style={{ color: '#f27121', fontWeight: 700 }}>{c.dial}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        required
                        type="tel"
                        placeholder="99 123 4567"
                        style={{ ...inputStyle, flex: 1 }}
                        value={formData.celular}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          let formatted = val;
                          if (val.length > 2) formatted = val.slice(0, 2) + ' ' + val.slice(2);
                          if (val.length > 5) formatted = val.slice(0, 2) + ' ' + val.slice(2, 5) + ' ' + val.slice(5);
                          setFormData({ ...formData, celular: formatted });
                        }}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)}
                      />
                    </div>
                  </div>
                </div>

                {/* Servicio */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                    ¿Qué necesitas? *
                  </label>
                  <div className="custom-dropdown" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsServiceOpen(!isServiceOpen)}
                      style={{
                        ...inputStyle, width: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{formData.necesidad.icon}</span>
                        <span style={{ fontWeight: 500, color: '#111' }}>{formData.necesidad.label}</span>
                      </span>
                      <span style={{ color: '#aaa', transition: 'transform 0.2s', display: 'inline-block', transform: isServiceOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {isServiceOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%',
                        background: 'white', borderRadius: '1rem',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #f0f0f0',
                        zIndex: 100, overflow: 'hidden',
                      }}>
                        {SERVICES.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setFormData({ ...formData, necesidad: s }); setIsServiceOpen(false); }}
                            style={{
                              width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center',
                              gap: '12px', background: formData.necesidad.id === s.id ? '#fff4ee' : 'transparent',
                              border: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left',
                              color: formData.necesidad.id === s.id ? '#f27121' : '#444',
                              fontWeight: formData.necesidad.id === s.id ? 700 : 400,
                            }}
                          >
                            <span>{s.icon}</span> {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                    Cuéntanos más <span style={{ fontWeight: 400, color: '#aaa' }}>(opcional)</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe brevemente tu proyecto, objetivos o cualquier detalle..."
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                    value={formData.descripcion}
                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.target.style, inputStyle)}
                  />
                </div>

                {/* Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.privacy}
                      onChange={e => setFormData({ ...formData, privacy: e.target.checked })}
                      style={{ marginTop: '2px', accentColor: '#f27121', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#555' }}>
                      Acepto la <span style={{ color: '#f27121', textDecoration: 'underline', cursor: 'pointer' }}>política de privacidad</span> *
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.tips}
                      onChange={e => setFormData({ ...formData, tips: e.target.checked })}
                      style={{ marginTop: '2px', accentColor: '#f27121', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#555' }}>Quiero recibir tips de diseño y novedades (máx. 2/mes, sin spam)</span>
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #f27121, #e94d1a)',
                    color: 'white', border: 'none', padding: '18px',
                    borderRadius: '1rem', fontWeight: 900, fontSize: '1rem',
                    cursor: 'pointer', boxShadow: '0 8px 24px rgba(242,113,33,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  Hablemos de tu proyecto →
                </button>

                <p style={{ textAlign: 'center', fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                  🔒 Tus datos están seguros. Respondemos en menos de 24h. Sin spam.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  border: '1.5px solid #e5e7eb',
  borderRadius: '0.75rem',
  fontSize: '14px',
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 500,
  color: '#111',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: '#f27121',
  boxShadow: '0 0 0 3px rgba(242,113,33,0.15)',
};
