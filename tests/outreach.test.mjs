import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOutreachDraft,
  prepareOutreachTemplate,
  renderOutreach,
  SAMPLE_OUTREACH,
} from '../lib/outreach.ts';

test('single recipient only; reject header injection and oversized fields', () => {
  const draft = { ...SAMPLE_OUTREACH, email: 'business@example.com' };
  assert.equal(parseOutreachDraft(draft)?.email, draft.email);
  for (const email of ['a@example.com,b@example.com', 'a@example.com\r\nBcc:b@example.com', '', 'a@localhost']) {
    assert.equal(parseOutreachDraft({ ...draft, email }), null);
  }
  assert.equal(parseOutreachDraft({ ...draft, subject: 'Hi\r\nBcc:test@example.com' }), null);
  assert.equal(parseOutreachDraft({ ...draft, proposal: 'x'.repeat(2401) }), null);
});

test('custom templates strip active content and retain email design', () => {
  const html = prepareOutreachTemplate(
    '<table role="presentation"><tr><td><h1>{{negocio}}</h1><p>{{propuesta}}</p><script>alert(1)</script><iframe src="https://example.com"></iframe><form><input></form><img src="javascript:alert(1)"><a href="javascript:alert(1)">Bad</a><p style="color:#103260">Safe</p></td></tr></table>'
  );
  assert.ok(html);
  assert.ok(!/<script|<iframe|<form|<input|javascript:/i.test(html));
  assert.ok(html.includes('color:#103260'));
  assert.equal(prepareOutreachTemplate('<p>{{negocio}}</p>'), null);
  assert.equal(prepareOutreachTemplate('<p>{{propuesta}}</p>' + 'x'.repeat(64000)), null);
});

test('saved custom design substitutes escaped business-specific content', () => {
  const customTpl = '<table role="presentation"><tr><td><h1>{{negocio}}</h1><p>{{propuesta}}</p></td></tr></table>';
  const draft = parseOutreachDraft({
    ...SAMPLE_OUTREACH,
    email: 'business@example.com',
    template_html: customTpl,
  });
  assert.ok(draft?.template_html);
  const result = renderOutreach({
    ...draft,
    business: '<img src=x onerror=alert(1)>',
    proposal: 'A & B\nSecond line',
  });
  assert.ok(result.html.includes('&lt;img'));
  assert.ok(!result.html.includes('<img src=x'));
  assert.ok(result.html.includes('A &amp; B<br>Second line'));
  assert.ok(!result.html.includes('{{propuesta}}'));
  assert.ok(result.html.includes('Director | Rifx Marketing'));
});

test('default professional template renders properly with navy branding and social corner', () => {
  const result = renderOutreach(SAMPLE_OUTREACH);
  assert.ok(result.html.includes('#103260'));
  assert.ok(result.html.includes('Muebles Universal'));
  assert.ok(result.html.includes('USD 300'));
  assert.ok(result.html.includes('https://www.tiktok.com/@rifxmarketing'));
  assert.ok(result.html.includes('https://www.facebook.com/profile.php?id=61556910667259'));
  assert.ok(result.html.includes('https://www.instagram.com/rifxmarketing/'));
  assert.ok(result.text.includes('La inversión en anuncios se paga por separado'));
  assert.ok(result.text.includes('TikTok @rifxmarketing'));
});

test('custom price, deliverables and ad image render properly', () => {
  const custom = {
    ...SAMPLE_OUTREACH,
    price: '$450',
    service_title: 'Plan Integral Redes + Pauta',
    deliverables: '20 diseños • 5 reels profesionales',
    image_url: 'https://example.com/ad-sample.jpg',
  };
  const result = renderOutreach(custom);
  assert.ok(result.html.includes('$450'));
  assert.ok(result.html.includes('Plan Integral Redes + Pauta'));
  assert.ok(result.html.includes('20 diseños • 5 reels profesionales'));
  assert.ok(result.html.includes('https://example.com/ad-sample.jpg'));
  assert.ok(result.html.includes('<img src="https://example.com/ad-sample.jpg"'));
  assert.ok(!result.html.includes('MUESTRA VISUAL DE ANUNCIO'));
  assert.ok(result.text.includes('$450'));
  assert.ok(result.text.includes('https://example.com/ad-sample.jpg'));
});

