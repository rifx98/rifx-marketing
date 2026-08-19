"use client";

import React from "react";

const images = [
  "https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif",
  "https://motionsites.ai/assets/hero-codenest-preview-Cgppc2qV.gif",
  "https://motionsites.ai/assets/hero-vex-ventures-preview-BczMFIiw.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-v2-preview-DjvxjG3C.gif",
  "https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif",
  "https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif",
  "https://motionsites.ai/assets/hero-vitara-preview-Cjz2QYyU.gif",
  "https://motionsites.ai/assets/hero-terra-preview-BFjrCr7T.gif",
  "https://motionsites.ai/assets/hero-skyelite-preview-DHaZIgUv.gif",
  "https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif",
  "https://motionsites.ai/assets/hero-designpro-preview-D8c5_een.gif",
  "https://motionsites.ai/assets/hero-stellar-ai-preview-D3HL6bw1.gif",
  "https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif",
  "https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif",
  "https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif",
  "https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif",
  "https://motionsites.ai/assets/hero-planet-orbit-preview-DWAP8Z1P.gif",
  "https://motionsites.ai/assets/hero-new-era-preview-CocuDUm9.gif",
  "https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif",
  "https://motionsites.ai/assets/hero-luminex-preview-CxOP7ce6.gif",
  "https://motionsites.ai/assets/hero-celestia-preview-0yO3jXO8.gif"
];

const row1Base = images.slice(0, 11);
const row2Base = images.slice(11);

const row1 = [...row1Base, ...row1Base, ...row1Base];
const row2 = [...row2Base, ...row2Base, ...row2Base];

// Antes, la posición de cada fila se recalculaba a mano en cada evento de
// scroll (con JS). En el celular eso competía por el hilo principal con la
// decodificación de tantos GIFs pesados y se veía "a tirones". Una animación
// CSS por keyframes corre en el compositor (GPU), independiente del scroll y
// del hilo principal, así que se mantiene fluida sin importar qué tan cargado
// esté el resto de la página.
export default function MarqueeSection() {
  return (
    <section className="relative z-10 pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden">
      <style>{`
        @keyframes marquee-left {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-33.3333%, 0, 0); }
        }
        @keyframes marquee-right {
          from { transform: translate3d(-33.3333%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        .marquee-row-1 { animation: marquee-left 50s linear infinite; }
        .marquee-row-2 { animation: marquee-right 50s linear infinite; }

        /* Solo en móvil: en vez de dar la vuelta infinita hacia el mismo
           lado, las filas rebotan de ida y vuelta (como pidieron) — en PC
           se queda igual, el ciclo continuo de siempre. */
        @media (max-width: 767px) {
          .marquee-row-1, .marquee-row-2 {
            animation-direction: alternate;
            animation-timing-function: ease-in-out;
            animation-duration: 18s;
          }
        }
      `}</style>
      <div className="flex flex-col gap-3">
        {/* Row 1 */}
        <div className="flex gap-3 w-max marquee-row-1" style={{ willChange: "transform" }}>
          {row1.map((src, i) => (
            <img
              key={`r1-${i}`}
              src={src}
              alt="Project Showcase"
              className="w-[420px] h-[270px] rounded-2xl object-cover shrink-0"
            />
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex gap-3 w-max marquee-row-2" style={{ willChange: "transform" }}>
          {row2.map((src, i) => (
            <img
              key={`r2-${i}`}
              src={src}
              alt="Project Showcase"
              className="w-[420px] h-[270px] rounded-2xl object-cover shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
