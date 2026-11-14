import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import {
  DocsColors,
  DocsMonoFont,
  DocsRadius,
  DocsSpacing,
} from '../../constants/docsTheme';
import { highlightCode, type CodeLanguage, type TokenTone } from '../../utils/syntaxHighlight';

const TONE_COLOR: Record<TokenTone, string> = {
  plain: DocsColors.codeText,
  key: DocsColors.tokenKey,
  string: DocsColors.tokenString,
  number: DocsColors.tokenNumber,
  keyword: DocsColors.tokenKeyword,
  comment: DocsColors.tokenComment,
  punctuation: DocsColors.tokenPunctuation,
  function: DocsColors.tokenFunction,
  url: DocsColors.tokenUrl,
  flag: DocsColors.tokenFlag,
};

const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  json: 'JSON',
  bash: 'Shell',
  javascript: 'JavaScript',
  python: 'Python',
  text: 'Text',
};

export interface CodeBlockProps {
  code: string;
  language?: CodeLanguage;
  label?: string;
  /** Hide the header row (used when a parent supplies its own chrome). */
  hideHeader?: boolean;
  /** Additional bottom caption, for example a security note. */
  caption?: string;
  style?: object;
}

export function CodeBlock({
  code,
  language = 'text',
  label,
  hideHeader = false,
  caption,
  style,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => highlightCode(code, language), [code, language]);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permissions can be denied; the snippet stays selectable.
    }
  };

  return (
    <View style={[styles.wrapper, style]}>
      {!hideHeader ? (
        <View style={styles.header}>
          <Text style={styles.language}>{label || LANGUAGE_LABEL[language]}</Text>
          <TouchableOpacity
            onPress={() => void copy()}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Copy code"
            style={styles.copyButton}
          >
            <Feather
              name={copied ? 'check' : 'copy'}
              size={12}
              color={copied ? DocsColors.success : DocsColors.textSecondary}
            />
            <Text style={[styles.copyLabel, copied && { color: DocsColors.success }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeScroll}
      >
        <Text style={styles.code} selectable>
          {tokens.map((token, index) => (
            <Text key={index} style={{ color: TONE_COLOR[token.tone] }}>
              {token.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: DocsColors.codeBackground,
    borderWidth: 1,
    borderColor: DocsColors.codeBorder,
    borderRadius: DocsRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DocsSpacing.md,
    paddingVertical: 8,
    backgroundColor: DocsColors.codeHeader,
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.codeBorder,
  },
  language: {
    color: DocsColors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyLabel: { color: DocsColors.textSecondary, fontSize: 11, fontWeight: '600' },
  codeScroll: { paddingHorizontal: DocsSpacing.md, paddingVertical: DocsSpacing.md },
  code: {
    color: DocsColors.codeText,
    fontFamily: DocsMonoFont,
    fontSize: 12.5,
    lineHeight: 20,
  },
  caption: {
    color: DocsColors.textMuted,
    fontSize: 10.5,
    lineHeight: 16,
    paddingHorizontal: DocsSpacing.md,
    paddingBottom: DocsSpacing.sm,
  },
});
