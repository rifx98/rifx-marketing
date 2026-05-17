import fs from 'fs';

let content = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

const modalStart = content.indexOf('{/* ----------------- FULL SCREEN INBOX (Portal to body) ----------------- */}');
if (modalStart === -1) {
    console.error('Modal start not found');
    process.exit(1);
}

const beforeModal = content.substring(0, modalStart);
let modalContent = content.substring(modalStart);

const replacements = [
    ['Inbox:', "{language === 'en' ? 'Inbox:' : 'Bandeja:'}"],
    ['placeholder="Search interactions..."', "placeholder={language === 'en' ? 'Search interactions...' : 'Buscar interacciones...'}"],
    ['<span className="text-[10px] mt-1 font-bold uppercase">Message</span>', "<span className=\"text-[10px] mt-1 font-bold uppercase\">{language === 'en' ? 'Message' : 'Mensaje'}</span>"],
    ['<span className="text-[10px] mt-1 font-bold uppercase">Call</span>', "<span className=\"text-[10px] mt-1 font-bold uppercase\">{language === 'en' ? 'Call' : 'Llamar'}</span>"],
    ['<span className="text-[10px] mt-1 font-bold uppercase">Edit</span>', "<span className=\"text-[10px] mt-1 font-bold uppercase\">{language === 'en' ? 'Edit' : 'Editar'}</span>"],
    ['<span className="text-[10px] mt-1 font-bold uppercase">More</span>', "<span className=\"text-[10px] mt-1 font-bold uppercase\">{language === 'en' ? 'More' : 'Más'}</span>"],
    ['AI Intelligence Profile', "{language === 'en' ? 'AI Intelligence Profile' : 'Perfil de Inteligencia IA'}"],
    ['Propensity to Convert', "{language === 'en' ? 'Propensity to Convert' : 'Propensión de Compra'}"],
    ['Sentiment Analysis', "{language === 'en' ? 'Sentiment Analysis' : 'Análisis de Sentimiento'}"],
    ['Consistently Positive', "{language === 'en' ? 'Consistently Positive' : 'Consistentemente Positivo'}"],
    ['Key Intent Keywords', "{language === 'en' ? 'Key Intent Keywords' : 'Palabras Clave de Intención'}"],
    ['Behavioral Telemetry', "{language === 'en' ? 'Behavioral Telemetry' : 'Telemetría de Comportamiento'}"],
    ['Classification', "{language === 'en' ? 'Classification' : 'Clasificación'}"],
    ['Interactions', "{language === 'en' ? 'Interactions' : 'Interacciones'}"],
    ['Last Activity', "{language === 'en' ? 'Last Activity' : 'Última Actividad'}"],
    ['Today, 14:22 (24m ago)', "{language === 'en' ? 'Today, 14:22 (24m ago)' : 'Hoy, 14:22 (hace 24m)'}"],
    ['Communication Timeline', "{language === 'en' ? 'Communication Timeline' : 'Línea de Tiempo de Comunicación'}"],
    ['Operator Notes', "{language === 'en' ? 'Operator Notes' : 'Notas del Operador'}"],
    ['System Metadata', "{language === 'en' ? 'System Metadata' : 'Metadatos del Sistema'}"],
    ['Take over conversation or write a note...', "{language === 'en' ? 'Take over conversation or write a note...' : 'Toma el control de la conversación o escribe una nota...'}"],
    ['La IA está respondiendo de forma autónoma. Haz clic en \\\'Tomar Control\\\' en la cabecera para enviar un mensaje manualmente.', "{language === 'en' ? 'AI is responding autonomously. Click \\'Take Control\\' in the header to send a manual message.' : 'La IA está respondiendo de forma autónoma. Haz clic en \\'Tomar Control\\' en la cabecera para enviar un mensaje manualmente.'}"],
    ['{sendingMsg ? \\\'...\\\' : \\\'Send\\\'}', "{sendingMsg ? '...' : (language === 'en' ? 'Send' : 'Enviar')}"],
    ['No hay mensajes aún', "{language === 'en' ? 'No messages yet' : 'No hay mensajes aún'}"],
    ['"Mencionó que están evaluando otras 2 plataformas, pero prefiere nuestra integración nativa con SAP. Pendiente de enviar caso de éxito del sector Fintech."', "{language === 'en' ? '\\\"Mentioned evaluating 2 other platforms, but prefers our native SAP integration. Pending sending Fintech sector success case.\\\"' : '\\\"Mencionó que están evaluando otras 2 plataformas, pero prefiere nuestra integración nativa con SAP. Pendiente de enviar caso de éxito del sector Fintech.\\\"'}"],
    ['Added by Sarah J. • 2 days ago', "{language === 'en' ? 'Added by Sarah J. • 2 days ago' : 'Añadido por Sarah J. • hace 2 días'}"]
];

for (const [target, replacement] of replacements) {
    modalContent = modalContent.replace(target, replacement);
}

// Wire up the 4 profile buttons
modalContent = modalContent.replace(
    `<button className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">chat</span>`,
    `<button onClick={() => document.querySelector("textarea")?.focus()} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">chat</span>`
);
modalContent = modalContent.replace(
    `<button className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">call</span>`,
    `<button onClick={() => window.open("tel:+525512345678")} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">call</span>`
);
modalContent = modalContent.replace(
    `<button className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">edit</span>`,
    `<button onClick={() => alert(language === 'en' ? 'Feature coming soon' : 'Función próximamente')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">edit</span>`
);
modalContent = modalContent.replace(
    `<button className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">more_horiz</span>`,
    `<button onClick={() => alert(language === 'en' ? 'Feature coming soon' : 'Función próximamente')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">\n                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">more_horiz</span>`
);

// Wire up header dummy buttons
modalContent = modalContent.replace(
    '<span className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">notifications</span>',
    '<span onClick={() => alert(language === "en" ? "No new notifications" : "No hay notificaciones nuevas")} className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">notifications</span>'
);
modalContent = modalContent.replace(
    '<span className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">help</span>',
    '<span onClick={() => alert(language === "en" ? "Help center coming soon" : "Centro de ayuda próximamente")} className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">help</span>'
);

// Filter buttons in Timeline
modalContent = modalContent.replace(
    '<span className="px-3 py-1 bg-surface-container text-[10px] font-bold rounded cursor-pointer">WhatsApp</span>',
    '<span onClick={() => alert("Filtro WhatsApp activado")} className="px-3 py-1 bg-surface-container text-[10px] font-bold rounded cursor-pointer">WhatsApp</span>'
);
modalContent = modalContent.replace(
    '<span className="px-3 py-1 bg-surface-container-low text-[10px] font-bold rounded cursor-pointer opacity-50">Email</span>',
    '<span onClick={() => alert(language === "en" ? "Email channel not connected" : "Canal de email no conectado")} className="px-3 py-1 bg-surface-container-low text-[10px] font-bold rounded cursor-pointer opacity-50 hover:opacity-100 transition-opacity">Email</span>'
);

fs.writeFileSync('app/panel/panel-client.tsx', beforeModal + modalContent);
console.log('Translated and wired buttons in Inbox UI');
