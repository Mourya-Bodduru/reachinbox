const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve(JSON.parse(raw)));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function scheduleFuture() {
  const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
  const res = await post('/api/emails/schedule', {
    subject: 'Persistence Verification Across Server Restarts',
    body: 'This email is scheduled 1 hour in the future to prove persistence across server restarts.',
    senderEmail: 'campaigns@growthlead.io',
    recipients: ['future.lead@enterprise-client.com'],
    scheduledAt: futureTime,
    delayBetweenEmails: 2,
    hourlyLimit: 100,
  });
  console.log('Future scheduled job:', res.jobs[0].id, res.jobs[0].recipientEmail);
}

scheduleFuture().catch(console.error);
