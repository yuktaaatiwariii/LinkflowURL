import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import {
  DocsColors,
  DocsRadius,
  DocsSpacing,
} from '../../constants/docsTheme';
import type { CodeLanguage } from '../../utils/syntaxHighlight';
import { CodeBlock } from './CodeBlock';

export interface CodeTab {
  label: string;
  code: string;
  language: CodeLanguage;
}

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = tabs[Math.min(active, tabs.length - 1)];

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Snippets remain selectable if clipboard access is denied.
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab, index) => {
            const selected = index === active;
            return (
              <TouchableOpacity
                key={tab.label}
                activeOpacity={0.78}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActive(index)}
                style={[styles.tab, selected && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
      <CodeBlock code={current.code} language={current.language} hideHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: DocsColors.codeBorder,
    borderRadius: DocsRadius.md,
    overflow: 'hidden',
    backgroundColor: DocsColors.codeBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DocsSpacing.sm,
    paddingHorizontal: DocsSpacing.sm,
    paddingVertical: 6,
    backgroundColor: DocsColors.codeHeader,
    borderBottomWidth: 1,
    borderBottomColor: DocsColors.codeBorder,
  },
  tabs: { gap: 4, alignItems: 'center', paddingRight: DocsSpacing.sm },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DocsRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: DocsColors.primaryBg,
    borderColor: DocsColors.primaryBorder,
  },
  tabLabel: { color: DocsColors.textMuted, fontSize: 11.5, fontWeight: '600' },
  tabLabelActive: { color: DocsColors.primarySoft },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyLabel: { color: DocsColors.textSecondary, fontSize: 11, fontWeight: '600' },
});
