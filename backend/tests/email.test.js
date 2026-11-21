import { readFile, rm } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

const added = [];
let queueOptions;
vi.mock('bullmq', () => ({
  Queue: class {
    constructor(_name, options) { queueOptions = options; }
    add(name, data) { added.push({ name, data }); }
    close() {}
  },
  Worker: class {},
}));
vi.mock('../src/config/valkey.js', () => ({ createValkeyConnection: () => ({}) }));

const { EMAIL_JOBS } = await import('../src/queues/email.jobs.js');
const { enqueueEmail } = await import('../src/queues/email.queue.js');
const { processEmailJob } = await import('../src/queues/workers/email.worker.js');

describe('email queue', () => {
  it('queues jobs with 3 attempts and exponential backoff', async () => {
    await enqueueEmail(EMAIL_JOBS.TEST, { to: 'a@kapekonek.test' });
    expect(added).toEqual([{ name: 'test', data: { to: 'a@kapekonek.test' } }]);
    expect(queueOptions.defaultJobOptions).toMatchObject({ attempts: 3, backoff: { type: 'exponential' } });
  });

  it('refuses unknown job names when queueing', async () => {
    await expect(enqueueEmail('nope', {})).rejects.toThrow(/Unknown email job/);
  });
});

describe('email worker (log transport)', () => {
  it('writes the rendered email with escaped user text and a text part', async () => {
    const file = await processEmailJob({ name: EMAIL_JOBS.TEST, data: { to: 'juan@kapekonek.test', name: '<b>Juan</b>' } });
    const mail = JSON.parse(await readFile(file, 'utf8'));
    await rm(file);
    expect(mail.to).toBe('juan@kapekonek.test');
    expect(mail.subject).toBe('KapeKonek test email');
    expect(mail.html).toContain('&lt;b&gt;Juan&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Juan</b>');
    expect(mail.text).toContain('<b>Juan</b>'); // plain text needs no escaping
  });

  it('fails unknown job names', async () => {
    await expect(processEmailJob({ name: 'nope', data: {} })).rejects.toThrow(/Unknown email job/);
  });
});
