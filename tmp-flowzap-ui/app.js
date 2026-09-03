const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const viewMeta = {
  dashboard: ['Dashboard', 'Resumen general de tu operación de WhatsApp'],
  inbox: ['Conversaciones', 'Atiende clientes y controla cuándo responde el bot'],
  contacts: ['Contactos', 'CRM sencillo con etiquetas, notas y datos personalizados'],
  team: ['Equipo', 'Administra asesores, supervisores y disponibilidad'],
  builder: ['Constructor', 'Diseña automatizaciones con reglas y bloques de IA opcionales'],
  ai: ['FlowZap AI', 'Módulo Premium con proveedor seleccionable, créditos y control de costos'],
  versions: ['Versiones', 'Consulta y restaura versiones anteriores del bot'],
  settings: ['Configuración', 'Estado de WhatsApp y datos para conectar Meta Cloud API']
};

const blockPalette = [
  { type: 'message', icon: '💬', label: 'Mensaje', desc: 'Enviar texto' },
  { type: 'menu', icon: '🔘', label: 'Menú', desc: 'Opciones numeradas' },
  { type: 'question', icon: '✍️', label: 'Pregunta', desc: 'Guardar respuesta' },
  { type: 'condition', icon: '🔀', label: 'Condición', desc: 'Reglas Sí / No' },
  { type: 'media', icon: '🖼️', label: 'Multimedia', desc: 'Imagen, PDF, video...' },
  { type: 'tag', icon: '🏷️', label: 'Etiqueta', desc: 'Agregar o quitar tag' },
  { type: 'ai', icon: '🧠', label: 'IA Premium', desc: 'Generar respuesta con IA' },
  { type: 'wait', icon: '⏳', label: 'Esperar', desc: 'Pausa del flujo' },
  { type: 'human', icon: '👤', label: 'Asesor', desc: 'Pausar el bot' },
  { type: 'end', icon: '⛔', label: 'Final', desc: 'Cerrar conversación' }
];

const typeMeta = {
  start: { icon: '▶️', name: 'Inicio' },
  message: { icon: '💬', name: 'Mensaje' },
  menu: { icon: '🔘', name: 'Menú' },
  question: { icon: '✍️', name: 'Pregunta' },
  condition: { icon: '🔀', name: 'Condición' },
  media: { icon: '🖼️', name: 'Multimedia' },
  tag: { icon: '🏷️', name: 'Etiqueta' },
  ai: { icon: '🧠', name: 'IA Premium' },
  wait: { icon: '⏳', name: 'Esperar' },
  human: { icon: '👤', name: 'Asesor' },
  end: { icon: '⛔', name: 'Final' }
};

const state = {
  view: 'dashboard', status: null, poll: null,
  flow: null, selectedId: null, dirty: false,
  history: [], historyIndex: -1, historyTimer: null,
  simSession: null, inboxPhone: null, toastTimer: null
};

