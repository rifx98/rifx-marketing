import { Metadata } from 'next';
import TerminosClient from './terminos-client';

export const metadata: Metadata = {
  title: 'Aviso Legal | Rifx Marketing',
  description: 'Aviso Legal de Rifx Marketing: titular del sitio, servicios ofrecidos, condiciones de uso, propiedad intelectual y legislación aplicable.',
};

export default function TerminosPage() {
  return <TerminosClient />;
}
