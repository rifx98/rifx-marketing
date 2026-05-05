import React from 'react';
import ServiciosClient from './servicios-client';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Servicios Estelares - Rifx Marketing',
  description: 'Descubre nuestra gama de servicios estelares para potenciar tu marca.',
};

export default function ServiciosPage() {
  return <ServiciosClient />;
}