function esc(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[c])); }
function uid(type) { return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`; }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(d);
}
function phoneLabel(phone) { return phone ? `+${String(phone).replace(/^\+/, '')}` : 'Sin número'; }
function money(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(v||0)); }
function initials(name = '') { return (name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('') || '?').toUpperCase(); }
async function api(url, options = {}) {
  const r = await fetch(url, options);
  const type = r.headers.get('content-type') || '';
  const data = type.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(data?.error || data?.errors?.join('\n') || (typeof data === 'string' ? data : 'Error de servidor'));
  return data;
}
function showToast(message, kind = '') {
  const el = $('#toast'); el.textContent = message; el.className = `toast ${kind}`;
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function openGeneric(title, subtitle, html) {
  $('#genericTitle').textContent = title; $('#genericSubtitle').textContent = subtitle || ''; $('#genericBody').innerHTML = html;
  $('#genericModal').classList.remove('hidden'); $('#genericModal').setAttribute('aria-hidden','false');
}
function closeModal(which) {
  const id = which === 'sim' ? '#simModal' : '#genericModal'; $(id).classList.add('hidden'); $(id).setAttribute('aria-hidden','true');
}

async function loadStatus() {
  try {
    state.status = await api('/api/status');
    const label = state.status.whatsappConfigured ? `● WhatsApp conectado${state.status.graphVersion ? ` · ${state.status.graphVersion}` : ''}` : '● Modo demo';
    $('#sideStatus').textContent = label;
    $('#sideStatus').classList.toggle('live', Boolean(state.status.whatsappConfigured));
  } catch {}
}
async function refreshUnread() {
  try {
    const d = await api('/api/dashboard');
    const badge = $('#navUnread'); badge.textContent = d.unread || 0; badge.classList.toggle('hidden', !d.unread);
  } catch {}
}

function setHeader(view) {
  const [title, subtitle] = viewMeta[view]; $('#pageTitle').textContent = title; $('#pageSubtitle').textContent = subtitle; $('#headerActions').innerHTML = '';
}
function setActiveNav(view) { $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view)); }
function stopPolling() { if (state.poll) clearInterval(state.poll); state.poll = null; }
async function navigate(view) {
  stopPolling(); state.view = view; setActiveNav(view); setHeader(view);
  try {
    if (view === 'dashboard') await renderDashboard();
    if (view === 'inbox') await renderInbox();
    if (view === 'contacts') await renderContacts();
    if (view === 'team') await renderTeam();
    if (view === 'builder') await renderBuilder();
    if (view === 'ai') await renderAI();
    if (view === 'versions') await renderVersions();
    if (view === 'settings') await renderSettings();
  } catch (e) { $('#viewRoot').innerHTML = `<div class="error-panel"><strong>No se pudo cargar esta sección</strong><p>${esc(e.message)}</p></div>`; }
  refreshUnread();
}

async function renderDashboard() {
  const d = await api('/api/dashboard');
  $('#headerActions').innerHTML = state.status?.whatsappConfigured ? '' : `<button id="seedDemo" class="btn secondary">✨ Cargar datos demo</button>`;
  $('#viewRoot').innerHTML = `
    <div class="page-scroll">
      <div class="stat-grid">
        ${statCard('💬','Conversaciones',d.conversations,'Total registradas')}
        ${statCard('📥','Pendientes',d.unread,'Mensajes sin leer')}
        ${statCard('👥','Contactos',d.contacts,'En tu CRM')}
        ${statCard('👤','Con asesor',d.human,'Bot pausado')}
        ${statCard('✉️','Mensajes hoy',d.messagesToday,'Entrantes y salientes')}
        ${statCard('🟢','Abiertas',d.open,'Conversaciones activas')}
      </div>
      <div class="two-col-page">
        <section class="card section-card">
          <div class="card-head"><div><h3>Actividad reciente</h3><p>Últimas conversaciones</p></div><button class="btn ghost small" data-goto="inbox">Abrir bandeja</button></div>
          <div class="recent-list">
            ${d.recent.length ? d.recent.map(c => `<button class="recent-row" data-open-phone="${esc(c.phone)}"><span class="avatar">${esc(initials(c.phone))}</span><span class="recent-main"><strong>${esc(phoneLabel(c.phone))}</strong><small>${esc(c.lastMessage || 'Sin mensajes')}</small></span><span class="recent-time">${esc(fmtDate(c.lastMessageAt))}</span></button>`).join('') : `<div class="empty-mini"><span>💭</span><strong>Aún no hay conversaciones</strong><p>Cuando conectes WhatsApp aparecerán aquí. En modo demo puedes cargar datos de ejemplo.</p></div>`}
          </div>
        </section>
        <section class="card section-card">
          <div class="card-head"><div><h3>Estado del sistema</h3><p>Preparación de la integración</p></div></div>
          <div class="check-list">
            ${checkRow(true,'Motor de flujos','Funcionando')}
            ${checkRow(true,'Bandeja y CRM','Funcionando')}
            ${checkRow(Boolean(state.status?.webhookVerifyTokenConfigured),'Token de verificación',state.status?.webhookVerifyTokenConfigured?'Configurado':'Pendiente')}
            ${checkRow(Boolean(state.status?.signatureValidationConfigured),'Firma de Meta',state.status?.signatureValidationConfigured?'Configurada':'Pendiente')}
            ${checkRow(Boolean(state.status?.whatsappConfigured),'WhatsApp Cloud API',state.status?.whatsappConfigured?'Conectado':'Modo demo')}
            ${checkRow(Boolean(state.status?.aiReady),'FlowZap AI',state.status?.aiReady?`${providerLabel(state.status.aiProvider)} · ${Number(state.status.aiCredits||0).toLocaleString('es')} créditos`:state.status?.aiEnabled?'Configuración pendiente':'Opcional · desactivado')}
          </div>
          <div class="dashboard-actions"><button class="btn primary full" data-goto="settings">Configurar WhatsApp</button><button class="btn secondary full" data-goto="ai">🧠 FlowZap AI</button></div>
        </section>
      </div>
    </div>`;
  $('#seedDemo')?.addEventListener('click', async () => { await api('/api/demo/seed',{method:'POST'}); showToast('Datos demo cargados ✅','success'); renderDashboard(); refreshUnread(); });
  $$('[data-goto]').forEach(b => b.addEventListener('click',()=>navigate(b.dataset.goto)));
  $$('[data-open-phone]').forEach(b => b.addEventListener('click',()=>{ state.inboxPhone=b.dataset.openPhone; navigate('inbox'); }));
}
function statCard(icon,label,value,sub){ return `<div class="stat-card"><div class="stat-icon">${icon}</div><div><span>${esc(label)}</span><strong>${Number(value||0).toLocaleString('es')}</strong><small>${esc(sub)}</small></div></div>`; }
function checkRow(ok,label,value){ return `<div class="check-row"><span class="check-icon ${ok?'ok':'pending'}">${ok?'✓':'!'}</span><div><strong>${esc(label)}</strong><small>${esc(value)}</small></div></div>`; }

async function renderInbox() {
  const [conversations, team] = await Promise.all([api('/api/conversations'), api('/api/team')]);
  $('#headerActions').innerHTML = `<button id="refreshInbox" class="btn secondary">↻ Actualizar</button>`;
  $('#viewRoot').innerHTML = `
    <div class="inbox-grid">
      <aside class="conversation-list-panel">
        <div class="inbox-search"><input id="inboxSearch" placeholder="Buscar cliente o mensaje..."/><select id="inboxStatus"><option value="">Todas</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select></div>
        <div id="conversationList" class="conversation-list">${conversationListHTML(conversations)}</div>
      </aside>
      <section id="conversationChat" class="conversation-chat"><div class="empty-center"><span>💬</span><h3>Selecciona una conversación</h3><p>Desde aquí puedes responder manualmente y pausar o reactivar el bot.</p></div></section>
      <aside id="conversationInfo" class="conversation-info"><div class="empty-center small"><span>👤</span><p>Los datos del contacto aparecerán aquí.</p></div></aside>
    </div>`;
  bindConversationRows(team);
  $('#refreshInbox').addEventListener('click',()=>renderInbox().then(()=>state.inboxPhone&&openConversation(state.inboxPhone,team)));
  let searchTimer;
  const doSearch = () => { clearTimeout(searchTimer); searchTimer=setTimeout(async()=>{ const q=$('#inboxSearch').value; const status=$('#inboxStatus').value; const list=await api(`/api/conversations?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`); $('#conversationList').innerHTML=conversationListHTML(list); bindConversationRows(team); },220); };
  $('#inboxSearch').addEventListener('input',doSearch); $('#inboxStatus').addEventListener('change',doSearch);
  if (state.inboxPhone) await openConversation(state.inboxPhone, team);
  else if (conversations[0]) { state.inboxPhone = conversations[0].phone; await openConversation(state.inboxPhone, team); }
  state.poll = setInterval(async()=>{ if(state.view!=='inbox')return; try{ const list=await api('/api/conversations'); const listEl=$('#conversationList'); if(listEl){ listEl.innerHTML=conversationListHTML(list); bindConversationRows(team); } }catch{} },5000);
}
function conversationListHTML(items) {
  if (!items.length) return `<div class="empty-mini padded"><span>📭</span><strong>Sin conversaciones</strong><p>Las conversaciones entrantes aparecerán automáticamente aquí.</p></div>`;
  return items.map(c => {
    const name=c.contact?.name || phoneLabel(c.phone); const active=state.inboxPhone===c.phone?'active':'';
    return `<button class="conversation-row ${active}" data-phone="${esc(c.phone)}"><span class="avatar">${esc(initials(name))}</span><span class="conv-main"><span><strong>${esc(name)}</strong><time>${esc(fmtDate(c.lastMessageAt))}</time></span><small>${esc(c.lastMessage||'Sin mensajes')}</small><em>${c.botPaused?'👤 Humano':'🤖 Bot'}${c.advisor?` · ${esc(c.advisor.name)}`:''}</em></span>${c.unread?`<b class="unread-dot">${c.unread}</b>`:''}</button>`;
  }).join('');
}
function bindConversationRows(team){ $$('.conversation-row').forEach(row=>row.addEventListener('click',()=>{ state.inboxPhone=row.dataset.phone; $$('.conversation-row').forEach(x=>x.classList.toggle('active',x.dataset.phone===state.inboxPhone)); openConversation(state.inboxPhone,team); })); }
async function openConversation(phone, team) {
  let c; try { c=await api(`/api/conversations/${encodeURIComponent(phone)}`); } catch(e){ showToast(e.message,'error'); return; }
  const name=c.contact?.name || phoneLabel(phone);
  $('#conversationChat').innerHTML = `
    <div class="chat-header"><div class="chat-person"><span class="avatar">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><small>${esc(phoneLabel(phone))} · ${c.botPaused?'👤 Atención humana':'🤖 Bot activo'}</small></div></div><div class="chat-head-actions"><button id="toggleBot" class="btn ${c.botPaused?'primary':'secondary'} small">${c.botPaused?'▶ Reactivar bot':'⏸ Pausar bot'}</button><button id="toggleStatus" class="btn ghost small">${c.status==='closed'?'Reabrir':'Cerrar'}</button></div></div>
    <div id="liveChat" class="chat-area inbox-chat">${(c.messages||[]).map(messageBubble).join('') || `<div class="empty-mini"><p>Sin mensajes todavía.</p></div>`}</div>
    <div class="chat-compose"><input id="manualMessage" placeholder="Escribe como asesor..." autocomplete="off"/><button id="manualSend" class="btn primary">Enviar</button></div>`;
  $('#conversationInfo').innerHTML = `
    <div class="contact-side-head"><span class="avatar large">${esc(initials(name))}</span><h3>${esc(name)}</h3><p>${esc(phoneLabel(phone))}</p></div>
    <div class="info-block"><label>Asignado a</label><select id="advisorSelect"><option value="">Sin asignar</option>${team.map(t=>`<option value="${esc(t.id)}" ${t.id===c.assignedTo?'selected':''}>${esc(t.name)} · ${esc(t.status)}</option>`).join('')}</select></div>
    <div class="info-block"><label>Etiquetas</label><div class="tag-wrap">${(c.contact?.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('') || '<span class="muted">Sin etiquetas</span>'}</div></div>
    <div class="info-block"><label>Notas</label><p>${esc(c.contact?.notes||'Sin notas')}</p></div>
    <div class="info-block"><label>Campos</label>${Object.entries(c.contact?.fields||{}).map(([k,v])=>`<div class="kv"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('') || '<p class="muted">Sin campos personalizados</p>'}</div>
    <button id="editInboxContact" class="btn ghost full">Editar contacto</button>`;
  const chat=$('#liveChat'); chat.scrollTop=chat.scrollHeight;
  $('#manualSend').addEventListener('click',()=>sendManual(phone)); $('#manualMessage').addEventListener('keydown',e=>{if(e.key==='Enter')sendManual(phone);});
  $('#toggleBot').addEventListener('click',async()=>{ await api(`/api/conversations/${encodeURIComponent(phone)}/bot`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paused:!c.botPaused})}); showToast(c.botPaused?'Bot reactivado 🤖':'Bot pausado para atención humana 👤','success'); openConversation(phone,team); });
  $('#toggleStatus').addEventListener('click',async()=>{ await api(`/api/conversations/${encodeURIComponent(phone)}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:c.status==='closed'?'open':'closed'})}); showToast('Estado actualizado','success'); openConversation(phone,team); });
  $('#advisorSelect').addEventListener('change',async e=>{ await api(`/api/conversations/${encodeURIComponent(phone)}/assign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({advisorId:e.target.value})}); showToast('Asesor asignado ✅','success'); });
  $('#editInboxContact').addEventListener('click',()=>openContactEditor(c.contact,()=>openConversation(phone,team)));
  refreshUnread();
}
function messageBubble(m) {
  const cls=m.direction==='in'?'bot':'user'; const who=m.senderType==='human'?'Asesor':m.senderType==='bot'?'Bot':'';
  const media=m.type==='media'&&m.media?`<div class="media-chip">📎 ${esc(m.media.type||'archivo')} · ${esc(m.media.filename||m.media.url||'')}</div>`:'';
  return `<div class="bubble ${cls}">${media}${m.text?`<div>${esc(m.text)}</div>`:''}<small>${who?`${esc(who)} · `:''}${esc(fmtDate(m.createdAt))}</small></div>`;
}
async function sendManual(phone) {
  const input=$('#manualMessage'), value=input.value.trim(); if(!value)return; input.disabled=true;
  try { await api(`/api/conversations/${encodeURIComponent(phone)}/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value,senderId:'team-admin'})}); input.value=''; const team=await api('/api/team'); await openConversation(phone,team); } catch(e){showToast(e.message,'error');} finally{input.disabled=false;}
}

async function renderContacts() {
  const contacts=await api('/api/contacts');
  $('#headerActions').innerHTML=`<input id="contactSearch" class="header-search" placeholder="Buscar contacto..."/>`;
  $('#viewRoot').innerHTML=`<div class="page-scroll"><div class="card table-card"><table><thead><tr><th>Contacto</th><th>Teléfono</th><th>Etiquetas</th><th>Última actividad</th><th></th></tr></thead><tbody id="contactsBody">${contactsHTML(contacts)}</tbody></table></div></div>`;
  bindContactRows(); let timer; $('#contactSearch').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{const list=await api(`/api/contacts?q=${encodeURIComponent($('#contactSearch').value)}`);$('#contactsBody').innerHTML=contactsHTML(list);bindContactRows();},220);});
}
function contactsHTML(items){return items.length?items.map(c=>`<tr><td><div class="table-person"><span class="avatar">${esc(initials(c.name||c.phone))}</span><strong>${esc(c.name||'Sin nombre')}</strong></div></td><td>${esc(phoneLabel(c.phone))}</td><td><div class="tag-wrap">${(c.tags||[]).slice(0,4).map(t=>`<span class="tag">${esc(t)}</span>`).join('')||'<span class="muted">—</span>'}</div></td><td>${esc(fmtDate(c.lastSeenAt))}</td><td><button class="btn ghost small" data-edit-contact="${esc(c.phone)}">Editar</button></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-mini padded"><span>👥</span><strong>No hay contactos todavía</strong></div></td></tr>`;}
function bindContactRows(){ $$('[data-edit-contact]').forEach(b=>b.addEventListener('click',async()=>{const c=await api(`/api/contacts/${encodeURIComponent(b.dataset.editContact)}`);openContactEditor(c,renderContacts);})); }
function openContactEditor(contact,onSaved){
  const fields=contact.fields||{};
  openGeneric('Editar contacto',phoneLabel(contact.phone),`<form id="contactForm"><div class="field"><label>Nombre</label><input id="cfName" value="${esc(contact.name||'')}"/></div><div class="field"><label>Etiquetas <span class="label-help">separadas por coma</span></label><input id="cfTags" value="${esc((contact.tags||[]).join(', '))}" placeholder="VIP, Mayorista"/></div><div class="field"><label>Notas</label><textarea id="cfNotes">${esc(contact.notes||'')}</textarea></div><div class="divider"></div><div class="field-row"><div class="field"><label>Campo 1</label><input id="cfKey1" value="${esc(Object.keys(fields)[0]||'')}" placeholder="ciudad"/></div><div class="field"><label>Valor</label><input id="cfVal1" value="${esc(Object.values(fields)[0]||'')}"/></div></div><div class="field-row"><div class="field"><label>Campo 2</label><input id="cfKey2" value="${esc(Object.keys(fields)[1]||'')}" placeholder="empresa"/></div><div class="field"><label>Valor</label><input id="cfVal2" value="${esc(Object.values(fields)[1]||'')}"/></div></div><button class="btn primary full" type="submit">Guardar contacto</button></form>`);
  $('#contactForm').addEventListener('submit',async e=>{e.preventDefault();const custom={};[[1],[2]].forEach(([i])=>{const k=$(`#cfKey${i}`).value.trim();if(k)custom[k]=$(`#cfVal${i}`).value.trim();});await api(`/api/contacts/${encodeURIComponent(contact.phone)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#cfName').value.trim(),tags:$('#cfTags').value.split(',').map(x=>x.trim()).filter(Boolean),notes:$('#cfNotes').value,fields:custom})});closeModal('generic');showToast('Contacto guardado ✅','success');onSaved?.();});
}

async function renderTeam() {
  const team=await api('/api/team');
  $('#headerActions').innerHTML=`<button id="addTeam" class="btn primary">+ Añadir usuario</button>`;
  $('#viewRoot').innerHTML=`<div class="page-scroll"><div class="team-grid">${team.map(t=>teamCard(t)).join('')}</div></div>`;
  $('#addTeam').addEventListener('click',openNewTeamMember);
  $$('[data-team-status]').forEach(sel=>sel.addEventListener('change',async()=>{await api(`/api/team/${sel.dataset.teamStatus}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:sel.value})});showToast('Disponibilidad actualizada','success');}));
}
function teamCard(t){return `<div class="card team-card"><div class="team-top"><span class="avatar large">${esc(initials(t.name))}</span><div><h3>${esc(t.name)}</h3><p>${esc(t.email||'Sin correo')}</p></div></div><div class="team-meta"><span class="role-pill">${esc(t.role)}</span><select data-team-status="${esc(t.id)}"><option ${t.status==='Disponible'?'selected':''}>Disponible</option><option ${t.status==='Ocupado'?'selected':''}>Ocupado</option><option ${t.status==='Desconectado'?'selected':''}>Desconectado</option></select></div></div>`;}
function openNewTeamMember(){openGeneric('Nuevo usuario','Crea un asesor, supervisor o administrador',`<form id="teamForm"><div class="field"><label>Nombre</label><input id="tmName" required placeholder="Nombre completo"/></div><div class="field"><label>Correo</label><input id="tmEmail" type="email" placeholder="usuario@empresa.com"/></div><div class="field"><label>Rol</label><select id="tmRole"><option>Asesor</option><option>Supervisor</option><option>Administrador</option></select></div><button class="btn primary full" type="submit">Crear usuario</button></form>`);$('#teamForm').addEventListener('submit',async e=>{e.preventDefault();await api('/api/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#tmName').value,email:$('#tmEmail').value,role:$('#tmRole').value})});closeModal('generic');showToast('Usuario creado ✅','success');renderTeam();});}


