const http = require('http');

const data = JSON.stringify({
  subject: 'Enterprise Cold Outreach Pipeline Demo',
  body: 'Hello Team,\n\nThis is a verifiable test email sent via ReachInbox distributed BullMQ scheduler.\nPowered by Redis delayed queues and Ethereal fake SMTP.\n\nBest regards,\nReachInbox Growth Engineering',
  recipients: [
    'lead1.acme@example.com',
    'lead2.innovate@example.com',
    'lead3.enterprise@example.com'
  ],
  senderEmail: 'alex.sales@reachinbox.ai',
  delayBetweenEmails: 2,
  hourlyLimit: 50
});

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/emails/schedule',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  },
  (res) => {
    let raw = '';
    res.on('data', (chunk) => (raw += chunk));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', JSON.parse(raw));
    });
  }
);

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();
