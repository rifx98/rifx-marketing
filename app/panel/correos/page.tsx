import type { Metadata } from 'next';
import OutreachClient from './outreach-client';

export const metadata: Metadata = {
  title: 'Correos y prospectos | Rifx Marketing',
  description: 'Gestión y prospección de clientes con propuestas comerciales personalizadas.',
};

export default function OutreachPage() {
  return <OutreachClient />;
}
