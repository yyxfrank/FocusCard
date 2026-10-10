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
    <style>body{margin:0;font-family:system-ui;font-size:${Number(style?.body?.fontSize) || 18}px;
    line-height:1.45;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#eee;padding:12px}
    math{font-size:1.1em}math[display=block]{overflow-x:auto}img{max-width:100%}</style>
    </head><body>${parser.render(children)}<script>
    const report=()=>window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
    new ResizeObserver(report).observe(document.body);report();
    </script></body></html>`, [children, style]);
  return <WebView source={{ html }} originWhitelist={['*']} scrollEnabled={false} pointerEvents="none"
    style={{ height, backgroundColor: 'transparent' }}
    onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
    onMessage={(event) => {
      const value = Number(event.nativeEvent.data);
      if (Number.isFinite(value) && value > 0) setHeight(value);
    }} />;
}
