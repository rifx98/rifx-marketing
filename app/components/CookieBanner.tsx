'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrackingPixels {
  google_analytics?: string;
  facebook_pixel?: string;
  tiktok_pixel?: string;
}

export default function CookieBanner({ trackingPixels }: { trackingPixels?: TrackingPixels | null }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Revisar si ya hay una preferencia guardada
    const consent = localStorage.getItem('rifx_cookie_consent');
    if (!consent) {
      // Si no hay preferencia, mostrar el banner después de un pequeño retraso
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    } else if (consent === 'accepted') {
      // Si ya aceptó, inyectaríamos aquí los scripts de analytics
      injectAnalytics();
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('rifx_cookie_consent', 'accepted');
    setShowBanner(false);
    injectAnalytics();
  };

  const handleDecline = () => {
    localStorage.setItem('rifx_cookie_consent', 'declined');
    setShowBanner(false);
  };

  const injectAnalytics = () => {
    if (typeof window === 'undefined') return;
    
    // Solo inyectar si no se han inyectado antes
    if ((window as any).__rifx_pixels_injected) return;
    (window as any).__rifx_pixels_injected = true;

    // 1. Google Analytics
    if (trackingPixels?.google_analytics) {
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${trackingPixels.google_analytics}`;
      document.head.appendChild(gaScript);

      const gaInit = document.createElement('script');
      gaInit.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${trackingPixels.google_analytics}');
      `;
      document.head.appendChild(gaInit);
    }

    // 2. Facebook Pixel
    if (trackingPixels?.facebook_pixel) {
      const fbInit = document.createElement('script');
      fbInit.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${trackingPixels.facebook_pixel}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(fbInit);
    }

    // 3. TikTok Pixel
    if (trackingPixels?.tiktok_pixel) {
      const ttInit = document.createElement('script');
      ttInit.innerHTML = `
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
          ttq.load('${trackingPixels.tiktok_pixel}');
          ttq.page();
        }(window, document, 'ttq');
      `;
      document.head.appendChild(ttInit);
    }

    console.log('✅ Cookies analíticas inyectadas de forma segura.');
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:max-w-sm z-[9999]"
        >
          <div className="bg-[#0C0C0C]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
            {/* Glow decorativo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-blue-400">cookie</span>
              <h3 className="font-['Kanit'] font-semibold text-white text-lg tracking-wide">
                Privacidad y Cookies
              </h3>
            </div>
            
            <p className="text-[#D7E2EA]/70 text-sm font-['Manrope'] mb-6 leading-relaxed">
              Utilizamos cookies para mejorar tu experiencia en nuestra web y analizar nuestro tráfico. Al aceptar, nos ayudas a seguir mejorando.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDecline}
                className="px-4 py-2.5 rounded-lg border border-white/10 text-white/70 font-['Manrope'] text-sm font-semibold hover:bg-white/5 hover:text-white transition-all w-full"
              >
                Rechazar
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2.5 rounded-lg bg-blue-500 text-white font-['Manrope'] text-sm font-semibold hover:bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all w-full"
              >
                Aceptar Todo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
