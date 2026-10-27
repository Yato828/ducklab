import test from 'node:test';
import assert from 'node:assert/strict';
import { AIConfigurationError, generateMovement } from './ai.js';

test('AI generation fails closed without a real configured provider', async () => {
  await assert.rejects(generateMovement({prompt:'walk',userId:'test'},{}),AIConfigurationError);
});
test('AI adapter requests structured Responses output and recompiles actual returned source', async () => {
  const previous = globalThis.fetch;
  let body: any;
  globalThis.fetch = (async (_url: any, options: any) => {
    body=JSON.parse(options.body);
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({script:'await duck.walk({distance:.3});',explanation:'Walk forward.'})}]}],usage:{input_tokens:20,output_tokens:10}});
  }) as typeof fetch;
  try {
    const result=await generateMovement({prompt:'walk',userId:'test-safe'}, {apiKey:'unit-test-only',model:'configured-test-model'});
    assert.equal(result.program.instructions[0].kind,'walk'); assert.equal(result.validation.physics,false);
    assert.equal(body.text.format.type,'json_schema'); assert.equal(body.store,false); assert.equal(result.usage.totalTokens,30);
  } finally {globalThis.fetch=previous;}
});
test('model output cannot bypass movement restrictions', async () => {
  const previous=globalThis.fetch;
  globalThis.fetch=(async () => Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({script:'await fetch("https://evil.example")',explanation:'Unsafe'})}]}],usage:{input_tokens:1,output_tokens:1}})) as typeof fetch;
  try { await assert.rejects(generateMovement({prompt:'walk',userId:'test-unsafe'}, {apiKey:'unit-test-only',model:'configured-test-model'}), /allowlisted/); }
  finally {globalThis.fetch=previous;}
});
