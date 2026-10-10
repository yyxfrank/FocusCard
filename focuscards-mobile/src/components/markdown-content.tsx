import { useMemo, useState } from 'react';
import { MarkdownIt } from 'react-native-markdown-display';
import { WebView } from 'react-native-webview';
import { renderToString } from 'katex';
import { configureMathMarkdown } from '@/utils/mathMarkdown';

const parser = configureMathMarkdown(new MarkdownIt({ html: false, linkify: true }), renderToString);

type MarkdownContentProps = {
  children: string;
  style?: Record<string, any>;
};

export function MarkdownContent({ children, style }: MarkdownContentProps) {
  const [height, setHeight] = useState(80);
  const html = useMemo(() => `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;padding:0}#content{display:flow-root;padding-bottom:4px;font-family:system-ui;font-size:${Number(style?.body?.fontSize) || 18}px;
    line-height:1.45;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#09090b;color:#f4f4f5;padding:12px;border-radius:8px;font-size:14px}pre code{font-family:monospace}
    math{font-size:1.1em}math[display=block]{overflow-x:auto}img{max-width:100%}</style>
    </head><body><div id="content">${parser.render(children)}</div><script>
    const content=document.getElementById('content');
    const report=()=>window.ReactNativeWebView.postMessage(String(Math.ceil(Math.max(content.scrollHeight,content.getBoundingClientRect().height))));
    new ResizeObserver(report).observe(content);
    window.addEventListener('load',report);
    if(document.fonts) document.fonts.ready.then(report);
    report();
    </script></body></html>`, [children, style]);
  return <WebView source={{ html }} originWhitelist={['*']} scrollEnabled={false} pointerEvents="none"
    containerStyle={{ flex: 0, flexShrink: 0, height }}
    style={{ flex: 0, flexShrink: 0, height, backgroundColor: 'transparent' }}
    onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
    onMessage={(event) => {
      const value = Number(event.nativeEvent.data);
      if (Number.isFinite(value) && value > 0) setHeight(value);
    }} />;
}
