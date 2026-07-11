import { Metadata } from 'next';
import PoliticaPrivacidadClient from './politica-privacidad-client';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Rifx Marketing',
  description: 'Política de Privacidad oficial de Rifx Marketing: qué datos recopilamos, cómo los usamos y protegemos, y tus derechos sobre tu información.',
};

export default function PoliticaPrivacidadPage() {
  return <PoliticaPrivacidadClient />;
}
