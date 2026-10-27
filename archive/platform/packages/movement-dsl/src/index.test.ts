import test from 'node:test';
import assert from 'node:assert/strict';
import { BehaviorScheduler, compileBlocks, compileMovement, formatMovement, MovementCompileError } from './index.js';

test('compiles the actual public command vocabulary and preserves policy requirements', () => {
  const result = compileMovement('await duck.walk({ distance: 1.5 });\nawait duck.turn({ degrees: -90 });\nawait duck.sit(); await duck.stand(); await duck.kick({ side: "left" });');
  assert.equal(result.instructions.length, 5);
  assert.deepEqual(result.requiredPolicies, ['walk', 'sitstand', 'kick_left']);
  assert.deepEqual(result.instructions, compileMovement(formatMovement(result)).instructions.map((item, index) => ({ ...item, line: result.instructions[index].line })));
});
test('expands bounded canonical loops without executing JavaScript', () => {
  const result = compileMovement('for (let i = 0; i < 3; i++) { await duck.turn({ degrees: 30 }); }');
  assert.equal(result.instructions.length, 3);
  assert.equal(result.instructions[2].kind, 'turn');
});
test('visual blocks pass through exactly the same physical validators', () => {
  assert.equal(compileBlocks([{ kind: 'walk', args: { distance: .3 } }]).instructions[0].kind, 'walk');
  assert.throws(() => compileBlocks([{ kind: 'walk', args: { distance: .3, speed: 1 } }]), /speed/);
});
for (const source of [
  'fetch("https://example.com")',
  'await duck.walk({distance: window.ethereum.request()});',
  'await duck["walk"]({distance: 1});',
  'await duck.constructor.constructor("return process")();',
  'import x from "node:fs";',
  'while (true) { await duck.sit(); }',
  'for (let i = 0; i < 1000000; i++) { await duck.sit(); }',
  'for (let i = 0; i < 2; i += 0) { await duck.sit(); }',
  'await duck.walk({get distance() { return 1; }});',
  'await duck.walk({...{distance:1}});',
  'await duck.walk({distance: NaN});',
  'await duck.walk({distance: 1, __proto__: "x"});',
  'await duck.walk({distance: 1, distance: 2});',
  'await duck.walk({distance: 1+2});',
  'await duck.wait({seconds: Infinity});',
  'if (duck.state.wallet) { await duck.sit(); }',
  'await duck.wallet({transaction:"buy"});',
]) test(`rejects untrusted syntax: ${source.slice(0, 55)}`, () => assert.throws(() => compileMovement(source), MovementCompileError));
test('errors retain human-readable line and column', () => {
  try { compileMovement('await duck.sit();\nawait duck.fly();'); assert.fail('must reject'); }
  catch (error) { assert.ok(error instanceof MovementCompileError); assert.equal(error.line, 2); assert.ok(error.column >= 1); assert.match(error.message, /Unsupported/); }
});
test('enforces physical velocity, total duration, instruction and source budgets', () => {
  assert.throws(() => compileMovement('await duck.walk({distance:-1,speed:0.25});'), /speed/);
  assert.throws(() => compileMovement('await duck.walk({distance:5,speed:0.05});'), /command budget/);
  assert.throws(() => compileMovement('for(let i=0;i<20;i++){await duck.roll();}'), /duration budget/);
  assert.throws(() => compileMovement('for(let i=0;i<20;i++){for(let j=0;j<20;j++){await duck.wait({seconds:0});}}'), /instructions/);
  assert.throws(() => compileMovement(' '.repeat(32769)), /bytes/);
});
test('runs instructions sequentially and stops the physical controller afterward', async () => {
  const calls: string[] = [];
  const scheduler = new BehaviorScheduler({ execute: async (instruction) => { calls.push(instruction.kind); }, stop: () => { calls.push('stop'); } });
  await scheduler.run(compileMovement('await duck.sit();await duck.stand();'));
  assert.deepEqual(calls, ['sit', 'stand', 'stop']);
  assert.equal(scheduler.running, false);
});
test('state conditions only choose their permitted branch', async () => {
  const calls: string[] = [];
  const scheduler = new BehaviorScheduler({ execute: async i => { calls.push(i.kind); }, stop: () => {}, getState: () => ({ upright: false, fallen: true }) });
  await scheduler.run(compileMovement('if (duck.state.fallen) { await duck.recover(); } else { await duck.sit(); }'));
  assert.deepEqual(calls, ['recover']);
});
test('cancellation interrupts an adapter that ignores AbortSignal and stops the robot', async () => {
  let stops = 0;
  const scheduler = new BehaviorScheduler({ execute: () => new Promise(() => {}), stop: () => { stops++; } });
  const promise = scheduler.run(compileMovement('await duck.sit();'));
  setTimeout(() => scheduler.cancel(), 5);
  await assert.rejects(promise, /cancelled/);
  assert.ok(stops >= 1);
  assert.equal(scheduler.running, false);
});
test('pre-aborted execution never starts a controller command', async () => {
  let calls = 0;
  const scheduler = new BehaviorScheduler({ execute: async () => { calls++; }, stop: () => {} });
  const signal = AbortSignal.abort(new Error('already cancelled'));
  await assert.rejects(scheduler.run(compileMovement('await duck.sit();'), { signal }), /already cancelled/);
  assert.equal(calls, 0);
});
test('simultaneous execution is rejected and untrusted IR is revalidated', async () => {
  const scheduler = new BehaviorScheduler({ execute: () => new Promise(() => {}), stop: () => {} });
  const first = scheduler.run(compileMovement('await duck.sit();'));
  await assert.rejects(scheduler.run(compileMovement('await duck.sit();')), /Stop the current/);
  scheduler.cancel(); await assert.rejects(first);
  const tampered = compileMovement('await duck.walk({distance:1});');
  (tampered.instructions[0] as any).args.speed = 99;
  await assert.rejects(scheduler.run(tampered), /speed/);
});
