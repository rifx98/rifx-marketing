export type AIUsageSummary = {
  creditsAvailable: number;
  creditsUsed: number;
  calls: number;
  providerCost: number;
  usageRevenue: number;
  monthlyAddonRevenue: number;
  estimatedRevenue: number;
  estimatedMargin: number;
  lowBalance: boolean;
};

export function buildAIUsageCards(summary: AIUsageSummary, isAdmin: boolean) {
  const cards = [
    { key: 'available', label: 'Créditos disponibles', value: summary.creditsAvailable.toLocaleString('es') },
    { key: 'used', label: 'Utilizados este mes', value: summary.creditsUsed.toLocaleString('es') },
    { key: 'calls', label: 'Consultas IA', value: summary.calls.toLocaleString('es') },
  ];

  if (isAdmin) {
    cards.push(
      { key: 'cost', label: 'Costo proveedor', value: `$${summary.providerCost.toFixed(4)}` },
      { key: 'revenue', label: 'Venta estimada', value: `$${summary.estimatedRevenue.toFixed(2)}` },
      { key: 'margin', label: 'Margen estimado', value: `$${summary.estimatedMargin.toFixed(2)}` },
    );
  }
  return cards;
}
