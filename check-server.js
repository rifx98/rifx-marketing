const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response length: ${data.length} characters`);
    // Check if response contains HTML
    if (data.includes('<!DOCTYPE html>')) {
      console.log('HTML received successfully');
      // Extract title
      const titleMatch = data.match(/<title>(.*?)<\/title>/);
      if (titleMatch) {
        console.log(`Page title: ${titleMatch[1]}`);
      }
      // Check for Next.js errors
      if (data.includes('__next')) {
        console.log('Next.js container found');
      }
      if (data.includes('Error') || data.includes('error')) {
        console.log('Potential error in page content');
      }
    } else {
      console.log('No HTML received');
      console.log('First 500 chars:', data.substring(0, 500));
    }
  });
});

req.on('error', (err) => {
  console.error(`Error: ${err.message}`);
});

req.on('timeout', () => {
  console.error('Request timeout');
  req.destroy();
});

req.end();