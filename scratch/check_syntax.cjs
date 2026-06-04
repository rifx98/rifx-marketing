const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'panel', 'panel-client.tsx');
console.log('Checking syntax for:', filePath);

const program = ts.createProgram([filePath], {
  noEmit: true,
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.Latest,
  moduleResolution: ts.ModuleResolutionKind.NodeJs
});

const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length === 0) {
  console.log('No syntax errors found!');
} else {
  console.log(`Found ${diagnostics.length} errors:`);
  diagnostics.slice(0, 15).forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(`Error in ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });
}
