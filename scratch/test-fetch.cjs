const http = require('http');

function testUrl(url) {
  return new Promise((resolve) => {
    console.log(`Testing fetch to ${url}...`);
    const start = Date.now();
    const req = http.request(url, { method: 'POST', timeout: 3000 }, (res) => {
      console.log(`[${url}] Status: ${res.statusCode} (took ${Date.now() - start}ms)`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.error(`[${url}] Error: ${err.message} (took ${Date.now() - start}ms)`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.error(`[${url}] Timeout! (took ${Date.now() - start}ms)`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function run() {
  await testUrl('http://127.0.0.1:3000/api/whatsapp');
  await testUrl('http://[::1]:3000/api/whatsapp');
  await testUrl('http://localhost:3000/api/whatsapp');
}

run();
