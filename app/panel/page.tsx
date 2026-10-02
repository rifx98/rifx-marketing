import { Metadata } from 'next';
import PanelLoader from './panel-loader';


export const metadata: Metadata = {
  title: 'Panel de Control IA | RIFX Marketing',
  description: 'Gestiona tus automatizaciones y bots de ventas con Inteligencia Artificial.',
};

export default function PanelPage() {
  return <PanelLoader />;
}