// ------------------------- FLOWZAP AI PREMIUM -------------------------
function providerLabel(p){return ({openai:'OpenAI',gemini:'Google Gemini',anthropic:'Anthropic',compatible:'API compatible'})[p]||p;}
function aiUsageRows(items){return items.length?items.map(x=>`<tr><td>${esc(fmtDate(x.createdAt))}</td><td><strong>${esc(providerLabel(x.provider))}</strong><small class="table-sub">${esc(x.model||'')}</small></td><td>${Number(x.inputTokens||0).toLocaleString('es')} / ${Number(x.outputTokens||0).toLocaleString('es')}</td><td><strong>${Number(x.credits||0).toLocaleString('es')}</strong></td><td>${money(x.estimatedCost)}</td><td>${esc(x.source||'flow')}</td></tr>`).join(''):`<tr><td colspan="6"><div class="empty-mini padded"><span>🧠</span><strong>Aún no hay consumo IA</strong><p>Las pruebas y los bloques IA aparecerán aquí cuando se ejecuten.</p></div></td></tr>`;}
async function renderAI(){
  const [summary,usage]=await Promise.all([api('/api/ai/summary'),api('/api/ai/usage?limit=50')]);
  const c=summary.config,b=c.billing;
  $('#headerActions').innerHTML=`<span class="status-pill ${summary.ready?'live':''}">${summary.ready?'● IA lista':c.enabled?'● Configuración pendiente':'● IA desactivada'}</span><button id="aiRefresh" class="btn secondary">↻ Actualizar</button>`;
  $('#viewRoot').innerHTML=`<div class="page-scroll ai-page">
    <div class="ai-hero card">
      <div><span class="premium-chip">🧠 FLOWZAP AI · PREMIUM</span><h2>IA opcional, facturada por créditos</h2><p>El chatbot normal continúa funcionando sin IA. Tú eliges el proveedor/modelo y defines cuánto valen los créditos para tu negocio.</p></div>
      <div class="ai-hero-state"><strong>${Number(summary.creditsAvailable||0).toLocaleString('es')}</strong><span>créditos disponibles</span>${summary.lowBalance?'<em>⚠️ Saldo bajo</em>':''}</div>
    </div>
    <div class="stat-grid ai-stats">
      ${statCard('🪙','Créditos disponibles',summary.creditsAvailable,'Saldo actual')}
      ${statCard('📉','Usados este mes',summary.creditsUsedThisMonth,`${summary.calls} llamadas IA`)}
      ${aiMoneyCard('💸','Costo proveedor',summary.estimatedCost,'Estimado este mes')}
      ${aiMoneyCard('💰','Venta estimada',summary.estimatedTotalRevenue,'Módulo + consumo')}
      ${aiMoneyCard('📈','Margen estimado',summary.estimatedMargin,'Venta menos costo proveedor')}
    </div>
    <div class="ai-layout">
      <section class="card section-card ai-config-card">
        <div class="card-head"><div><h3>Proveedor y modelo</h3><p>Tú decides qué inteligencia artificial utiliza FlowZap</p></div><span class="provider-badge">${esc(providerLabel(c.provider))}</span></div>
        <form id="aiConfigForm">
          <label class="toggle-row ai-enable"><input id="aiEnabled" type="checkbox" ${c.enabled?'checked':''}/><span><strong>Activar FlowZap AI</strong><small>Si está apagado, ningún bloque IA podrá consumir saldo.</small></span></label>
          <div class="field-row"><div class="field"><label>Proveedor</label><select id="aiProvider"><option value="openai" ${c.provider==='openai'?'selected':''}>OpenAI</option><option value="gemini" ${c.provider==='gemini'?'selected':''}>Google Gemini</option><option value="anthropic" ${c.provider==='anthropic'?'selected':''}>Anthropic</option><option value="compatible" ${c.provider==='compatible'?'selected':''}>API compatible</option></select></div><div class="field"><label>Modelo</label><input id="aiModel" value="${esc(c.model||'')}" placeholder="ID exacto del modelo"/></div></div>
          <div id="compatibleEndpointWrap" class="field ${c.provider==='compatible'?'':'hidden'}"><label>Endpoint compatible</label><input id="aiCompatibleEndpoint" value="${esc(c.compatibleEndpoint||'')}" placeholder="https://servidor/v1/chat/completions"/></div>
          <div class="field"><label>API Key</label><input id="aiApiKey" type="password" autocomplete="new-password" placeholder="${c.apiKeyConfigured?`Configurada (${esc(c.apiKeySource)}) · deja vacío para conservarla`:'Pega aquí la API Key del proveedor'}"/><small class="field-note">La clave guardada desde el panel se cifra localmente y nunca vuelve a mostrarse.</small></div>
          <label class="tiny-check"><input id="aiClearKey" type="checkbox"/> Borrar la API Key guardada al guardar</label>
          <div class="field"><label>Instrucción global de la IA</label><textarea id="aiSystemPrompt">${esc(c.systemPrompt||'')}</textarea></div>
          <div class="field"><label>Máximo de tokens de salida</label><input id="aiMaxOutput" type="number" min="32" max="8192" value="${Number(c.maxOutputTokens||350)}"/></div>
          <div class="divider"></div><h4 class="form-section-title">Modelo de créditos y negocio</h4>
          <div class="field-row"><div class="field"><label>Créditos / 1K tokens entrada</label><input id="aiCreditIn" type="number" min="0" step="0.1" value="${Number(b.creditsPer1kInput||0)}"/></div><div class="field"><label>Créditos / 1K tokens salida</label><input id="aiCreditOut" type="number" min="0" step="0.1" value="${Number(b.creditsPer1kOutput||0)}"/></div></div>
          <div class="field-row"><div class="field"><label>Mínimo créditos por consulta</label><input id="aiCreditMin" type="number" min="0" step="1" value="${Number(b.minCreditsPerRequest||0)}"/></div><div class="field"><label>Aviso saldo bajo</label><input id="aiLowBalance" type="number" min="0" step="1" value="${Number(b.lowBalanceThreshold||0)}"/></div></div>
          <div class="field-row"><div class="field"><label>Costo proveedor / 1M entrada ($)</label><input id="aiCostIn" type="number" min="0" step="0.0001" value="${Number(b.providerCostInputPer1M||0)}"/></div><div class="field"><label>Costo proveedor / 1M salida ($)</label><input id="aiCostOut" type="number" min="0" step="0.0001" value="${Number(b.providerCostOutputPer1M||0)}"/></div></div>
          <div class="field-row"><div class="field"><label>Precio venta / 1.000 créditos ($)</label><input id="aiSalePrice" type="number" min="0" step="0.01" value="${Number(b.salePricePer1000Credits||0)}"/></div><div class="field"><label>Cargo mensual módulo AI ($)</label><input id="aiMonthlyPrice" type="number" min="0" step="0.01" value="${Number(b.monthlyAddonPrice||0)}"/></div></div>
          <label class="toggle-row"><input id="aiHardStop" type="checkbox" ${b.hardStop?'checked':''}/><span><strong>Bloquear cuando no haya créditos suficientes</strong><small>Evita seguir generando costo del proveedor sin saldo disponible.</small></span></label>
          <div class="info-note">💡 Los precios del proveedor cambian según el modelo. FlowZap no los impone: tú escribes aquí tus costos reales y tu precio de venta, por lo que puedes manejar tu propio margen.</div>
          <button class="btn primary full" type="submit">Guardar configuración IA</button>
        </form>
      </section>
      <div class="ai-side-stack">
        <section class="card section-card"><div class="card-head"><div><h3>Recargar créditos</h3><p>Saldo que venderás/administrarás</p></div></div><form id="aiTopupForm"><div class="field"><label>Cantidad</label><input id="aiTopup" type="number" min="1" step="1" value="1000"/></div><div class="field"><label>Nota</label><input id="aiTopupNote" value="Recarga manual"/></div><button class="btn secondary full" type="submit">+ Agregar créditos</button></form><div class="quick-credit-row"><button data-credit="1000" class="btn ghost small">+1.000</button><button data-credit="5000" class="btn ghost small">+5.000</button><button data-credit="10000" class="btn ghost small">+10.000</button></div></section>
        <section class="card section-card"><div class="card-head"><div><h3>Probar IA</h3><p>Una prueba real consume créditos</p></div></div><div class="field"><label>Mensaje de prueba</label><textarea id="aiTestPrompt" placeholder="Ej. Responde en una frase: ¿Cuál es nuestro horario?">Hola, preséntate brevemente como asistente de FlowZap.</textarea></div><button id="aiTestBtn" class="btn primary full">🧪 Ejecutar prueba</button><div id="aiTestResult" class="ai-test-result hidden"></div></section>
        <section class="card section-card"><div class="card-head"><div><h3>Cómo se cobra</h3><p>Separado de FlowZap base</p></div></div><div class="billing-example"><div><span>FlowZap base</span><strong>Tu plan normal</strong></div><b>+</b><div><span>Módulo AI</span><strong>${money(b.monthlyAddonPrice)} / mes</strong></div><b>+</b><div><span>Consumo</span><strong>${money(b.salePricePer1000Credits)} / 1K créditos</strong></div></div></section>
      </div>
    </div>
    <section class="card table-card ai-usage-table"><div class="card-head padded-head"><div><h3>Consumo IA reciente</h3><p>Tokens, créditos, costo y origen de cada ejecución</p></div></div><table><thead><tr><th>Fecha</th><th>Proveedor / modelo</th><th>Tokens E / S</th><th>Créditos</th><th>Costo</th><th>Origen</th></tr></thead><tbody>${aiUsageRows(usage)}</tbody></table></section>
  </div>`;
  $('#aiRefresh').addEventListener('click',renderAI);
  $('#aiProvider').addEventListener('change',e=>$('#compatibleEndpointWrap').classList.toggle('hidden',e.target.value!=='compatible'));
  $('#aiConfigForm').addEventListener('submit',async e=>{e.preventDefault();try{const payload={enabled:$('#aiEnabled').checked,provider:$('#aiProvider').value,model:$('#aiModel').value.trim(),compatibleEndpoint:$('#aiCompatibleEndpoint').value.trim(),apiKey:$('#aiApiKey').value.trim(),clearApiKey:$('#aiClearKey').checked,systemPrompt:$('#aiSystemPrompt').value,maxOutputTokens:Number($('#aiMaxOutput').value),billing:{creditsPer1kInput:Number($('#aiCreditIn').value),creditsPer1kOutput:Number($('#aiCreditOut').value),minCreditsPerRequest:Number($('#aiCreditMin').value),providerCostInputPer1M:Number($('#aiCostIn').value),providerCostOutputPer1M:Number($('#aiCostOut').value),salePricePer1000Credits:Number($('#aiSalePrice').value),monthlyAddonPrice:Number($('#aiMonthlyPrice').value),lowBalanceThreshold:Number($('#aiLowBalance').value),hardStop:$('#aiHardStop').checked}};await api('/api/ai/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});showToast('Configuración IA guardada ✅','success');await loadStatus();renderAI();}catch(err){showToast(err.message,'error');}});
  $('#aiTopupForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/ai/credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:Number($('#aiTopup').value),note:$('#aiTopupNote').value})});showToast('Créditos agregados 🪙','success');renderAI();}catch(err){showToast(err.message,'error');}});
  $$('[data-credit]').forEach(btn=>btn.addEventListener('click',async()=>{try{await api('/api/ai/credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:Number(btn.dataset.credit),note:'Recarga rápida'})});showToast(`${Number(btn.dataset.credit).toLocaleString('es')} créditos agregados 🪙`,'success');renderAI();}catch(err){showToast(err.message,'error');}}));
  $('#aiTestBtn').addEventListener('click',async()=>{const btn=$('#aiTestBtn'),box=$('#aiTestResult'),prompt=$('#aiTestPrompt').value.trim();if(!prompt)return showToast('Escribe un mensaje de prueba.','error');btn.disabled=true;btn.textContent='Procesando...';box.classList.remove('hidden');box.innerHTML='Consultando al proveedor de IA…';try{const r=await api('/api/ai/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});box.innerHTML=`<strong>Respuesta</strong><p>${esc(r.text)}</p><small>Consumió ${Number(r.usage?.credits||0)} créditos · quedan ${Number(r.creditsRemaining||0).toLocaleString('es')}</small>`;}catch(err){box.innerHTML=`<strong>❌ No se pudo ejecutar</strong><p>${esc(err.message)}</p>`;}finally{btn.disabled=false;btn.textContent='🧪 Ejecutar prueba';}});
}
function aiMoneyCard(icon,label,value,sub){return `<div class="stat-card"><div class="stat-icon">${icon}</div><div><span>${esc(label)}</span><strong class="money-value">${money(value)}</strong><small>${esc(sub)}</small></div></div>`;}

// ------------------------- CONSTRUCTOR VISUAL -------------------------
function builderNode(id){ return state.flow?.nodes?.find(n=>n.id===id); }
function nodeSummary(node){
  switch(node.type){
    case 'start': return 'Punto de entrada del flujo';
    case 'message': return node.text||'Mensaje sin configurar';
    case 'menu': return node.prompt||`${(node.options||[]).length} opciones`;
    case 'question': return `${node.prompt||'Pregunta'}\n→ {{${node.variable||'respuesta'}}}`;
    case 'condition': return `${node.variable||'variable'} ${node.operator||'equals'} ${node.value||''}`;
    case 'media': return `${node.mediaType||'imagen'} · ${node.caption||node.url||'Sin archivo'}`;
    case 'tag': return `${node.action==='remove'?'Quitar':'Agregar'}: ${node.tag||'etiqueta'}`;
    case 'ai': return `IA → {{${node.saveVariable||'respuesta_ia'}}} · ${node.prompt||'Sin prompt'}`;
    case 'wait': return `Esperar ${node.seconds||5} segundos`;
    case 'human': return node.text||'Transferir a un asesor';
    case 'end': return 'Finalizar conversación'; default:return '';
  }
}
async function renderBuilder() {
  state.flow=await api('/api/flow'); state.selectedId=null; state.dirty=false; resetHistory();
  $('#headerActions').innerHTML=`<span id="dirtyBadge" class="badge warning hidden">Cambios sin guardar</span><button id="undoBtn" class="btn ghost square" title="Deshacer">↶</button><button id="redoBtn" class="btn ghost square" title="Rehacer">↷</button><button id="validateBtn" class="btn secondary">✓ Revisar</button><button id="testBtn" class="btn secondary">🧪 Probar</button><button id="saveBtn" class="btn secondary">Guardar</button><button id="publishBtn" class="btn primary">🚀 Publicar</button>`;
  $('#viewRoot').innerHTML=`
    <div class="builder-shell">
      <aside class="builder-left"><div class="flow-name-box"><label>Nombre del bot</label><input id="flowName" value="${esc(state.flow.name||'Mi chatbot')}"/></div><div class="panel-title">Bloques</div><p class="hint">Haz clic para añadirlos.</p><div id="palette" class="palette">${blockPalette.map(p=>`<button class="palette-item" data-add="${p.type}"><span class="palette-icon">${p.icon}</span><span><strong>${p.label}</strong><small>${p.desc}</small></span></button>`).join('')}</div><div class="builder-left-bottom"><button id="centerFlow" class="btn ghost full">Centrar flujo</button><button id="exportFlow" class="btn ghost full">Exportar JSON</button><label class="btn ghost full file-label">Importar JSON<input id="importFlow" type="file" accept="application/json" hidden/></label></div></aside>
      <main class="canvas-wrap"><div class="canvas-toolbar"><div class="node-search-wrap"><input id="nodeSearch" placeholder="🔎 Buscar bloque..."/><button id="findNode" class="btn ghost small">Buscar</button></div><span id="nodeCount">0 bloques</span></div><div id="canvas" class="canvas"><svg id="edges" class="edges"></svg><div id="nodesLayer" class="nodes-layer"></div></div></main>
      <aside class="builder-right"><div id="inspectorEmpty" class="empty-center"><span>⚙️</span><h3>Configura un bloque</h3><p>Selecciona un bloque para editar sus acciones y conexiones.</p></div><div id="inspector" class="inspector hidden"></div></aside>
    </div>`;
  renderBuilderNodes(); renderBuilderInspector(); setTimeout(centerFlow,100);
  $$('[data-add]').forEach(b=>b.addEventListener('click',()=>addNode(b.dataset.add)));
  $('#flowName').addEventListener('input',()=>{state.flow.name=$('#flowName').value;markDirty();});
  $('#saveBtn').addEventListener('click',()=>saveFlow()); $('#publishBtn').addEventListener('click',publishFlow); $('#testBtn').addEventListener('click',openSimulation); $('#validateBtn').addEventListener('click',showValidation);
  $('#centerFlow').addEventListener('click',centerFlow); $('#exportFlow').addEventListener('click',exportFlow); $('#importFlow').addEventListener('change',e=>e.target.files?.[0]&&importFlow(e.target.files[0]));
  $('#undoBtn').addEventListener('click',undoFlow); $('#redoBtn').addEventListener('click',redoFlow); $('#findNode').addEventListener('click',findNodeBySearch); $('#nodeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')findNodeBySearch();});
}
function resetHistory(){ state.history=[JSON.stringify(state.flow)];state.historyIndex=0;updateHistoryButtons(); }
function recordHistory(){ if(!state.flow)return;const snap=JSON.stringify(state.flow);if(state.history[state.historyIndex]===snap)return;state.history=state.history.slice(0,state.historyIndex+1);state.history.push(snap);if(state.history.length>60)state.history.shift();state.historyIndex=state.history.length-1;updateHistoryButtons(); }
function scheduleHistory(){clearTimeout(state.historyTimer);state.historyTimer=setTimeout(recordHistory,450);}
function updateHistoryButtons(){const u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=state.historyIndex<=0;if(r)r.disabled=state.historyIndex>=state.history.length-1;}
function undoFlow(){if(state.historyIndex<=0)return;state.historyIndex--;state.flow=JSON.parse(state.history[state.historyIndex]);state.selectedId=null;markDirty(false);renderBuilderNodes();renderBuilderInspector();updateHistoryButtons();}
function redoFlow(){if(state.historyIndex>=state.history.length-1)return;state.historyIndex++;state.flow=JSON.parse(state.history[state.historyIndex]);state.selectedId=null;markDirty(false);renderBuilderNodes();renderBuilderInspector();updateHistoryButtons();}
function markDirty(record=true){state.dirty=true;$('#dirtyBadge')?.classList.remove('hidden');if(record)scheduleHistory();}
function markClean(){state.dirty=false;$('#dirtyBadge')?.classList.add('hidden');}
function renderBuilderNodes(){
  if(!state.flow)return; const layer=$('#nodesLayer'); if(!layer)return;
  layer.innerHTML=state.flow.nodes.map(n=>{const meta=typeMeta[n.type]||{icon:'◻',name:n.type};return `<div class="node ${n.id===state.selectedId?'selected':''} ${n.disabled?'disabled':''}" data-id="${esc(n.id)}" data-type="${esc(n.type)}" style="left:${Number(n.x||0)}px;top:${Number(n.y||0)}px">${n.type!=='start'?'<span class="node-input"></span>':''}<div class="node-head"><span class="node-icon">${meta.icon}</span><span class="node-title"><strong>${esc(n.title||meta.name)}</strong><small>${esc(meta.name)}${n.disabled?' · DESACTIVADO':''}</small></span></div><div class="node-body">${esc(nodeSummary(n)).slice(0,230)}</div>${!['end','human'].includes(n.type)?'<span class="node-output"></span>':''}</div>`;}).join('');
  $$('.node',layer).forEach(el=>{el.addEventListener('click',()=>{state.selectedId=el.dataset.id;renderBuilderNodes();renderBuilderInspector();});enableNodeDrag(el);});
  $('#nodeCount').textContent=`${state.flow.nodes.length} bloques`;requestAnimationFrame(renderEdges);
}
function collectEdges(){const edges=[];for(const n of state.flow.nodes){if(n.next)edges.push({from:n.id,to:n.next,label:''});if(n.yes)edges.push({from:n.id,to:n.yes,label:'Sí'});if(n.no)edges.push({from:n.id,to:n.no,label:'No'});if(n.onError)edges.push({from:n.id,to:n.onError,label:'Error'});(n.options||[]).forEach(o=>o.next&&edges.push({from:n.id,to:o.next,label:o.key||o.label||''}));}return edges;}
function renderEdges(){const svg=$('#edges');if(!svg)return;const defs=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path class="edge-arrow" d="M0,0 L8,4 L0,8 z"></path></marker></defs>`;svg.innerHTML=defs+collectEdges().map(e=>{const a=$(`.node[data-id="${CSS.escape(e.from)}"]`),b=$(`.node[data-id="${CSS.escape(e.to)}"]`);if(!a||!b)return'';const x1=a.offsetLeft+a.offsetWidth,y1=a.offsetTop+a.offsetHeight/2,x2=b.offsetLeft,y2=b.offsetTop+b.offsetHeight/2,bend=Math.max(55,Math.abs(x2-x1)*.42),d=`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`;return `<path class="edge" d="${d}" marker-end="url(#arrow)"></path>${e.label?`<text class="edge-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-7}">${esc(e.label)}</text>`:''}`;}).join('');}
function enableNodeDrag(el){const head=$('.node-head',el);head.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();state.selectedId=el.dataset.id;const n=builderNode(state.selectedId),sx=e.clientX,sy=e.clientY,sl=Number(n.x||0),st=Number(n.y||0);head.setPointerCapture(e.pointerId);renderBuilderInspector();const move=ev=>{n.x=Math.max(20,Math.min(1750,Math.round(sl+ev.clientX-sx)));n.y=Math.max(20,Math.min(1100,Math.round(st+ev.clientY-sy)));el.style.left=`${n.x}px`;el.style.top=`${n.y}px`;renderEdges();};const up=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',up);markDirty();renderBuilderNodes();};head.addEventListener('pointermove',move);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',up);});}
function targetOptions(value){return `<option value="">— Sin conexión —</option>`+state.flow.nodes.map(n=>`<option value="${esc(n.id)}" ${n.id===value?'selected':''}>${esc(n.title||n.id)} · ${esc(typeMeta[n.type]?.name||n.type)}</option>`).join('');}
function commonFields(n){return `<div class="field"><label>Título del bloque</label><input data-field="title" value="${esc(n.title||'')}"/></div><label class="toggle-row"><input type="checkbox" data-field="disabled" ${n.disabled?'checked':''}/><span><strong>Desactivar temporalmente</strong><small>El motor saltará este bloque sin borrarlo.</small></span></label>`;}
function nextField(n,label='Siguiente bloque'){return `<div class="field"><label>${label}</label><select data-field="next">${targetOptions(n.next)}</select></div>`;}
function renderBuilderInspector(){
  const n=builderNode(state.selectedId), empty=$('#inspectorEmpty'), panel=$('#inspector');if(!empty||!panel)return;empty.classList.toggle('hidden',Boolean(n));panel.classList.toggle('hidden',!n);if(!n)return;
  const meta=typeMeta[n.type]||{icon:'',name:n.type};let fields=commonFields(n);
  if(n.type==='start')fields+=`<div class="field"><label>Entrada</label><input disabled value="Este bloque inicia todas las conversaciones"/></div>${nextField(n)}`;
  if(n.type==='message')fields+=`<div class="field"><label>Mensaje</label><textarea data-field="text">${esc(n.text||'')}</textarea></div>${nextField(n)}`;
  if(n.type==='menu'){fields+=`<div class="field"><label>Texto del menú</label><textarea data-field="prompt">${esc(n.prompt||'')}</textarea></div><div class="field"><label>Respuesta inválida</label><input data-field="fallback" value="${esc(n.fallback||'')}"/></div><div class="divider"></div><div class="field"><label>Opciones</label>${(n.options||[]).map((o,i)=>`<div class="option-row"><div class="option-grid"><input data-option-key="${i}" value="${esc(o.key||'')}" placeholder="1"/><input data-option-label="${i}" value="${esc(o.label||'')}" placeholder="Nombre"/></div><select data-option-next="${i}">${targetOptions(o.next)}</select><button class="btn danger small" data-remove-option="${i}">Eliminar</button></div>`).join('')}<button id="addOption" class="btn ghost small">+ Añadir opción</button></div>`;}
  if(n.type==='question')fields+=`<div class="field"><label>Pregunta</label><textarea data-field="prompt">${esc(n.prompt||'')}</textarea></div><div class="field"><label>Variable</label><input data-field="variable" value="${esc(n.variable||'respuesta')}" placeholder="ej. nombre"/></div>${nextField(n)}`;
  if(n.type==='condition')fields+=`<div class="field"><label>Variable</label><input data-field="variable" value="${esc(n.variable||'')}" placeholder="ej. ciudad (para etiquetas puede quedar vacío)"/></div><div class="field"><label>Operador</label><select data-field="operator">${[['equals','Es igual a'],['not_equals','No es igual a'],['contains','Contiene'],['not_contains','No contiene'],['starts_with','Empieza por'],['ends_with','Termina en'],['gt','Mayor que'],['gte','Mayor o igual'],['lt','Menor que'],['lte','Menor o igual'],['exists','Existe'],['is_empty','Está vacío'],['not_empty','No está vacío'],['has_tag','Tiene etiqueta'],['not_has_tag','No tiene etiqueta']].map(([v,l])=>`<option value="${v}" ${n.operator===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Valor a comparar</label><input data-field="value" value="${esc(n.value||'')}"/></div><div class="field-row"><div class="field"><label>Si SÍ</label><select data-field="yes">${targetOptions(n.yes)}</select></div><div class="field"><label>Si NO</label><select data-field="no">${targetOptions(n.no)}</select></div></div>`;
  if(n.type==='media')fields+=`<div class="field"><label>Tipo</label><select data-field="mediaType"><option value="image" ${n.mediaType==='image'?'selected':''}>Imagen</option><option value="document" ${n.mediaType==='document'?'selected':''}>Documento / PDF</option><option value="video" ${n.mediaType==='video'?'selected':''}>Video</option><option value="audio" ${n.mediaType==='audio'?'selected':''}>Audio</option></select></div><div class="field"><label>URL pública del archivo</label><input data-field="url" value="${esc(n.url||'')}" placeholder="https://..."/></div><div class="field"><label>Texto / descripción</label><textarea data-field="caption">${esc(n.caption||'')}</textarea></div><div class="field"><label>Nombre del archivo <span class="label-help">para documentos</span></label><input data-field="filename" value="${esc(n.filename||'')}" placeholder="catalogo.pdf"/></div>${nextField(n)}`;
  if(n.type==='tag')fields+=`<div class="field"><label>Acción</label><select data-field="action"><option value="add" ${n.action!=='remove'?'selected':''}>Agregar etiqueta</option><option value="remove" ${n.action==='remove'?'selected':''}>Quitar etiqueta</option></select></div><div class="field"><label>Etiqueta</label><input data-field="tag" value="${esc(n.tag||'')}" placeholder="VIP"/></div>${nextField(n)}`;
  if(n.type==='ai')fields+=`<div class="ai-node-banner">🧠 Usa el proveedor y saldo configurados en <strong>FlowZap AI</strong>. Cada ejecución real consume créditos.</div><div class="field"><label>Prompt para la IA</label><textarea data-field="prompt" placeholder="Ej. Responde esta consulta usando un tono profesional: {{consulta}}">${esc(n.prompt||'')}</textarea></div><div class="field"><label>Guardar respuesta en variable</label><input data-field="saveVariable" value="${esc(n.saveVariable||'respuesta_ia')}" placeholder="respuesta_ia"/></div><label class="toggle-row"><input type="checkbox" data-field="sendToUser" ${n.sendToUser!==false?'checked':''}/><span><strong>Enviar respuesta al cliente</strong><small>Si lo desactivas, la IA solo guarda el resultado en una variable.</small></span></label><div class="field"><label>Modelo específico <span class="label-help">opcional</span></label><input data-field="modelOverride" value="${esc(n.modelOverride||'')}" placeholder="Vacío = usar modelo global"/></div><div class="field"><label>Instrucción del sistema <span class="label-help">opcional</span></label><textarea data-field="systemPrompt" placeholder="Vacío = usar instrucción global">${esc(n.systemPrompt||'')}</textarea></div><div class="field"><label>Máximo de tokens de salida <span class="label-help">opcional</span></label><input type="number" min="32" max="8192" data-field="maxOutputTokens" value="${Number(n.maxOutputTokens||350)}"/></div>${nextField(n)}<div class="field"><label>Si la IA falla</label><select data-field="onError">${targetOptions(n.onError)}</select></div><div class="field"><label>Mensaje de error al cliente <span class="label-help">opcional</span></label><input data-field="errorMessage" value="${esc(n.errorMessage||'')}" placeholder="Estamos teniendo un inconveniente. Te paso con un asesor."/></div>`;
  if(n.type==='wait')fields+=`<div class="field"><label>Segundos</label><input type="number" min="0" data-field="seconds" value="${Number(n.seconds||5)}"/></div><p class="hint">En el simulador la espera avanza de inmediato. La cola programada real puede añadirse después.</p>${nextField(n)}`;
  if(n.type==='human')fields+=`<div class="field"><label>Mensaje al cliente</label><textarea data-field="text">${esc(n.text||'')}</textarea></div><div class="info-note">👤 Este bloque pausa el bot y deja la conversación disponible en la bandeja para un asesor.</div>`;
  if(n.type==='end')fields+=`<div class="info-note">⛔ Finaliza la sesión automática. Si el cliente escribe después, podrá iniciar el flujo nuevamente.</div>`;
  panel.innerHTML=`<h3>${meta.icon} ${esc(n.title||meta.name)}</h3><div class="sub">${esc(meta.name)} · ${esc(n.id)}</div>${fields}<div class="divider"></div><p class="hint">Variables disponibles: <strong>{{nombre}}</strong>, <strong>{{telefono}}</strong> y las que guardes con una Pregunta.</p><div class="inspector-actions"><button id="duplicateNode" class="btn ghost">Duplicar</button>${n.type!=='start'?'<button id="deleteNode" class="btn danger">Eliminar</button>':''}</div>`;
  $$('[data-field]',panel).forEach(input=>{const event=input.type==='checkbox'?'change':input.tagName==='SELECT'?'change':'input';input.addEventListener(event,()=>{let v=input.type==='checkbox'?input.checked:input.value;if(input.type==='number')v=Number(v||0);n[input.dataset.field]=v;markDirty();renderBuilderNodes();});});
  $$('[data-option-key]',panel).forEach(x=>x.addEventListener('input',()=>{n.options[+x.dataset.optionKey].key=x.value;markDirty();renderBuilderNodes();}));
  $$('[data-option-label]',panel).forEach(x=>x.addEventListener('input',()=>{n.options[+x.dataset.optionLabel].label=x.value;markDirty();renderBuilderNodes();}));
  $$('[data-option-next]',panel).forEach(x=>x.addEventListener('change',()=>{n.options[+x.dataset.optionNext].next=x.value;markDirty();renderBuilderNodes();}));
  $$('[data-remove-option]',panel).forEach(x=>x.addEventListener('click',()=>{n.options.splice(+x.dataset.removeOption,1);markDirty();renderBuilderNodes();renderBuilderInspector();}));
  $('#addOption')?.addEventListener('click',()=>{n.options=n.options||[];n.options.push({key:String(n.options.length+1),label:`Opción ${n.options.length+1}`,next:''});markDirty();renderBuilderNodes();renderBuilderInspector();});
  $('#duplicateNode')?.addEventListener('click',duplicateNode);$('#deleteNode')?.addEventListener('click',deleteNode);
}
function addNode(type){const canvas=$('#canvas'),id=uid(type),base={id,type,title:typeMeta[type]?.name||type,x:Math.max(50,canvas.scrollLeft+canvas.clientWidth/2-105),y:Math.max(50,canvas.scrollTop+canvas.clientHeight/2-60)};if(type==='message')Object.assign(base,{text:'Escribe aquí el mensaje que recibirá el cliente.',next:''});if(type==='menu')Object.assign(base,{prompt:'Elige una opción:',fallback:'Opción no válida. Intenta otra vez.',options:[{key:'1',label:'Opción 1',next:''}]});if(type==='question')Object.assign(base,{prompt:'Escribe tu respuesta:',variable:'respuesta',next:''});if(type==='condition')Object.assign(base,{variable:'respuesta',operator:'equals',value:'',yes:'',no:''});if(type==='media')Object.assign(base,{mediaType:'image',url:'',caption:'',filename:'',next:''});if(type==='tag')Object.assign(base,{action:'add',tag:'VIP',next:''});if(type==='ai')Object.assign(base,{prompt:'Responde de forma breve y útil a esta consulta: {{consulta}}',saveVariable:'respuesta_ia',sendToUser:true,modelOverride:'',systemPrompt:'',maxOutputTokens:350,next:'',onError:'',errorMessage:'No pude procesar la consulta en este momento.'});if(type==='wait')Object.assign(base,{seconds:5,next:''});if(type==='human')Object.assign(base,{text:'Perfecto 👤. Te comunicaré con un asesor.'});state.flow.nodes.push(base);state.selectedId=id;markDirty();renderBuilderNodes();renderBuilderInspector();}
function scrubRefs(id){for(const n of state.flow.nodes){if(n.next===id)n.next='';if(n.yes===id)n.yes='';if(n.no===id)n.no='';if(n.onError===id)n.onError='';for(const o of n.options||[])if(o.next===id)o.next='';}}
function deleteNode(){const n=builderNode(state.selectedId);if(!n||n.type==='start')return;if(!confirm(`¿Eliminar el bloque “${n.title||n.id}”?`))return;scrubRefs(n.id);state.flow.nodes=state.flow.nodes.filter(x=>x.id!==n.id);state.selectedId=null;markDirty();renderBuilderNodes();renderBuilderInspector();}
function duplicateNode(){const n=builderNode(state.selectedId);if(!n)return;const c=JSON.parse(JSON.stringify(n));c.id=uid(n.type);c.title=`${n.title||typeMeta[n.type]?.name||'Bloque'} copia`;c.x=Number(n.x||0)+45;c.y=Number(n.y||0)+60;if(c.type==='start'){c.type='message';c.text='Nuevo mensaje';c.next='';}state.flow.nodes.push(c);state.selectedId=c.id;markDirty();renderBuilderNodes();renderBuilderInspector();}
async function saveFlow(silent=false){state.flow.name=$('#flowName')?.value.trim()||state.flow.name||'Mi chatbot';const data=await api('/api/flow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.flow)});state.flow=data.flow;markClean();resetHistory();if(!silent)showToast(data.warnings?.length?`Guardado ✅ · ${data.warnings.length} advertencia(s)`:'Flujo guardado ✅','success');return data;}
async function publishFlow(){try{await saveFlow(true);const data=await api('/api/publish',{method:'POST'});showToast(data.warnings?.length?`Publicado 🚀 · ${data.warnings.length} advertencia(s)`:'Bot publicado 🚀','success');}catch(e){showToast(e.message,'error');}}
async function showValidation(){try{if(state.dirty)await saveFlow(true);const r=await api('/api/validate');openGeneric('Revisión del flujo',`${r.errors.length} errores · ${r.warnings.length} advertencias`,`<div class="validation-summary ${r.errors.length?'bad':'good'}">${r.errors.length?'❌ Hay errores que debes corregir antes de publicar.':'✅ No hay errores bloqueantes.'}</div>${r.errors.length?`<h4>Errores</h4><ul class="issue-list errors">${r.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${r.warnings.length?`<h4>Advertencias</h4><ul class="issue-list warnings">${r.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">No hay advertencias.</p>'}`);}catch(e){showToast(e.message,'error');}}
function centerFlow(){if(!state.flow?.nodes?.length)return;const c=$('#canvas');if(!c)return;const xs=state.flow.nodes.map(n=>+n.x||0),ys=state.flow.nodes.map(n=>+n.y||0),minX=Math.min(...xs),maxX=Math.max(...xs)+210,minY=Math.min(...ys),maxY=Math.max(...ys)+120;c.scrollTo({left:Math.max(0,(minX+maxX)/2-c.clientWidth/2),top:Math.max(0,(minY+maxY)/2-c.clientHeight/2),behavior:'smooth'});}
function findNodeBySearch(){const q=$('#nodeSearch').value.trim().toLowerCase();if(!q)return;const n=state.flow.nodes.find(x=>`${x.title||''} ${nodeSummary(x)} ${x.id}`.toLowerCase().includes(q));if(!n)return showToast('No encontré un bloque con ese texto.','error');state.selectedId=n.id;renderBuilderNodes();renderBuilderInspector();const c=$('#canvas');c.scrollTo({left:Math.max(0,n.x-c.clientWidth/2+105),top:Math.max(0,n.y-c.clientHeight/2+70),behavior:'smooth'});}
function exportFlow(){const blob=new Blob([JSON.stringify(state.flow,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(state.flow.name||'flow').toLowerCase().replace(/[^a-z0-9]+/gi,'-')}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importFlow(file){try{const f=JSON.parse(await file.text());if(!Array.isArray(f.nodes))throw new Error('El archivo no parece un flujo válido.');state.flow=f;$('#flowName').value=f.name||'Flujo importado';state.selectedId=null;markDirty();renderBuilderNodes();renderBuilderInspector();centerFlow();showToast('Flujo importado. Guárdalo para conservarlo.','success');}catch(e){showToast(e.message,'error');}}

function appendSim(items){const chat=$('#simChat');for(const item of items||[]){const div=document.createElement('div');div.className=`bubble ${item.type}`;if(item.media?.url){const media=document.createElement('div');media.className='media-preview';media.textContent=`📎 ${item.media.type || 'archivo'} · ${item.media.filename||item.media.url}`;div.appendChild(media);}if(item.text){const t=document.createElement('div');t.textContent=item.text;div.appendChild(t);}chat.appendChild(div);}chat.scrollTop=chat.scrollHeight;}
function renderSimTrace(){const trace=state.simSession?.trace||[];$('#simTrace').innerHTML=trace.slice(-5).map((t,i)=>`<span class="trace-chip ${i===trace.slice(-5).length-1?'active':''}">${esc(t.title)}</span>`).join('');}
async function startSimulation(){$('#simChat').innerHTML='';const d=await api('/api/simulate/start',{method:'POST'});state.simSession=d.session;appendSim(d.output);renderSimTrace();}
async function openSimulation(){try{await saveFlow(true);$('#simModal').classList.remove('hidden');$('#simModal').setAttribute('aria-hidden','false');await startSimulation();$('#simInput').focus();}catch(e){showToast(e.message,'error');}}
async function sendSim(){const i=$('#simInput'),v=i.value.trim();if(!v)return;appendSim([{type:'user',text:v}]);i.value='';const d=await api('/api/simulate/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:state.simSession,input:v})});state.simSession=d.session;appendSim(d.output);renderSimTrace();}

async function renderVersions() {
  const versions=await api('/api/versions');
  $('#headerActions').innerHTML=`<button class="btn secondary" data-goto-builder>🤖 Abrir constructor</button>`;
  $('#viewRoot').innerHTML=`<div class="page-scroll"><div class="card table-card"><table><thead><tr><th>Fecha</th><th>Bot</th><th>Tipo</th><th>Versión</th><th></th></tr></thead><tbody>${versions.length?versions.map(v=>`<tr><td>${esc(fmtDate(v.createdAt))}</td><td><strong>${esc(v.flowName)}</strong><small class="table-sub">${esc(v.label)}</small></td><td><span class="version-kind ${esc(v.kind)}">${esc(v.kind)}</span></td><td>v${Number(v.flowVersion||0)}</td><td><button class="btn ghost small" data-restore="${esc(v.id)}">Restaurar</button></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-mini padded"><span>🗂️</span><strong>Aún no hay versiones</strong><p>Se crea una versión cuando guardas o publicas un flujo.</p></div></td></tr>`}</tbody></table></div></div>`;
  $('[data-goto-builder]').addEventListener('click',()=>navigate('builder'));
  $$('[data-restore]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Restaurar esta versión como borrador actual?'))return;await api(`/api/versions/${b.dataset.restore}/restore`,{method:'POST'});showToast('Versión restaurada ✅','success');navigate('builder');}));
}

async function renderSettings() {
  await loadStatus(); const s=state.status;
  $('#viewRoot').innerHTML=`<div class="page-scroll settings-grid"><section class="card section-card"><div class="card-head"><div><h3>Conexión WhatsApp</h3><p>Estado del backend</p></div><span class="status-pill ${s.whatsappConfigured?'live':''}">${s.whatsappConfigured?'● Conectado':'● Modo demo'}</span></div><div class="check-list">${checkRow(s.whatsappConfigured,'Credenciales WhatsApp',s.whatsappConfigured?'Configuradas':'Pendientes')}${checkRow(s.webhookVerifyTokenConfigured,'WA_VERIFY_TOKEN',s.webhookVerifyTokenConfigured?'Configurado':'Pendiente')}${checkRow(s.signatureValidationConfigured,'META_APP_SECRET',s.signatureValidationConfigured?'Configurado':'Pendiente')}${checkRow(Boolean(s.graphVersion),'Versión Graph API',s.graphVersion||'Pendiente')}</div><div class="info-note">El constructor, simulador, CRM y bandeja funcionan en modo demo sin Meta. Para recibir mensajes reales, debes exponer el servidor con HTTPS y configurar el webhook público en Meta.</div></section><section class="card section-card"><div class="card-head"><div><h3>Archivo .env</h3><p>Crea <strong>.env</strong> junto a server.js</p></div></div><pre class="code-box">PORT=3000
WA_VERIFY_TOKEN=tu_token_seguro
WA_ACCESS_TOKEN=tu_access_token
WA_PHONE_NUMBER_ID=tu_phone_number_id
WA_GRAPH_VERSION=vXX.X
META_APP_SECRET=tu_app_secret

# IA opcional: también puedes guardar la API Key desde FlowZap AI
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
AI_COMPATIBLE_API_KEY=</pre><p class="hint">Después de editar .env, cierra la ventana del servidor y vuelve a ejecutar <strong>start.bat</strong>.</p></section><section class="card section-card"><div class="card-head"><div><h3>Webhook</h3><p>Ruta que recibe eventos de Meta</p></div></div><div class="copy-box"><code>/webhook</code></div><p class="hint">En local, abrir <strong>/webhook</strong> directamente mostrará “Verification failed”; es normal porque Meta debe enviar los parámetros de verificación.</p></section></div>`;
}

function bindGlobal() {
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  $('#simSend').addEventListener('click',sendSim); $('#simInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendSim();}); $('#simRestart').addEventListener('click',startSimulation);
  window.addEventListener('resize',()=>{if(state.view==='builder')renderEdges();});
  window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
}

async function init(){bindGlobal();await loadStatus();await navigate('dashboard');setInterval(refreshUnread,7000);}
init().catch(e=>showToast(`Error inicializando: ${e.message}`,'error'));
