import { parse } from 'acorn';

export const DSL_LIMITS = Object.freeze({ sourceBytes: 32768, instructions: 256, durationMs: 120000, repeat: 20, nesting: 4, commandMs: 30000 });
export type MovementKind = 'walk' | 'turn' | 'sit' | 'stand' | 'kick' | 'roll' | 'recover' | 'groundPick' | 'wait';
export type PolicyKey = 'walk' | 'sitstand' | 'kick_left' | 'kick_right' | 'roulade' | 'stand' | 'ground_pick';
export interface MovementInstruction {
  kind: MovementKind;
  args: Record<string, number | string>;
  timeoutMs: number;
  line: number;
}
export interface ConditionalInstruction {
  kind: 'condition';
  state: 'upright' | 'fallen';
  then: Instruction[];
  otherwise: Instruction[];
  line: number;
}
export type Instruction = MovementInstruction | ConditionalInstruction;
export interface MovementProgram {
  version: 1;
  instructions: Instruction[];
  durationMs: number;
  instructionCount: number;
  requiredPolicies: PolicyKey[];
}
// AST nodes are never executed; the compiler recursively accepts only the shapes below.
type Ast = { type: string; loc?: { start: { line: number; column: number } }; [key: string]: any };
export class MovementCompileError extends Error {
  readonly line: number;
  readonly column: number;
  readonly code: string;
  constructor(message: string, node?: Ast, code = 'INVALID_SYNTAX') {
    super(message);
    this.name = 'MovementCompileError';
    this.line = node?.loc?.start.line ?? 1;
    this.column = (node?.loc?.start.column ?? 0) + 1;
    this.code = code;
  }
}
function fail(message: string, node?: Ast, code?: string): never { throw new MovementCompileError(message, node, code); }
function scalar(node: Ast): string | number {
  if (node.type === 'Literal' && (typeof node.value === 'string' || typeof node.value === 'number') && !node.regex) return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  return fail('Arguments must be literal numbers or strings. Expressions and function calls are not permitted.', node);
}
function object(node: Ast | undefined): Record<string, number | string> {
  if (!node) return {};
  if (node.type !== 'ObjectExpression') fail('Pass command options as an object, for example { distance: 1 }.', node);
  const result: Record<string, number | string> = Object.create(null);
  for (const property of node.properties) {
    if (property.type !== 'Property' || property.computed || property.method || property.shorthand || property.kind !== 'init') fail('Only explicit literal option properties are allowed.', property);
    const name = property.key.type === 'Identifier' ? property.key.name : property.key.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : '';
    if (!name || ['__proto__', 'prototype', 'constructor'].includes(name) || Object.hasOwn(result, name)) fail('Invalid or duplicate option name.', property);
    result[name] = scalar(property.value);
  }
  return result;
}
function numeric(args: Record<string, number | string>, name: string, fallback: number | undefined, min: number, max: number, node: Ast): number {
  const value = args[name] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${name} must be a finite number between ${min} and ${max}.`, node, 'PHYSICAL_LIMIT');
  return value;
}
export const COMMAND_DOCS = Object.freeze({
  walk: 'await duck.walk({ distance: 0.5, speed: 0.25 }); // meters; requested m/s, actual motion is measured; negative distance walks backward',
  turn: 'await duck.turn({ degrees: 90 }); // signed degrees; commanded angular velocity 1 radian/second',
  sit: 'await duck.sit();', stand: 'await duck.stand();', kick: 'await duck.kick({ side: "left" });',
  roll: 'await duck.roll();', recover: 'await duck.recover();', groundPick: 'await duck.groundPick();',
  wait: 'await duck.wait({ seconds: 1 });',
});
function command(node: Ast): MovementInstruction {
  if (node.type !== 'AwaitExpression' || node.argument.type !== 'CallExpression') fail('Each movement must be awaited: await duck.walk({ distance: 1 });', node);
  const call = node.argument;
  const member = call.callee;
  if (member.type !== 'MemberExpression' || member.computed || member.optional || member.object.type !== 'Identifier' || member.object.name !== 'duck' || member.property.type !== 'Identifier' || call.optional) fail('Only allowlisted duck commands may be called.', call);
  const kind = member.property.name as MovementKind;
  if (!Object.hasOwn(COMMAND_DOCS, kind)) fail(`Unsupported command “${kind}”. Open the API reference for available commands.`, member, 'UNSUPPORTED_COMMAND');
  if (call.arguments.length > 1) fail('Commands accept at most one options object.', call);
  const input = object(call.arguments[0]);
  let args: Record<string, number | string> = {};
  let allowed: string[] = [];
  let duration = 4000;
  switch (kind) {
    case 'walk': {
      allowed = ['distance', 'speed'];
      const distance = numeric(input, 'distance', undefined, -5, 5, node);
      const speed = numeric(input, 'speed', distance < 0 ? 0.2 : 0.25, 0.05, distance < 0 ? 0.2 : 0.25, node);
      args = { distance, speed };
      // Policy velocity is a request, not measured progress. Official policy
      // tracking can be substantially slower, so reserve a conservative budget.
      duration = distance === 0 ? 100 : Math.abs(distance) / 0.07 * 1000 + 6000;
      break;
    }
    case 'turn': {
      allowed = ['degrees'];
      const degrees = numeric(input, 'degrees', undefined, -360, 360, node);
      args = { degrees };
      duration = degrees === 0 ? 100 : Math.abs(degrees) * Math.PI / 180 / 0.4 * 1000 + 5000;
      break;
    }
    case 'kick':
      allowed = ['side'];
      if (input.side !== 'left' && input.side !== 'right') fail('kick.side must be "left" or "right".', node);
      args = { side: input.side };
      break;
    case 'wait':
      allowed = ['seconds'];
      args = { seconds: numeric(input, 'seconds', undefined, 0, 20, node) };
      duration = Number(args.seconds) * 1000 + 100;
      break;
    case 'recover': case 'roll': duration = 8000; break;
    case 'sit': case 'stand': duration = 5000; break;
    case 'groundPick': duration = 6000; break;
  }
  for (const name of Object.keys(input)) if (!allowed.includes(name)) fail(`Unknown option “${name}” for duck.${kind}.`, node);
  if (duration > DSL_LIMITS.commandMs) fail(`This ${kind} command exceeds the ${DSL_LIMITS.commandMs / 1000}-second command budget. Reduce its distance.`, node, 'DURATION_LIMIT');
  return { kind, args, timeoutMs: Math.ceil(duration), line: node.loc?.start.line ?? 1 };
}
function canonicalLoop(node: Ast): number {
  const init = node.init;
  const test = node.test;
  const update = node.update;
  if (init?.type !== 'VariableDeclaration' || init.kind !== 'let' || init.declarations.length !== 1) fail('Repeat with: for (let i = 0; i < 3; i++) { ... }', node);
  const declaration = init.declarations[0];
  const name = declaration.id.name;
  if (declaration.id.type !== 'Identifier' || declaration.init?.type !== 'Literal' || declaration.init.value !== 0 || test?.type !== 'BinaryExpression' || test.operator !== '<' || test.left.type !== 'Identifier' || test.left.name !== name || test.right.type !== 'Literal' || update?.type !== 'UpdateExpression' || update.operator !== '++' || update.argument.type !== 'Identifier' || update.argument.name !== name || node.body.type !== 'BlockStatement') fail('Only bounded counter loops starting at zero and incrementing by one are allowed.', node);
  const count = test.right.value;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > DSL_LIMITS.repeat) fail(`Loop count must be a literal integer between 1 and ${DSL_LIMITS.repeat}.`, node, 'LOOP_LIMIT');
  return count;
}
function condition(node: Ast): 'upright' | 'fallen' {
  if (node.type !== 'MemberExpression' || node.computed || node.optional || node.object.type !== 'MemberExpression' || node.object.computed || node.object.optional || node.object.object.type !== 'Identifier' || node.object.object.name !== 'duck' || node.object.property.name !== 'state' || !['upright', 'fallen'].includes(node.property.name)) fail('Conditions may only read duck.state.upright or duck.state.fallen.', node);
  return node.property.name;
}
export function compileMovement(source: string): MovementProgram {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > DSL_LIMITS.sourceBytes) fail(`Movement source must be at most ${DSL_LIMITS.sourceBytes} bytes.`, undefined, 'SOURCE_LIMIT');
  let ast: Ast;
  try { ast = parse(source, { ecmaVersion: 2022, sourceType: 'module', allowAwaitOutsideFunction: true, locations: true }) as unknown as Ast; }
  catch (error) {
    const syntax = error as Error & { loc?: { line: number; column: number } };
    throw new MovementCompileError(syntax.message, syntax.loc ? { type: '', loc: { start: syntax.loc } } : undefined);
  }
  let count = 0;
  function block(statements: Ast[], depth: number): { items: Instruction[]; duration: number } {
    if (depth > DSL_LIMITS.nesting) fail(`Movements may nest at most ${DSL_LIMITS.nesting} levels.`, statements[0], 'NESTING_LIMIT');
    const items: Instruction[] = [];
    let duration = 0;
    for (const statement of statements) {
      if (statement.type === 'EmptyStatement') continue;
      if (++count > DSL_LIMITS.instructions) fail(`Movement exceeds ${DSL_LIMITS.instructions} instructions.`, statement, 'INSTRUCTION_LIMIT');
      if (statement.type === 'ExpressionStatement') {
        const instruction = command(statement.expression); items.push(instruction); duration += instruction.timeoutMs;
      } else if (statement.type === 'ForStatement') {
        const repetitions = canonicalLoop(statement);
        for (let i = 0; i < repetitions; i++) { const child = block(statement.body.body, depth + 1); items.push(...child.items); duration += child.duration; }
      } else if (statement.type === 'IfStatement') {
        const state = condition(statement.test);
        if (statement.consequent.type !== 'BlockStatement' || (statement.alternate && statement.alternate.type !== 'BlockStatement')) fail('Conditional branches must use braces.', statement);
        const yes = block(statement.consequent.body, depth + 1);
        const no = statement.alternate ? block(statement.alternate.body, depth + 1) : { items: [], duration: 0 };
        items.push({ kind: 'condition', state, then: yes.items, otherwise: no.items, line: statement.loc?.start.line ?? 1 }); duration += Math.max(yes.duration, no.duration);
      } else fail('Only awaited duck commands, bounded for loops, and permitted state conditions are allowed.', statement);
      if (duration > DSL_LIMITS.durationMs) fail(`Movement exceeds the ${DSL_LIMITS.durationMs / 1000}-second duration budget.`, statement, 'DURATION_LIMIT');
    }
    return { items, duration };
  }
  const compiled = block(ast.body, 0);
  if (!compiled.items.length) fail('Add at least one movement command.');
  const policies = new Set<PolicyKey>();
  function visit(instructions: Instruction[]) {
    for (const instruction of instructions) {
      if (instruction.kind === 'condition') { visit(instruction.then); visit(instruction.otherwise); continue; }
      if (instruction.kind === 'walk' || instruction.kind === 'turn') policies.add('walk');
      else if (instruction.kind === 'sit' || instruction.kind === 'stand') policies.add('sitstand');
      else if (instruction.kind === 'recover') policies.add('stand');
      else if (instruction.kind === 'roll') policies.add('roulade');
      else if (instruction.kind === 'groundPick') policies.add('ground_pick');
      else if (instruction.kind === 'kick') policies.add(instruction.args.side === 'left' ? 'kick_left' : 'kick_right');
    }
  }
  visit(compiled.items);
  return { version: 1, instructions: compiled.items, durationMs: compiled.duration, instructionCount: count, requiredPolicies: [...policies] };
}
export function formatMovement(program: Pick<MovementProgram, 'instructions'>): string {
  const render = (instructions: Instruction[], indentation = ''): string => instructions.map(instruction => {
    if (instruction.kind === 'condition') return `${indentation}if (duck.state.${instruction.state}) {\n${render(instruction.then, indentation + '  ')}\n${indentation}}${instruction.otherwise.length ? ` else {\n${render(instruction.otherwise, indentation + '  ')}\n${indentation}}` : ''}`;
    const options = Object.entries(instruction.args).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ');
    return `${indentation}await duck.${instruction.kind}(${options ? `{ ${options} }` : ''});`;
  }).join('\n');
  return render(program.instructions);
}
export function compileBlocks(blocks: Array<{ kind: MovementKind; args?: Record<string, number | string> }>): MovementProgram {
  if (!Array.isArray(blocks) || blocks.length > DSL_LIMITS.instructions) fail('Too many movement blocks.');
  // Recompile so visual editing cannot bypass the source compiler's validation.
  return compileMovement(formatMovement({ instructions: blocks.map(block => ({ ...block, args: block.args ?? {}, timeoutMs: 0, line: 1 })) }));
}
export interface MovementAdapter {
  execute(instruction: MovementInstruction, signal: AbortSignal): Promise<void>;
  stop(): void;
  getState?(): { upright: boolean; fallen: boolean };
}
export interface SchedulerEvent { type: 'start' | 'command' | 'complete' | 'cancelled' | 'error'; index?: number; instruction?: MovementInstruction; message?: string }
export class BehaviorScheduler {
  private controller?: AbortController;
  constructor(private readonly adapter: MovementAdapter) {}
  get running() { return Boolean(this.controller); }
  cancel() { this.controller?.abort(new Error('Movement cancelled.')); this.adapter.stop(); }
  async run(program: MovementProgram, options: { signal?: AbortSignal; onEvent?: (event: SchedulerEvent) => void } = {}): Promise<void> {
    if (this.running) throw new Error('Stop the current movement before starting another.');
    const validated = compileMovement(formatMovement(program));
    const controller = new AbortController();
    this.controller = controller;
    const cancel = () => controller.abort(options.signal?.reason ?? new Error('Movement cancelled.'));
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const totalTimer = setTimeout(() => controller.abort(new Error('Movement duration budget exceeded.')), DSL_LIMITS.durationMs);
    const emit = options.onEvent ?? (() => {});
    let index = 0;
    const execute = async (instructions: Instruction[]): Promise<void> => {
      for (const instruction of instructions) {
        controller.signal.throwIfAborted();
        if (instruction.kind === 'condition') {
          if (!this.adapter.getState) throw new Error('This simulator does not expose the state required by this conditional.');
          await execute(this.adapter.getState()[instruction.state] ? instruction.then : instruction.otherwise);
          continue;
        }
        emit({ type: 'command', index: index++, instruction });
        controller.signal.throwIfAborted();
        const commandController = new AbortController();
        const abort = () => commandController.abort(controller.signal.reason);
        controller.signal.addEventListener('abort', abort, { once: true });
        let rejectAbort: (reason: unknown) => void = () => {};
        const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
        const rejectOnAbort = () => rejectAbort(commandController.signal.reason ?? new Error('Movement cancelled.'));
        commandController.signal.addEventListener('abort', rejectOnAbort, { once: true });
        const timer = setTimeout(() => commandController.abort(new Error(`${instruction.kind} timed out after ${instruction.timeoutMs} ms.`)), instruction.timeoutMs);
        try { await Promise.race([this.adapter.execute(instruction, commandController.signal), interrupted]); }
        finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); commandController.signal.removeEventListener('abort', rejectOnAbort); }
      }
    };
    try { emit({ type: 'start' }); await execute(validated.instructions); emit({ type: 'complete' }); }
    catch (error) { emit({ type: controller.signal.aborted ? 'cancelled' : 'error', message: error instanceof Error ? error.message : 'Movement failed.' }); throw error; }
    finally { clearTimeout(totalTimer); options.signal?.removeEventListener('abort', cancel); this.adapter.stop(); this.controller = undefined; }
  }
}
