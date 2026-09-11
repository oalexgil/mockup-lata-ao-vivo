import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const raw = fs.readFileSync(new URL('../.devcontainer/devcontainer.json', import.meta.url), 'utf8');
const config = JSON.parse(raw);

test('Codespaces forwards Mockup Vision on port 8000', () => {
  assert.ok(Array.isArray(config.forwardPorts));
  assert.ok(config.forwardPorts.includes(8000));
  assert.equal(config.portsAttributes?.['8000']?.label, 'Mockup Vision');
  assert.equal(config.portsAttributes?.['8000']?.visibility, 'private');
});

test('Codespaces restarts the preview server when health check fails', () => {
  assert.match(config.postStartCommand || '', /127\.0\.0\.1:8000\/api\/health/);
  assert.match(config.postStartCommand || '', /npm run dev/);
  assert.match(config.postStartCommand || '', /nohup/);
});
