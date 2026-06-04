import { Metadata } from 'next';
import PrivacidadClient from './privacidad-client';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Rifx Marketing',
  description: 'Política de Privacidad oficial de Rifx Marketing.',
};

export default function PrivacidadPage() {
  return <PrivacidadClient />;
}
