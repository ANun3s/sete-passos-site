import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileRateLimiter } from './profile-rate-limit.mjs';

test('custom limiter bounds memory, fails closed and expires idle entries without accumulating timers', () => {
  let clock = 0;
  const limit = createProfileRateLimiter({ now: () => clock, maxKeys: 2 });
  assert.equal(limit('password', 'ip:one', 1), 0);
  assert.equal(limit('password', 'ip:one', 1), 60);
  assert.equal(limit('avatar', 'ip:one', 1), 0);
  assert.equal(limit('password', 'ip:two', 1), 60, 'full map fails closed rather than evicting a live limit');
  clock = 59_001;
  assert.equal(limit('password', 'ip:one', 1), 1);
  clock = 60_000;
  assert.equal(limit('password', 'ip:two', 1), 0);
  assert.equal(limit('password', 'ip:one', 1), 0);
});
