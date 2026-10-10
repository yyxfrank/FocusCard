import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { splitCodeExample, joinCodeExample } from '../focuscards-web/src/utils/codeExample.js';

const require = createRequire(new URL('../focuscards-mobile/package.json', import.meta.url));
const MarkdownIt = require('markdown-it');
const webRequire = createRequire(new URL('../focuscards-web/package.json', import.meta.url));
const { EditorState } = webRequire('@codemirror/state');
const { javascript } = webRequire('@codemirror/lang-javascript');
const { python } = webRequire('@codemirror/lang-python');
const { getIndentation, IndentContext } = webRequire('@codemirror/language');
const { closeBrackets, insertBracket } = webRequire('@codemirror/autocomplete');

test('legacy Markdown remains unchanged without Code mode', () => {
  const text = 'Explain loops\n\n```python\nprint(1)\n```';
  assert.equal(splitCodeExample(text).enabled, false);
  assert.equal(joinCodeExample(splitCodeExample(text)), text);
});

test('code examples round trip with whitespace, fences, and HTML safely', () => {
  const example = { text: 'Explain if/else\n', enabled: true, language: 'python',
    code: 'if ready:\n    print("```<script>alert(1)</script>")\nelse:\n    pass\n' };
  const saved = joinCodeExample(example);
  assert.deepEqual(splitCodeExample(saved), example);
  const html = new MarkdownIt({ html: false }).render(saved);
  assert.match(html, /language-python/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /focuscards-example|<script>/);
});

test('empty examples preserve enabled mode when reopened', () => {
  const example = { text: '', enabled: true, language: 'javascript', code: '' };
  assert.deepEqual(splitCodeExample(joinCodeExample(example)), example);
});

test('disabling code mode retains the original text', () => {
  assert.equal(joinCodeExample({ text: 'Question', enabled: false, language: 'java', code: 'class A {}' }), 'Question');
});

test('language parsers indent JavaScript and Python if/else bodies', () => {
  for (const [doc, extension, expected] of [
    ['if (ready) {', javascript(), 2],
    ['if ready:', python(), 2],
    ['if ready:\n  pass\nelse:', python(), 2],
  ]) {
    const state = EditorState.create({ doc, extensions: [extension] });
    assert.equal(getIndentation(new IndentContext(state, { simulateBreak: doc.length }), doc.length), expected);
  }
});

test('code editor completes matching brackets', () => {
  const state = EditorState.create({ extensions: [javascript(), closeBrackets()] });
  const transaction = insertBracket(state, '(');
  assert.equal(transaction.state.doc.toString(), '()');
  assert.equal(transaction.state.selection.main.head, 1);
});
