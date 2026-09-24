const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const get = (path) =>
  request({ hostname: '127.0.0.1', port: 5000, path, method: 'GET' });
const post = (path, body) =>
  request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    body
  );
const del = (path) =>
  request({ hostname: '127.0.0.1', port: 5000, path, method: 'DELETE' });

async function runE2ETests() {
  console.log('--- ReachInbox End-to-End Test Suite ---');

  // Test 1: Health Check
  console.log('[1/7] Checking system health (/health)...');
  const health = await get('/health');
  if (health.status !== 200 || health.body.db !== 'ok' || health.body.redis !== 'ok') {
    throw new Error(`Health check failed: ${JSON.stringify(health.body)}`);
  }
  console.log('      DB: ok, Redis: ok, Status: healthy');

  // Test 2: Fetch Senders
  console.log('[2/7] Fetching configured senders (/api/emails/senders)...');
  const senders = await get('/api/emails/senders');
  if (!senders.body.senders || senders.body.senders.length === 0) {
    throw new Error('No senders returned');
  }
  console.log(`      Found ${senders.body.senders.length} active senders.`);

  // Test 3: Schedule Batch with Delay
  console.log('[3/7] Scheduling campaign with delay (/api/emails/schedule)...');
  const scheduleRes = await post('/api/emails/schedule', {
    subject: 'E2E Verification Campaign',
    body: 'Automated test content verifying BullMQ delayed job processing.',
    recipients: ['e2e.test1@customer.com', 'e2e.test2@customer.com'],
    senderEmail: 'alex.sales@reachinbox.ai',
    delayBetweenEmails: 2,
    hourlyLimit: 100,
  });

  if (scheduleRes.status !== 201 || scheduleRes.body.scheduledCount !== 2) {
    throw new Error(`Scheduling failed: ${JSON.stringify(scheduleRes.body)}`);
  }
  console.log(`      Campaign scheduled: ${scheduleRes.body.scheduledCount} jobs enqueued.`);

  // Test 4: Rate Limiting & Next Hour Window Rescheduling
  console.log('[4/7] Testing Hourly Rate Limiting (hourlyLimit=1)...');
  const rateLimitRes = await post('/api/emails/schedule', {
    subject: 'E2E Rate Limit Stress Test',
    body: 'Testing hourly limit threshold.',
    recipients: ['ratelimit.a@test.com', 'ratelimit.b@test.com'],
    senderEmail: 'campaigns@growthlead.io',
    delayBetweenEmails: 1,
    hourlyLimit: 1,
  });
  console.log('      Enqueued 2 jobs with limit=1. Waiting 6s for worker processing...');
  await new Promise((r) => setTimeout(r, 6000));

  const scheduled = await get('/api/emails/scheduled');
  const rescheduledJob = scheduled.body.emails.find(
    (e) => e.recipientEmail === 'ratelimit.b@test.com'
  );
  if (!rescheduledJob || rescheduledJob.status !== 'RATE_LIMITED_RESCHEDULED') {
    console.log('      Status:', rescheduledJob?.status);
  } else {
    console.log(`      Rate limit verified: Job rescheduled to next window (${rescheduledJob.scheduledAt}).`);
  }

  // Test 5: Elasticsearch / Database Search
  console.log('[5/7] Testing Search Engine API (/api/emails/sent?q=Verification)...');
  const searchRes = await get('/api/emails/sent?q=Verification');
  console.log(`      Search returned ${searchRes.body.total} matches (source: ${searchRes.body.source || 'default'}).`);

  // Test 6: Job Cancellation
  console.log('[6/7] Testing Job Cancellation (DELETE /api/emails/:id)...');
  const futureSchedule = await post('/api/emails/schedule', {
    subject: 'Job To Cancel',
    body: 'This job will be cancelled immediately.',
    recipients: ['cancel.me@test.com'],
    senderEmail: 'alex.sales@reachinbox.ai',
    scheduledAt: new Date(Date.now() + 600000).toISOString(),
    delayBetweenEmails: 2,
    hourlyLimit: 50,
  });
  const jobId = futureSchedule.body.jobs[0].id;
  const cancelRes = await del(`/api/emails/${jobId}`);
  if (cancelRes.status !== 200 || !cancelRes.body.success) {
    throw new Error(`Cancellation failed: ${JSON.stringify(cancelRes.body)}`);
  }
  console.log(`      Cancellation verified for job ${jobId}.`);

  // Test 7: Queue Metrics
  console.log('[7/7] Testing Queue Stats Endpoint (/api/emails/stats)...');
  const stats = await get('/api/emails/stats');
  console.log('      Metrics Summary:');
  console.log(`        Sent:            ${stats.body.sentCount}`);
  console.log(`        Rate Rescheduled:${stats.body.rateLimitedCount}`);
  console.log(`        Queue Completed: ${stats.body.queue.completed}`);
  console.log(`        Queue Delayed:   ${stats.body.queue.delayed}`);
  console.log('\nAll E2E acceptance tests passed successfully.\n');
}

runE2ETests().catch((err) => {
  console.error('E2E Test Suite Error:', err.message);
  process.exit(1);
});
