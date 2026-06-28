import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/contexts/ThemeContext';

const MATHJAX_HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  body { margin: 0; padding: 2px; background: transparent; font-size: {{FONT_SIZE}}px; }
  #math { color: {{TEXT_COLOR}}; }
</style>
<script>
window.MathJax = {
  tex: { inlineMath: [['$','$']], displayMath: [['$$','$$']] },
  svg: { fontCache: 'global' },
  startup: {
    pageReady: () => MathJax.startup.defaultPageReady().then(() => {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: document.body.scrollHeight }));
    })
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</head>
<body>
<div id="math">{{LATEX}}</div>
</body>
</html>
`;

interface MathTextProps {
  latex: string;
  textColor: string;
  fontSize?: number;
}

const MathText = React.memo(function MathText({ latex, textColor, fontSize = 15 }: MathTextProps) {
  const processedLatex = latex
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\\n/g, ' ');

  const html = MATHJAX_HTML_TEMPLATE
    .replace(/{{LATEX}}/g, processedLatex)
    .replace(/{{TEXT_COLOR}}/g, textColor)
    .replace(/{{FONT_SIZE}}/g, String(fontSize));

  return (
    <View style={{ minHeight: 20 }}>
      <WebView
        source={{ html }}
        style={{ backgroundColor: 'transparent', height: 50, opacity: 99 }}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'height') {
              (e.target as any).setNativeProps({ style: { height: data.height + 4 } });
            }
          } catch (_) {}
        }}
      />
    </View>
  );
});

interface MathMarkdownProps {
  text: string;
  color?: string;
  fontSize?: number;
  style?: any;
}

export default function MathMarkdown({ text, color, fontSize = 15, style }: MathMarkdownProps) {
  const { colors, isDark } = useTheme();
  const textColor = color || colors.text;

  // Split text into segments: alternating markdown and latex
  const segments = useMemo(() => {
    if (!text) return [{ type: 'markdown', content: '' }];
    const result: { type: 'latex' | 'markdown'; content: string }[] = [];
    // Match $$...$$ (block) or $...$ (inline) LaTeX
    const regex = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add preceding markdown
      if (match.index > lastIndex) {
        result.push({ type: 'markdown', content: text.slice(lastIndex, match.index) });
      }
      // Add latex
      const latexContent = match[1] !== undefined ? match[1] : match[2];
      if (latexContent) {
        result.push({ type: 'latex', content: match[0] });
      }
      lastIndex = regex.lastIndex;
    }
    // Add remaining markdown
    if (lastIndex < text.length) {
      result.push({ type: 'markdown', content: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  const markdownStyles = useMemo(() => ({
    body: { color: textColor, fontSize, lineHeight: fontSize * 1.5 },
    heading1: { color: textColor, fontSize: fontSize + 7, fontWeight: '800' as const, marginTop: 14, marginBottom: 6 },
    heading2: { color: textColor, fontSize: fontSize + 4, fontWeight: '700' as const, marginTop: 12, marginBottom: 6 },
    heading3: { color: textColor, fontSize: fontSize + 2, fontWeight: '700' as const, marginTop: 10, marginBottom: 4 },
    paragraph: { color: textColor, fontSize, lineHeight: fontSize * 1.5, marginTop: 2, marginBottom: 8 },
    code_inline: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: colors.inputBg,
      color: colors.primary,
      borderRadius: 4,
    },
    code_block: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: isDark ? '#161618' : '#F3F4F6',
      color: textColor,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fence: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: isDark ? '#161618' : '#F3F4F6',
      color: textColor,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockquote: {
      backgroundColor: isDark ? '#1C1D24' : '#F3F4F6',
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    list_item: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, marginBottom: 6 },
    bullet_list_icon: { color: colors.primary, fontSize: 20, marginLeft: 0 },
  }), [textColor, fontSize, colors, isDark]);

  return (
    <View style={style}>
      {segments.map((seg, i) =>
        seg.type === 'latex' ? (
          <MathText key={i} latex={seg.content} textColor={textColor} fontSize={fontSize} />
        ) : (
          seg.content.trim() ? (
            <Markdown key={i} style={markdownStyles as any}>
              {seg.content}
            </Markdown>
          ) : null
        )
      )}
    </View>
  );
}