'use client';

import dynamic from 'next/dynamic';

const PanelClient = dynamic(() => import('./panel-client'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full bg-[#060918] flex items-center justify-center flex-col space-y-4">
      <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase animate-pulse">Cargando panel...</p>
    </div>
  ),
});

export default function PanelLoader() {
  return <PanelClient />;
}
