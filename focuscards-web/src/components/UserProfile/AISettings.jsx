import { useState } from 'react';
import { AI_PROVIDERS, activeAISettings } from '../../lib/aiAssistant.js';

export default function AISettings({ settings, onSave }) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState(null);
  const info = AI_PROVIDERS[draft.provider];
  const chosen = draft.providers[draft.provider];
  const update = (field, value) => {
    setDraft((previous) => ({ ...previous, providers: { ...previous.providers,
      [previous.provider]: { ...previous.providers[previous.provider], [field]: value } } }));
    setMessage(null);
  };
  const save = (event) => {
    event.preventDefault();
    try {
      const valid = activeAISettings(draft);
      const next = { ...draft, providers: { ...draft.providers,
        [draft.provider]: { apiKey: valid.api_key, model: valid.model } } };
      onSave(next);
      setDraft(next);
      setMessage({ error: false, text: '已启用。返回闪卡界面，在反面上方勾选“AI回答”即可生成。' });
    } catch (failure) { setMessage({ error: true, text: failure.message }); }
  };

  return <section className="profile-ai-settings" aria-labelledby="ai-settings-title">
    <div className="profile-library-heading"><div><h2 id="ai-settings-title">AI 助手</h2>
      <p>用你自己的 API Key，为闪卡生成答案。</p></div>
      <span className="ai-settings-badge">{settings.providers[settings.provider].apiKey ? `${AI_PROVIDERS[settings.provider].label} 已设置` : '尚未设置'}</span>
    </div>
    <form className="ai-settings-form" onSubmit={save}>
      <label>API 服务<select value={draft.provider} onChange={(event) => {
        setDraft((previous) => ({ ...previous, provider: event.target.value })); setShowKey(false); setMessage(null);
      }}>{Object.entries(AI_PROVIDERS).map(([id, provider]) => <option key={id} value={id}>{provider.label}</option>)}</select></label>
      <label>模型名称<input value={chosen.model} onChange={(event) => update('model', event.target.value)}
        placeholder={info.model} required maxLength={100} spellCheck={false} autoCapitalize="none" /></label>
      <div className="ai-key-label"><label htmlFor="ai-api-key">API Key</label><div className="ai-key-input">
        <input id="ai-api-key" type={showKey ? 'text' : 'password'} value={chosen.apiKey} onChange={(event) => update('apiKey', event.target.value)}
          placeholder="粘贴该服务的 API Key" required maxLength={4096} autoComplete="off" spellCheck={false} autoCapitalize="none" />
        <button type="button" aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} aria-pressed={showKey}
          onClick={() => setShowKey(!showKey)}>{showKey ? '隐藏' : '显示'}</button>
      </div></div>
      <div className="ai-settings-meta"><span>调用模式：{info.mode}</span>
        <a href={info.keyUrl} target="_blank" rel="noopener noreferrer">获取 {info.label} API Key ↗</a></div>
      <p className="ai-settings-note">Key 仅保留在本次页面，刷新或退出登录后需要重新填写。生成时，正面内容与 Key 会经本站服务转发给所选 AI 服务；调用费用由该服务从你的账户扣除。</p>
      <div className="ai-settings-buttons"><button type="submit" className="ai-primary-button">保存并启用</button>
        <button type="button" className="ai-secondary-button" disabled={!chosen.apiKey} onClick={() => {
          const next = { ...draft, providers: { ...draft.providers, [draft.provider]: { ...chosen, apiKey: '' } } };
          setDraft(next);
          // Forget the same provider in the live settings immediately, even if
          // the current form has other unsaved edits or another provider selected.
          onSave({ ...settings, providers: { ...settings.providers,
            [draft.provider]: { ...settings.providers[draft.provider], apiKey: '' } } });
          setShowKey(false); setMessage({ error: false, text: '该服务的 API Key 已清除。' });
        }}>清除 Key</button></div>
      {message && <p className={`ai-settings-message ${message.error ? 'is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  </section>;
}
