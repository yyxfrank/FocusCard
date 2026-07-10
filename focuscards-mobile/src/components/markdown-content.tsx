import Markdown from 'react-native-markdown-display';

type MarkdownContentProps = {
  children: string;
  style?: Record<string, any>;
};

export function MarkdownContent({ children, style }: MarkdownContentProps) {
  return <Markdown style={style}>{children}</Markdown>;
}
