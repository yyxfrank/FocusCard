import { createClient } from 'npm:@supabase/supabase-js@2.110.1';
import { validateInput, providerRequest, providerAnswer, providerError } from './provider.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reply({ error: '请先登录后使用 AI 助手。' }, 401);
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return reply({ error: '登录已失效，请重新登录。' }, 401);
  } catch {
    return reply({ error: '暂时无法验证登录，请稍后重试。' }, 503);
  }

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return reply({ error: '请求内容过长，请简化问题。' }, 413);
    input = validateInput(JSON.parse(raw));
  } catch (failure) {
    return reply({ error: failure instanceof SyntaxError ? '请求格式不正确。' : (failure as Error).message }, 400);
  }

  const controller = new AbortController();
  const disconnected = () => controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
  request.signal.addEventListener('abort', disconnected, { once: true });
  try {
    if (request.signal.aborted) controller.abort();
    const upstream = providerRequest(input);
    const response = await fetch(upstream.url, { method: 'POST', headers: upstream.headers,
      body: JSON.stringify(upstream.body), signal: controller.signal, redirect: 'error' });
    // Do not return provider error bodies: they may echo credentials or prompts.
    if (!response.ok) return reply({ error: providerError(response.status) }, 502);
    let body;
    try { body = await response.json(); }
    catch { return reply({ error: 'AI 服务返回了无法读取的数据，请稍后重试。' }, 502); }
    let answer;
    try { answer = providerAnswer(input.provider, body); }
    catch (failure) { return reply({ error: (failure as Error).message }, 502); }
    // Keys are supplied per request, never logged, persisted, or sent to another host.
    return reply({ answer: answer.split(input.apiKey).join('[API Key]') });
  } catch {
    return reply({ error: timedOut ? 'AI 回答超时，请简化问题后重试。' : controller.signal.aborted
      ? 'AI 请求已取消。' : '无法连接 AI 服务，请稍后重试。' }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', disconnected);
  }
});
