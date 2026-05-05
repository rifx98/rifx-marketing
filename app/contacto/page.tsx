import { Metadata } from 'next';
import ContactoClient from './contacto-client';

export const metadata: Metadata = {
  title: 'Contacto | Rifx Marketing',
  description: 'Conéctate con el control de misión de Rifx Marketing.',
};

export default function ContactoPage() {
  return <ContactoClient />;
}
