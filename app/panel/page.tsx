import { Metadata } from 'next';
import PanelClient from './panel-client';

export const metadata: Metadata = {
  title: 'Panel de Control IA | RIFX Marketing',
  description: 'Gestiona tus automatizaciones y bots de ventas con Inteligencia Artificial.',
};

export default function PanelPage() {
  return <PanelClient />;
}
