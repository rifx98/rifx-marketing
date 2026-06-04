import { Metadata } from 'next';
import TerminosClient from './terminos-client';

export const metadata: Metadata = {
  title: 'Términos de Servicio | Rifx Marketing',
  description: 'Términos de Servicio oficiales de Rifx Marketing.',
};

export default function TerminosPage() {
  return <TerminosClient />;
}
