import fs from 'fs';

let content = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

const modalStart = content.indexOf('{/* ----------------- FULL SCREEN INBOX (Portal to body) ----------------- */}');
if (modalStart === -1) {
    console.error('Modal start not found');
    process.exit(1);
}

const beforeModal = content.substring(0, modalStart);
let modalContent = content.substring(modalStart);

modalContent = modalContent
    .replace(/bg-surface-container-lowest/g, 'bg-crm-surface-container-lowest')
    .replace(/bg-surface-container-highest/g, 'bg-crm-surface-container-highest')
    .replace(/bg-surface-container-low/g, 'bg-crm-surface-container-low')
    .replace(/bg-surface-container-high/g, 'bg-crm-surface-container-high')
    .replace(/bg-surface-container/g, 'bg-crm-surface-container')
    .replace(/bg-surface/g, 'bg-crm-surface')
    .replace(/hover:bg-surface-container-low/g, 'hover:bg-crm-surface-container-low')
    .replace(/ring-surface-container/g, 'ring-crm-surface-container');

fs.writeFileSync('app/panel/panel-client.tsx', beforeModal + modalContent);
console.log('Fixed CRM color prefixes');
