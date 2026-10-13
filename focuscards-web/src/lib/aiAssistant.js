import { splitCodeExample } from '../utils/codeExample.js';

export const AI_PROVIDERS = {
  openai: { label: 'OpenAI', model: 'gpt-4.1-mini', mode: 'Responses API', keyUrl: 'https://platform.openai.com/api-keys' },
  gemini: { label: 'Gemini', model: 'gemini-3.8-flash', mode: 'Gemini generateContent', keyUrl: 'https://aistudio.google.com/api-keys' },
  deepseek: { label: 'DeepSeek', model: 'deepseek-flash', mode: 'Chat Completions API', keyUrl: 'https://platform.deepseek.com/api_keys' },
};

export function initialAISettings() {
  return { provider: 'openai', providers: Object.fromEntries(Object.entries(AI_PROVIDERS)
    .map(([id, provider]) => [id, { model: provider.model, apiKey: '' }])) };
}

export function activeAISettings(settings) {
  const provider = settings?.provider;
  if (!Object.hasOwn(AI_PROVIDERS, provider)) throw new Error('请选择 AI 服务。');
  const chosen = settings.providers?.[provider];
  const apiKey = chosen?.apiKey?.trim() || '';
  const model = chosen?.model?.trim() || '';
  if (!/^[\x21-\x7e]{8,4096}$/.test(apiKey)) throw new Error('请先在用户信息页填写有效的 API Key。');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(model)) throw new Error('请在用户信息页填写有效的模型名称。');
  return { provider, api_key: apiKey, model };
}

export function questionForAI(front) {
  const example = splitCodeExample(front);
  const code = example.enabled && example.code.trim()
    ? `\n\n\`\`\`${example.language}\n${example.code}\n\`\`\`` : '';
  const question = `${example.text}${code}`.trim();
  if (!question) throw new Error('请先在闪卡正面填写问题。');
  if (question.length > 12000) throw new Error('正面内容不能超过 12000 个字符。');
  return question;
}

export async function requestAIAnswer(client, settings, front, signal) {
  const body = { ...activeAISettings(settings), question: questionForAI(front) };
  const { data, error } = await client.functions.invoke('ai-answer', { body, signal, timeout: 75000 });
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (error) {
    let message = '无法连接 AI 助手，请检查网络以及 ai-answer Edge Function 是否已部署。';
    if (error.context instanceof Response) {
      if (error.context.status === 404) message = 'AI 助手尚未部署，请先部署 ai-answer Edge Function。';
      else {
        try { const result = await error.context.json(); if (typeof result.error === 'string') message = result.error; }
        catch { /* Keep the connection error. */ }
      }
    }
    throw new Error(message.split(body.api_key).join('[API Key]'));
  }
  if (typeof data?.answer !== 'string' || !data.answer.trim()) throw new Error('AI 没有返回可用回答，请重试。');
  return data.answer.trim();
}

// A cancelled request may still finish on the server. Its result must not touch
// the editor, and repeated clicks must never create a second in-flight request.
export function createAIAnswerController({ requestAnswer, onAnswer, onState }) {
  let active = null;
  return {
    cancel(notify = true) {
      if (!active) return;
      const task = active;
      active = null;
      task.abort();
      if (notify) onState({ busy: false, error: '', generated: false });
    },
    async generate(settings, front) {
      if (active) return;
      try { questionForAI(front); activeAISettings(settings); }
      catch (failure) { onState({ busy: false, error: failure.message, generated: false }); return; }
      const task = new AbortController();
      active = task;
      onState({ busy: true, error: '', generated: false });
      try {
        const answer = await requestAnswer(settings, front, task.signal);
        if (active !== task || task.signal.aborted) return;
        active = null;
        onAnswer(answer);
        onState({ busy: false, error: '', generated: true });
      } catch (failure) {
        if (active !== task || task.signal.aborted) return;
        active = null;
        onState({ busy: false, error: failure.message || 'AI 生成失败，请重试。', generated: false });
      }
    },
  };
}
