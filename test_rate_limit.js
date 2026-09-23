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

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Testing Rate Limiting & Next Hour Window Rescheduling ---');
  // Use a new sender identity: sarah.outreach@outboxlabs.com
  // Set hourlyLimit = 2, delayBetweenEmails = 1
  // Send 5 leads
  const scheduleRes = await post('/api/emails/schedule', {
    subject: 'High Volume Rate Limit Verification',
    body: 'Testing hourly rate limit enforcement and graceful rescheduling.',
    senderEmail: 'sarah.outreach@outboxlabs.com',
    recipients: [
      'rate1@customer.com',
      'rate2@customer.com',
      'rate3@customer.com',
      'rate4@customer.com',
      'rate5@customer.com',
    ],
    delayBetweenEmails: 1,
    hourlyLimit: 2, // Only 2 allowed per hour!
  });

  console.log(`Enqueued ${scheduleRes.scheduledCount} emails with hourlyLimit=2`);

  // Wait 10 seconds for worker to process
  console.log('Waiting 10s for worker processing...');
  await new Promise((r) => setTimeout(r, 10000));

  const scheduled = await get('/api/emails/scheduled');
  console.log('--- SCHEDULED / RESCHEDULED LIST ---');
  scheduled.emails.forEach((e) => {
    console.log(`- ${e.recipientEmail} | Status: ${e.status} | ScheduledAt: ${e.scheduledAt}`);
  });

  const sent = await get('/api/emails/sent');
  console.log(`Total sent across system: ${sent.total}`);
}

run().catch(console.error);
