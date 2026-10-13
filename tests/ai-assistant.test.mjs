import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initialAISettings, activeAISettings, questionForAI, requestAIAnswer, createAIAnswerController } from '../focuscards-web/src/lib/aiAssistant.js';
import { joinCodeExample } from '../focuscards-web/src/utils/codeExample.js';
import { validateInput, providerRequest, providerAnswer, providerError } from '../supabase/functions/ai-answer/provider.mjs';

function configured(provider = 'openai') {
  const settings = initialAISettings();
  settings.provider = provider;
  settings.providers[provider].apiKey = 'test-key-not-a-real-key';
  return settings;
}

test('keys are independent by account and provider; questions include code without editor metadata', () => {
  const first = configured();
  const second = initialAISettings();
  assert.equal(second.providers.openai.apiKey, '');
  assert.equal(first.providers.gemini.apiKey, '');
  assert.equal(activeAISettings(first).api_key, 'test-key-not-a-real-key');
  first.provider = 'gemini';
  assert.throws(() => activeAISettings(first), /API Key/);
  const front = joinCodeExample({ text: 'What does this do?', enabled: true, language: 'python', code: 'print(1)' });
  assert.equal(questionForAI(front), 'What does this do?\n\n```python\nprint(1)\n```');
  assert.throws(() => questionForAI(' '), /正面/);
  assert.throws(() => questionForAI('x'.repeat(12001)), /12000/);
});

test('provider adapters use official fixed hosts and return only complete answer text', () => {
  const question = 'Explain $x^2$';
  for (const provider of ['openai', 'gemini', 'deepseek']) {
    const input = validateInput({ ...activeAISettings(configured(provider)), question, base_url: 'https://attacker.invalid' });
    const request = providerRequest(input);
    assert.doesNotMatch(request.url, /attacker|test-key/);
    assert.match(JSON.stringify(request.body), /Explain/);
    assert.equal(Object.values(request.headers).includes(provider === 'gemini' ? input.apiKey : `Bearer ${input.apiKey}`), true);
  }
  assert.equal(providerRequest(validateInput({ ...activeAISettings(configured()), question })).body.store, false);
  assert.equal(providerAnswer('openai', { status: 'completed', output: [
    { type: 'reasoning', summary: [{ text: 'private reasoning' }] },
    { type: 'message', content: [{ type: 'output_text', text: '**Answer**' }, { type: 'output_text', text: '$x^2$' }] },
  ] }), '**Answer**\n$x^2$');
  assert.equal(providerAnswer('gemini', { candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'private reasoning' }, { text: 'Answer' },
  ] } }] }), 'Answer');
  assert.equal(providerAnswer('deepseek', { choices: [{ message: { content: 'Answer', reasoning_content: 'private reasoning' } }] }), 'Answer');
  assert.throws(() => providerAnswer('openai', { status: 'incomplete' }), /未完成/);
  assert.throws(() => providerAnswer('gemini', { candidates: [{ finishReason: 'MAX_TOKENS' }] }), /输出限制/);
  assert.throws(() => providerAnswer('deepseek', { choices: [{ finish_reason: 'length' }] }), /输出限制/);
  assert.throws(() => providerAnswer('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), /可用回答/);
  assert.throws(() => validateInput({ provider: 'custom' }), /请选择/);
  assert.throws(() => validateInput({ ...activeAISettings(configured()), question, model: '../../bad-host' }), /模型/);
  assert.throws(() => validateInput({ ...activeAISettings(configured()), question, api_key: 'key\r\nInjected: yes' }), /Key/);
  assert.match(providerError(429), /额度/);
});

test('front-end function calls send only the selected provider and handle deployment / credential errors', async () => {
  let options;
  const signal = new AbortController().signal;
  const client = { functions: { invoke: async (name, input) => {
    assert.equal(name, 'ai-answer'); options = input; return { data: { answer: ' **Answer** ' } };
  } } };
  const settings = configured('gemini');
  settings.providers.openai.apiKey = 'other-provider-secret';
  assert.equal(await requestAIAnswer(client, settings, 'Question', signal), '**Answer**');
  assert.equal(options.signal, signal);
  assert.equal(options.timeout, 75000);
  assert.equal(options.body.provider, 'gemini');
  assert.doesNotMatch(JSON.stringify(options.body), /other-provider-secret/);
  client.functions.invoke = async () => ({ error: { context: new Response('', { status: 404 }) } });
  await assert.rejects(requestAIAnswer(client, settings, 'Question'), /尚未部署/);
  client.functions.invoke = async () => ({ error: { context: Response.json({ error: 'Invalid test-key-not-a-real-key' }, { status: 502 }) } });
  await assert.rejects(requestAIAnswer(client, settings, 'Question'), (failure) => !failure.message.includes('test-key-not-a-real-key'));
  client.functions.invoke = async () => ({ data: { answer: '' } });
  await assert.rejects(requestAIAnswer(client, settings, 'Question'), /可用回答/);
});

