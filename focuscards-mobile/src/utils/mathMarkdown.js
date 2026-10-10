// Dependencies are supplied by the native renderer so this parser can also
// be tested without loading React Native or a WebView.
export function configureMathMarkdown(parser, renderMath) {
  parser.inline.ruler.before('escape', 'math', (state, silent) => {
    if (state.src[state.pos] !== '$') return false;
    const delimiter = state.src.startsWith('$$', state.pos) ? '$$' : '$';
    const start = state.pos + delimiter.length;
    if (delimiter === '$' && /\s/.test(state.src[start] ?? '')) return false;
    let end = start;
    while ((end = state.src.indexOf(delimiter, end)) !== -1) {
      let backslashes = 0;
      for (let i = end - 1; i >= 0 && state.src[i] === '\\'; i--) backslashes++;
      if (backslashes % 2 === 0) break;
      end += delimiter.length;
    }
    if (end === -1 || end === start) return false;
    if (delimiter === '$' && /\s/.test(state.src[end - 1])) return false;
    if (!silent) {
      const token = state.push('math', '', 0);
      token.content = state.src.slice(start, end);
      token.block = delimiter.length === 2;
    }
    state.pos = end + delimiter.length;
    return true;
  });
  parser.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(start, state.eMarks[startLine]).trim() !== '$$') return false;
    let closing = startLine + 1;
    for (; closing < endLine; closing++) {
      if (state.src.slice(state.bMarks[closing] + state.tShift[closing], state.eMarks[closing]).trim() === '$$') break;
    }
    if (closing === endLine) return false;
    if (silent) return true;
    const token = state.push('math', '', 0);
    token.content = state.getLines(startLine + 1, closing, state.blkIndent, false);
    token.block = true;
    token.map = [startLine, closing + 1];
    state.line = closing + 1;
    return true;
  });
  parser.renderer.rules.math = (tokens, index) => renderMath(tokens[index].content, {
    displayMode: tokens[index].block, output: 'mathml', throwOnError: false, trust: false,
  });
  return parser;
}
