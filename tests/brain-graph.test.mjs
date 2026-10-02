import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBrainGraph } from '../lib/brain-graph.ts';

test('deduplicates customers across conversations by phone number and links them', () => {
  const now = Date.parse('2026-09-29T18:00:00.000Z');
  const graph = buildBrainGraph(
    {
      conversations: [
        {
          id: 'conv-1',
          customer_name: 'Carlos Mendoza',
          phone_number: '+57 (300) 123-4567',
          status: 'chatting',
          sales_stage: 'qualified',
          service_interest: 'Automatización WhatsApp',
          updated_at: '2026-09-29T17:45:00.000Z',
        },
        {
          id: 'conv-2',
          customer_name: 'Carlos M.',
          phone_number: '573001234567',
          status: 'qualified',
          sales_stage: 'proposal',
          service_interest: 'Bot con IA',
          updated_at: '2026-09-29T17:50:00.000Z',
        },
      ],
    },
    now,
  );

  const customerNodes = graph.nodes.filter((node) => node.type === 'customer');
  assert.equal(customerNodes.length, 1, 'Both conversations with identical phone must share one customer node');

  const customerNode = customerNodes[0];
  assert.equal(customerNode.source, 'confirmed');

  const conversationNodes = graph.nodes.filter((node) => node.type === 'conversation');
  assert.equal(conversationNodes.length, 2, 'There should be 2 distinct conversation nodes');

  const edgesFromCustomer = graph.edges.filter(
    (edge) => edge.source === customerNode.id && edge.relation === 'conversó',
  );
  assert.equal(edgesFromCustomer.length, 2, 'Customer node must connect to both conversations');

  assert.equal(graph.stats.customers, 1);
  assert.equal(graph.stats.conversations, 2);
});

test('masks phone numbers in node metadata and summaries to protect sensitive data', () => {
  const now = Date.parse('2026-09-29T18:00:00.000Z');
  const rawPhone = '+1 (555) 839-2041';
  const graph = buildBrainGraph(
    {
      conversations: [
        {
          id: 'conv-secure',
          customer_name: 'Laura Restrepo',
          phone_number: rawPhone,
          updated_at: '2026-09-29T17:30:00.000Z',
        },
      ],
      voiceCalls: [
        {
          id: 'call-1',
          direction: 'inbound',
          from_number: rawPhone,
          duration_seconds: 145,
          summary: 'Consulta sobre precios',
          created_at: '2026-09-29T17:35:00.000Z',
        },
      ],
    },
    now,
  );

  const customerNode = graph.nodes.find((n) => n.type === 'customer');
  assert.ok(customerNode, 'Customer node should exist');
  assert.equal(customerNode.metadata.phone, '•••• 2041');
  assert.ok(
    !JSON.stringify(customerNode).includes(rawPhone),
    'Raw phone number must not appear in customer node JSON',
  );

  const voiceNode = graph.nodes.find((n) => n.type === 'voice');
  assert.ok(voiceNode, 'Voice node should exist');
  assert.equal(voiceNode.metadata.phone, '•••• 2041');
  assert.ok(
    !JSON.stringify(voiceNode).includes(rawPhone),
    'Raw phone number must not appear in voice call node JSON',
  );
});

test('strictly separates confirmed memory from inferred cognitive signals', () => {
  const now = Date.parse('2026-09-29T18:00:00.000Z');
  const graph = buildBrainGraph(
    {
      conversations: [
        {
          id: 'conv-ai',
          customer_name: 'Santiago Ortiz',
          phone_number: '573110009988',
          intent: 'demo_request',
          next_action: 'Agendar demostración interactiva',
          last_objection: 'Precio demasiado alto para su presupuesto',
          lead_score: 85,
          updated_at: '2026-09-29T17:00:00.000Z',
        },
      ],
      messages: [
        {
          id: 'msg-1',
          conversation_id: 'conv-ai',
          role: 'user',
          content: 'Hola, me interesa agendar una demo por favor',
          created_at: '2026-09-29T16:58:00.000Z',
        },
      ],
      knowledge: [
        {
          id: 'doc-1',
          file_name: 'Manual_Ventas_2026.pdf',
          active: true,
          status: 'ready',
          updated_at: '2026-09-29T10:00:00.000Z',
        },
      ],
      appointments: [
        {
          id: 'apt-1',
          conversation_id: 'conv-ai',
          customer_name: 'Santiago Ortiz',
          phone_number: '573110009988',
          scheduled_time: '2026-09-30T15:00:00.000Z',
          service: 'Demo Premium',
          status: 'confirmed',
          created_at: '2026-09-29T17:01:00.000Z',
        },
      ],
      sales: [
        {
          id: 'sale-1',
          conversation_id: 'conv-ai',
          customer_name: 'Santiago Ortiz',
          amount: 499,
          service: 'Plan Master',
          status: 'won',
          created_at: '2026-09-29T17:15:00.000Z',
        },
      ],
    },
    now,
  );

  const confirmedNodes = graph.nodes.filter((n) => n.source === 'confirmed');
  const inferredNodes = graph.nodes.filter((n) => n.source === 'inferred');

  assert.ok(confirmedNodes.length >= 6, 'Must have confirmed nodes for core, customer, conv, msg, doc, apt, sale');
  assert.ok(inferredNodes.length >= 3, 'Must have inferred nodes for intent, action, objection');

  for (const node of confirmedNodes) {
    assert.equal(node.confidence, 1, `Confirmed node ${node.id} should have confidence 1.0`);
    assert.ok(
      ['core', 'customer', 'conversation', 'message_user', 'message_ai', 'knowledge', 'appointment', 'sale', 'voice'].includes(node.type),
      `Unexpected confirmed type ${node.type}`,
    );
  }

  for (const node of inferredNodes) {
    assert.ok(node.confidence < 1, `Inferred node ${node.id} should have confidence < 1.0`);
    assert.ok(
      ['intent', 'action', 'objection'].includes(node.type),
      `Unexpected inferred type ${node.type}`,
    );
  }
});