test('generation suppresses double clicks and cancelled late results cannot overwrite a newer draft', async () => {
  const pending = [];
  const answers = [];
  const states = [];
  const controller = createAIAnswerController({ requestAnswer: (_settings, front, signal) => new Promise((resolve) => pending.push({ front, signal, resolve })),
    onAnswer: (answer) => answers.push(answer), onState: (state) => states.push(state) });
  const old = controller.generate(configured(), 'Old question');
  await controller.generate(configured(), 'Double click');
  assert.equal(pending.length, 1);
  controller.cancel();
  assert.equal(pending[0].signal.aborted, true);
  const current = controller.generate(configured(), 'New question');
  pending[0].resolve('Old answer');
  await old;
  assert.deepEqual(answers, []);
  assert.equal(states.at(-1).busy, true);
  pending[1].resolve('New answer');
  await current;
  assert.deepEqual(answers, ['New answer']);
  assert.deepEqual(states.at(-1), { busy: false, error: '', generated: true });
});

test('failed generations preserve the manual answer, validate before sending and remain retryable', async () => {
  let shouldFail = true;
  let calls = 0;
  let answer = 'Manual answer';
  let state;
  const controller = createAIAnswerController({ requestAnswer: async () => { calls++; if (shouldFail) throw new Error('Quota exhausted'); return 'Generated answer'; },
    onAnswer: (value) => { answer = value; }, onState: (value) => { state = value; } });
  await controller.generate(initialAISettings(), 'Question');
  assert.equal(calls, 0);
  await controller.generate(configured(), '');
  assert.equal(calls, 0);
  await controller.generate(configured(), 'Question');
  assert.equal(answer, 'Manual answer');
  assert.equal(state.busy, false);
  assert.equal(state.error, 'Quota exhausted');
  shouldFail = false;
  await controller.generate(configured(), 'Question');
  assert.equal(answer, 'Generated answer');
});

async function edgeFixture() {
  const require = createRequire(new URL('../focuscards-mobile/package.json', import.meta.url));
  const ts = require('typescript');
  const source = await readFile(new URL('../supabase/functions/ai-answer/index.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler;
  let authAllowed = true;
  let response = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Answer' }] }] };
  let status = 200;
  let timeout;
  let shouldTimeout = false;
  const calls = [];
  new Function('Deno', 'createClient', 'validateInput', 'providerRequest', 'providerAnswer', 'providerError', 'fetch', 'setTimeout', 'clearTimeout', code)(
    { env: { get: (name) => name }, serve: (fn) => { handler = fn; } },
    (_url, key) => {
      assert.equal(key, 'SUPABASE_ANON_KEY');
      return { auth: { getUser: async (token) => ({ data: { user: authAllowed && token === 'test-session' ? { id: 'user' } : null } }) } };
    }, validateInput, providerRequest, providerAnswer, providerError,
    async (url, options) => {
      calls.push({ url, options });
      if (shouldTimeout) { timeout(); throw new DOMException('Aborted', 'AbortError'); }
      return Response.json(response, { status });
    }, (fn) => { timeout = fn; return 1; }, () => {},
  );
  const invoke = (body = { ...activeAISettings(configured()), question: 'Question' }, token = 'test-session', method = 'POST') => handler(new Request('https://app.invalid/ai-answer', {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }));
  return { invoke, calls, setAuth(value) { authAllowed = value; },
    respond(value, code = 200) { response = value; status = code; }, timeOut() { shouldTimeout = true; } };
}

test('Edge handler authenticates before provider calls and refuses invalid inputs or anonymous access', async () => {
  const fixture = await edgeFixture();
  assert.equal((await fixture.invoke(undefined, '')).status, 401);
  assert.equal((await fixture.invoke(undefined, 'expired-token')).status, 401);
  assert.equal((await fixture.invoke({ provider: 'custom' })).status, 400);
  assert.equal((await fixture.invoke(null)).status, 400);
  assert.equal((await fixture.invoke(undefined, '', 'OPTIONS')).status, 200);
  assert.equal((await fixture.invoke(undefined, '', 'GET')).status, 405);
  assert.equal(fixture.calls.length, 0);
  const response = await fixture.invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: 'Answer' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(fixture.calls[0].options.redirect, 'error');
  assert.equal(fixture.calls[0].url, 'https://api.openai.com/v1/responses');
  fixture.setAuth(false);
  assert.equal((await fixture.invoke()).status, 401);
  assert.equal(fixture.calls.length, 1);
});

test('Edge provider failures and timeouts expose no keys, reasoning or raw provider error bodies', async () => {
  const fixture = await edgeFixture();
  fixture.respond({ error: { message: 'echo test-key-not-a-real-key' } }, 401);
  const failure = await fixture.invoke();
  assert.equal(failure.status, 502);
  assert.match((await failure.json()).error, /API Key/);
  fixture.respond({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'echo test-key-not-a-real-key' }] }] });
  assert.deepEqual(await (await fixture.invoke()).json(), { answer: 'echo [API Key]' });
  fixture.respond({ candidates: [{ content: { parts: [{ thought: true, text: 'hidden reasoning' }, { text: 'Gemini answer' }] } }] });
  assert.deepEqual(await (await fixture.invoke({ ...activeAISettings(configured('gemini')), question: 'Q' })).json(), { answer: 'Gemini answer' });
  fixture.respond({ choices: [{ message: { content: 'DeepSeek answer', reasoning_content: 'hidden reasoning' } }] });
  assert.deepEqual(await (await fixture.invoke({ ...activeAISettings(configured('deepseek')), question: 'Q' })).json(), { answer: 'DeepSeek answer' });
  fixture.timeOut();
  const timeout = await fixture.invoke();
  assert.equal(timeout.status, 504);
  assert.match((await timeout.json()).error, /超时/);
});
