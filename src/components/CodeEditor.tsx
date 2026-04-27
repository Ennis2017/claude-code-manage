import Editor, { OnChange, OnMount, BeforeMount } from '@monaco-editor/react';
import type * as MonacoNS from 'monaco-editor';

export type CodeLanguage = 'json' | 'markdown';

const CC_THEME_NAME = 'cc-anthropic';

function defineCcTheme(monaco: typeof MonacoNS) {
  monaco.editor.defineTheme(CC_THEME_NAME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1F1B16' },
      { token: 'comment', foreground: '8B8178', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'B8543A', fontStyle: 'bold' },
      { token: 'keyword.json', foreground: 'B8543A' },
      { token: 'string', foreground: '4A5B3D' },
      { token: 'string.key.json', foreground: 'B8543A' },
      { token: 'string.value.json', foreground: '4A5B3D' },
      { token: 'number', foreground: 'D97757' },
      { token: 'number.json', foreground: 'D97757' },
      { token: 'delimiter', foreground: '8B8178' },
      { token: 'delimiter.bracket.json', foreground: '8B8178' },
      { token: 'delimiter.array.json', foreground: '8B8178' },
      { token: 'delimiter.colon.json', foreground: '8B8178' },
      { token: 'delimiter.comma.json', foreground: '8B8178' },
      { token: 'attribute.name', foreground: 'B8543A' },
      { token: 'attribute.value', foreground: '4A5B3D' },
      { token: 'tag', foreground: '6D4566' },
      // Markdown
      { token: 'keyword.md', foreground: 'B8543A' },
      { token: 'string.link.md', foreground: 'D97757' },
      { token: 'string.escape.md', foreground: '6D4566' },
      { token: 'variable.md', foreground: '3F5A6E' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#FFFDF9',
      'editor.foreground': '#1F1B16',
      'editorLineNumber.foreground': '#B5AC9F',
      'editorLineNumber.activeForeground': '#B8543A',
      'editor.lineHighlightBackground': '#F7E9E055',
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': '#F7E9E0',
      'editor.inactiveSelectionBackground': '#F2EDE4',
      'editor.selectionHighlightBackground': '#F7E9E055',
      'editorCursor.foreground': '#D97757',
      'editorWhitespace.foreground': '#E8E0D4',
      'editorIndentGuide.background': '#EFE8DC',
      'editorIndentGuide.activeBackground': '#D6CCBC',
      'editorBracketMatch.background': '#F7E9E0',
      'editorBracketMatch.border': '#D97757',
      'editorGutter.background': '#FFFDF9',
      'editorOverviewRuler.border': '#FFFDF9',
      'editorWidget.background': '#FAF7F2',
      'editorWidget.border': '#E8E0D4',
      'editorSuggestWidget.background': '#FFFDF9',
      'editorSuggestWidget.border': '#E8E0D4',
      'editorSuggestWidget.foreground': '#1F1B16',
      'editorSuggestWidget.selectedBackground': '#F7E9E0',
      'editorSuggestWidget.highlightForeground': '#B8543A',
      'editorHoverWidget.background': '#FFFDF9',
      'editorHoverWidget.border': '#E8E0D4',
      'scrollbarSlider.background': '#D6CCBC55',
      'scrollbarSlider.hoverBackground': '#D6CCBC99',
      'scrollbarSlider.activeBackground': '#B5AC9F',
      'editorError.foreground': '#B8543A',
      'editorWarning.foreground': '#D97757',
      'editorInfo.foreground': '#5C7A8C',
      'minimap.background': '#FFFDF9',
    },
  });
}

interface CodeEditorProps {
  value: string;
  onChange?: (next: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  height?: number | string;
  onMount?: OnMount;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '100%',
  onMount,
}: CodeEditorProps) {
  const handleChange: OnChange = (next) => {
    if (!onChange) return;
    onChange(next ?? '');
  };

  const beforeMount: BeforeMount = (monaco) => {
    defineCcTheme(monaco);
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--cc-line)', background: 'var(--cc-bg-raised)',
    }}>
      <Editor
        height={height}
        value={value}
        onChange={handleChange}
        beforeMount={beforeMount}
        onMount={onMount}
        language={language}
        theme={CC_THEME_NAME}
        options={{
          readOnly,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontLigatures: true,
          fontSize: 13,
          // 用整数像素行高，避免中文字符落在非整数像素上导致模糊
          lineHeight: 22,
          letterSpacing: 0,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          // 关闭 transform 类动画，避免 GPU 合成层在 CJK 文本上产生抗锯齿失真
          smoothScrolling: false,
          cursorBlinking: 'solid',
          cursorSmoothCaretAnimation: 'off',
          disableLayerHinting: true,
          disableMonospaceOptimizations: false,
          tabSize: 2,
          wordWrap: language === 'markdown' ? 'on' : 'off',
          automaticLayout: true,
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
          padding: { top: 14, bottom: 14 },
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          stickyScroll: { enabled: false },
        }}
      />
    </div>
  );
}
