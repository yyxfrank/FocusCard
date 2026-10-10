import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { configureMathMarkdown } from '../focuscards-mobile/src/utils/mathMarkdown.js';
const requireMobile = createRequire(new URL('../focuscards-mobile/package.json', import.meta.url));
const MarkdownIt = requireMobile('markdown-it');
const { renderToString } = requireMobile('katex');
const parser = configureMathMarkdown(new MarkdownIt({ html: false }), renderToString);
test('native inline and multiline display math produce MathML', () => {
  assert.match(parser.render('Formula: $x^2$'), /<math/);
  const html = parser.render('$$\nx^2\n\n+ y^2\n$$');
  assert.match(html, /display="block"/);
  assert.doesNotMatch(html, /\$\$/);
});
test('code and escaped dollars retain their original meaning', () => {
  const html = parser.render('`$x$`\n\n```js\nconst x = "$y$";\n```\n\n\\$cost');
  assert.doesNotMatch(html, /<math/);
  assert.match(html, /\$x\$/);
  assert.match(html, /\$y\$/);
  assert.match(html, /\$cost/);
});
test('malformed math is readable and untrusted HTML never becomes a script', () => {
  assert.doesNotThrow(() => parser.render('$\\invalidcommand{x}$'));
  const html = parser.render('<script>alert(1)</script>\n\n$\\text{</script>}$');
  assert.doesNotMatch(html, /<script>|<\/script>/);
});
