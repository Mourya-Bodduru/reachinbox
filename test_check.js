const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function check() {
  const stats = await get('/api/emails/stats');
  console.log('--- STATS ---');
  console.log(JSON.stringify(stats, null, 2));

  const sent = await get('/api/emails/sent');
  console.log('--- SENT EMAILS ---');
  console.log(`Total sent: ${sent.total}`);
  sent.emails.forEach((e) => {
    console.log(`- To: ${e.recipientEmail} | Status: ${e.status} | Preview: ${e.etherealPreviewUrl}`);
  });
}

check().catch(console.error);
