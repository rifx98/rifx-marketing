const fs = require('fs');

const originalFile = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

// Find the start of the return statement
const returnMatch = originalFile.indexOf('  return (\n    <>\n    <div className="flex h-screen bg-[#050505]');
if (returnMatch === -1) {
    console.error("Could not find return statement");
    process.exit(1);
}

const beforeReturn = originalFile.substring(0, returnMatch);

const chatModalStart = originalFile.indexOf('{/* ----------------- CHAT MODAL (Portal to body) ----------------- */}');
const chatModalContent = originalFile.substring(chatModalStart);

// We need the forms for the settings.
const settingsSectionStart = originalFile.indexOf('{/* ----------------- TAB: SETTINGS ----------------- */}');
const settingsSectionEnd = originalFile.indexOf('{/* Chat modal rendered via portal to document.body - see bottom of component */}');
let settingsFormContent = "";
if (settingsSectionStart !== -1 && settingsSectionEnd !== -1) {
    settingsFormContent = originalFile.substring(settingsSectionStart, settingsSectionEnd);
}

console.log("Sections extracted successfully.");
// Now we write a new version to a temporary file
fs.writeFileSync('scratch/extracted_logic.js', JSON.stringify({
    beforeReturn,
    chatModalContent,
    settingsFormContent
}, null, 2));
