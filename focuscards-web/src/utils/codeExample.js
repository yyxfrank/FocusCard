// A tagged trailing Markdown fence keeps examples compatible with every client.
export function splitCodeExample(value = '') {
  const match = /(?:^|\n\n)(`{3,})([\w+#-]+) focuscards-example\n([\s\S]*?)\n\1$/.exec(value);
  if (!match) return { text: value, enabled: false, language: 'javascript', code: '' };
  return { text: value.slice(0, match.index), enabled: true, language: match[2], code: match[3] };
}

export function joinCodeExample({ text, enabled, language, code }) {
  if (!enabled) return text;
  const longest = Math.max(2, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${text}${text ? '\n\n' : ''}${fence}${language} focuscards-example\n${code}\n${fence}`;
}
