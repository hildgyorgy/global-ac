import test from 'node:test';
import assert from 'node:assert/strict';
import { startWithErrorBoundary } from '../src/core/startup.ts';

test('successful startup does not report a failure', async () => {
  assert.equal(await startWithErrorBoundary(async () => {}, () => assert.fail('Unexpected error')), true);
});

for (const stage of ['renderer initialization', 'particle compute initialization']) {
  test(`a rejected ${stage} reaches the error UI once`, async () => {
    const failure = new Error(stage), reported = [];
    const result = await startWithErrorBoundary(async () => { throw failure; }, error => reported.push(error));
    assert.equal(result, false);
    assert.deepEqual(reported, [failure]);
  });
}

test('synchronous startup failures also reach the error UI', async () => {
  const failure = new Error('setup'), reported = [];
  assert.equal(await startWithErrorBoundary(() => { throw failure; }, error => reported.push(error)), false);
  assert.deepEqual(reported, [failure]);
});