test('generates valid interconnected relationships without self-loops or orphans', () => {
  const now = Date.parse('2026-09-29T18:00:00.000Z');
  const graph = buildBrainGraph(
    {
      conversations: [
        {
          id: 'c1',
          customer_name: 'Elena Gómez',
          phone_number: '1234567890',
          intent: 'pricing',
          updated_at: '2026-09-29T17:55:00.000Z',
          status: 'requires_attention',
        },
      ],
      knowledge: [
        {
          id: 'k1',
          file_name: 'FAQ.pdf',
          active: true,
          updated_at: '2026-09-29T12:00:00.000Z',
        },
      ],
    },
    now,
  );

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  assert.ok(nodeIds.has('core:crm'), 'Core node must always exist');

  for (const edge of graph.edges) {
    assert.notEqual(edge.source, edge.target, 'No edge can be a self-loop');
    assert.ok(nodeIds.has(edge.source), `Edge source ${edge.source} must exist in nodes`);
    assert.ok(nodeIds.has(edge.target), `Edge target ${edge.target} must exist in nodes`);
    assert.ok(edge.strength > 0 && edge.strength <= 1, 'Edge strength must be within (0, 1]');
  }

  assert.equal(graph.stats.activeNow, 1, 'Conversation within last hour counts as activeNow');
  assert.equal(graph.stats.needsAttention, 1, 'Conversation requiring attention counts towards needsAttention');
});

test('handles empty and malformed input gracefully', () => {
  const graph = buildBrainGraph({});
  assert.ok(graph.nodes.length >= 1, 'Must at least contain core:crm');
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.activity.length, 0);
  assert.equal(graph.stats.customers, 0);
  assert.equal(graph.stats.conversations, 0);

  // Malformed rows
  const malformedGraph = buildBrainGraph({
    conversations: [null, undefined, {}, { id: '' }],
    messages: [null, { content: '__SYSTEM_PROMPT_INTERNAL' }],
    knowledge: [null, { id: '' }],
    appointments: [{ id: null }],
    sales: [{ id: '' }],
    voiceCalls: [{}],
  });

  assert.ok(malformedGraph.nodes.length >= 1);
  assert.ok(Array.isArray(malformedGraph.edges));
  assert.ok(Array.isArray(malformedGraph.activity));
});

test('integrates advertising campaigns into Brain Graph with synaptic learning and core link', () => {
  const now = Date.parse('2026-09-29T18:00:00.000Z');
  const graph = buildBrainGraph(
    {
      campaigns: [
        {
          id: 'camp-101',
          name: 'Promo 2x1 Pizza Familiar',
          status: 'draft',
          platform: 'facebook_instagram',
          campaign_config: {
            objective: 'OUTCOME_SALES',
            daily_budget_usd: 15,
            synaptic_insight: 'Segmentación local 10km en Quito con ángulo AIDA y WhatsApp directo',
          },
          created_at: '2026-09-29T17:30:00.000Z',
          updated_at: '2026-09-29T17:40:00.000Z',
        },
      ],
    },
    now,
  );

  const campaignNodes = graph.nodes.filter((n) => n.type === 'campaign');
  assert.equal(campaignNodes.length, 1, 'Should generate one campaign node');
  assert.equal(campaignNodes[0].id, 'campaign:camp-101');
  assert.equal(campaignNodes[0].label, 'Pauta · Promo 2x1 Pizza Familiar');

  // Verify connection to core:crm
  const edge = graph.edges.find((e) => e.source === 'core:crm' && e.target === 'campaign:camp-101');
  assert.ok(edge, 'Campaign node must connect to core:crm');
  assert.equal(edge.relation, 'orquesta_pauta');

  // Verify marketing cognitive insight
  const marketingInsight = graph.learning.salesPlaybook.insights.find((i) => i.category === 'marketing');
  assert.ok(marketingInsight, 'Should produce a marketing sales insight');
  assert.ok(marketingInsight.title.includes('Estrategia Publicitaria'));
});