test('whatsapp button toggle and phone customization in proposals', () => {
  // Con WhatsApp activado por defecto
  const withWa = renderOutreach({ ...SAMPLE_OUTREACH, include_whatsapp: true, whatsapp_phone: '+593 99 999 9999' });
  assert.ok(withWa.html.includes('Chatear por WhatsApp'));
  assert.ok(withWa.html.includes('593999999999'));
  assert.ok(withWa.text.includes('📲 Chatear por WhatsApp: https://wa.me/593999999999'));

  // Con WhatsApp desactivado
  const withoutWa = renderOutreach({ ...SAMPLE_OUTREACH, include_whatsapp: false });
  assert.ok(!withoutWa.html.includes('Chatear por WhatsApp'));
  assert.ok(!withoutWa.text.includes('Chatear por WhatsApp'));
});

test('renderAgencyReply creates official branded agency frames with WhatsApp and signature', async () => {
  const { renderAgencyReply } = await import('../lib/outreach.ts');
  const result = renderAgencyReply({
    replyText: 'Hola Bryan, te paso los detalles.',
    subject: 'Re: Consulta comercial',
    senderEmail: 'bryanarcos@rifx-marketing.com',
    clientName: 'Bryan Arcos',
    clientBusiness: 'SDSD',
    originalMessage: 'Recibido',
    whatsAppPhone: '+593 98 391 0712',
  });

  assert.ok(result.html.includes('RIFX MARKETING'));
  assert.ok(result.html.includes('#103260'));
  assert.ok(result.html.includes('SDSD'));
  assert.ok(result.html.includes('Recibido'));
  assert.ok(result.html.includes('https://wa.me/593983910712'));
  assert.ok(result.html.includes('Chatear por WhatsApp'));
  assert.ok(!result.html.includes('Conversar por WhatsApp (+593'));
  assert.ok(result.html.includes('Bryan Arcos'));
  assert.ok(result.html.includes('bryanarcos@rifx-marketing.com'));
  assert.ok(result.text.includes('Bryan Arcos'));
  assert.ok(result.text.includes('https://wa.me/593983910712'));

  // Test optional WhatsApp disabled
  const resultNoWa = renderAgencyReply({
    replyText: 'Solo correo sin WhatsApp.',
    subject: 'Sin WA',
    includeWhatsApp: false,
  });
  assert.ok(!resultNoWa.html.includes('wa.me'));
  assert.ok(!resultNoWa.html.includes('Chatear por WhatsApp'));
  assert.ok(!resultNoWa.text.includes('wa.me'));
});

test('parseBulkRecipientList extracts emails, businesses and eliminates duplicates', async () => {
  const { parseBulkRecipientList } = await import('../lib/outreach.ts');
  const input = `
    ventas@dentalguayaquil.com, Clínica Dental Guayaquil
    Muebles Ambato <contacto@mueblesambato.ec>
    info@restaurantequito.com
    ventas@dentalguayaquil.com, Otra sucursal (duplicado)
    correo-invalido-sin-arroba
  `;
  const result = parseBulkRecipientList(input);
  assert.equal(result.validItems.length, 3);
  assert.equal(result.validItems[0].email, 'ventas@dentalguayaquil.com');
  assert.equal(result.validItems[0].business, 'Clínica Dental Guayaquil');
  assert.equal(result.validItems[1].email, 'contacto@mueblesambato.ec');
  assert.equal(result.validItems[1].business, 'Muebles Ambato');
  assert.equal(result.validItems[2].email, 'info@restaurantequito.com');
  assert.equal(result.validItems[2].business, 'su negocio');
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.invalidLines.length, 1);
});

test('personalizeProposal replaces {{negocio}}, {{precio}} and other variables', async () => {
  const { personalizeProposal } = await import('../lib/outreach.ts');
  const tpl = 'Hola {{negocio}}, te ofrecemos nuestro servicio por {{precio}}. Escribe a {{correo}}.';
  const out = personalizeProposal(tpl, {
    business: 'Óptica Moderna',
    price: 'USD 350',
    email: 'contacto@opticamoderna.com',
  });
  assert.equal(out, 'Hola Óptica Moderna, te ofrecemos nuestro servicio por USD 350. Escribe a contacto@opticamoderna.com.');
});

test('deleteOutreachMessages validates uids correctly', async () => {
  const { deleteOutreachMessages } = await import('../lib/outreach-imap.ts');
  const resEmpty = await deleteOutreachMessages([]);
  assert.equal(resEmpty.success, false);
  assert.equal(resEmpty.count, 0);

  const resInvalid = await deleteOutreachMessages(['abc', 'hack;DROP TABLE', '']);
  assert.equal(resInvalid.success, false);
  assert.equal(resInvalid.count, 0);
});


