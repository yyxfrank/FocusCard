export const MAX_QUESTION_LENGTH = 12000;
export const AI_INSTRUCTIONS = 'You write the answer side of a study flashcard. Answer the question accurately and concisely in the same language as the question. Use Markdown, fenced code blocks when helpful, and $...$ or $$...$$ for mathematical notation. Include the key explanation needed for recall. If the question is ambiguous or has a false premise, explain that briefly. Return only the answer, without HTML, a greeting, or commentary about creating the card.';

export function validateInput(body) {
  if (!body || !['openai', 'gemini', 'deepseek'].includes(body.provider)) throw new Error('请选择 OpenAI、Gemini 或 DeepSeek。');
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(model)) throw new Error('请填写有效的模型名称。');
  if (!/^[\x21-\x7e]{8,4096}$/.test(apiKey)) throw new Error('请填写有效的 API Key。');
  if (!question) throw new Error('请先在闪卡正面填写问题。');
  if (question.length > MAX_QUESTION_LENGTH) throw new Error(`正面内容不能超过 ${MAX_QUESTION_LENGTH} 个字符。`);
  return { provider: body.provider, model, apiKey, question };
}

export function providerRequest({ provider, model, apiKey, question }) {
  const headers = { 'Content-Type': 'application/json' };
  if (provider === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, headers,
      body: { systemInstruction: { parts: [{ text: AI_INSTRUCTIONS }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 4096 } } };
  }
  headers.Authorization = `Bearer ${apiKey}`;
  if (provider === 'openai') return { url: 'https://api.openai.com/v1/responses', headers,
    body: { model, instructions: AI_INSTRUCTIONS, input: question, max_output_tokens: 4096, store: false } };
  return { url: 'https://api.deepseek.com/chat/completions', headers,
    body: { model, messages: [{ role: 'system', content: AI_INSTRUCTIONS }, { role: 'user', content: question }],
      max_tokens: 4096, stream: false } };
}

export function providerAnswer(provider, data) {
  if (!data || typeof data !== 'object') throw new Error('AI 服务返回了无法读取的数据，请稍后重试。');
  let text;
  if (provider === 'openai') {
    if (data.status === 'incomplete') throw new Error('回答未完成，可能超过输出限制。请简化问题后重试。');
    text = (data.output ?? []).filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? []).filter((item) => item.type === 'output_text')
      .map((item) => item.text).join('\n');
  } else if (provider === 'gemini') {
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('回答超过输出限制，请简化问题后重试。');
    text = (candidate?.content?.parts ?? []).filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text).join('\n');
  } else {
    if (data.choices?.[0]?.finish_reason === 'length') throw new Error('回答超过输出限制，请简化问题后重试。');
    text = data.choices?.[0]?.message?.content;
  }
  if (typeof text !== 'string' || !text.trim()) throw new Error('模型没有返回可用回答，可能拒绝了该问题。请修改问题或更换模型。');
  return text.trim();
}

export function providerError(status) {
  if (status === 401 || status === 403) return 'AI 服务拒绝访问，请检查 API Key、模型权限和地区限制。';
  if (status === 429 || status === 402) return 'AI 服务额度不足或请求过于频繁，请检查余额并稍后重试。';
  if (status === 404) return '找不到该模型，请在用户信息页检查模型名称。';
  if (status === 400 || status === 422) return 'AI 服务不接受该请求，请检查模型是否支持当前调用模式。';
  return 'AI 服务暂时不可用，请稍后重试。';
}
