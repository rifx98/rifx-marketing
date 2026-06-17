const https = require('https');

https.get('https://dala.craftedbygc.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    // Buscar referencias a bin, csv, txt o arrays grandes
    const matches = data.match(/[^"']*\.(bin|csv|txt)/g);
    if (matches) {
      console.log('Archivos encontrados:', [...new Set(matches)]);
    } else {
      console.log('No bin files.');
    }
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});
