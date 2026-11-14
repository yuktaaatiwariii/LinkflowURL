/**
 * Tiny, dependency-free syntax highlighter for documentation snippets.
 *
 * It tokenizes a small set of languages used on the portal (JSON, shell,
 * JavaScript, Python). Unknown languages fall back to plain text. The output
 * is plain data so it renders identically on native and web.
 */

export type CodeLanguage = 'json' | 'bash' | 'javascript' | 'python' | 'text';

export type TokenTone =
  | 'plain'
  | 'key'
  | 'string'
  | 'number'
  | 'keyword'
  | 'comment'
  | 'punctuation'
  | 'function'
  | 'url'
  | 'flag';

export interface CodeToken {
  text: string;
  tone: TokenTone;
}

interface Rule {
  tone: TokenTone;
  pattern: RegExp;
}

const JSON_RULES: Rule[] = [
  { tone: 'key', pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
  { tone: 'string', pattern: /"(?:\\.|[^"\\])*"/y },
  { tone: 'number', pattern: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
  { tone: 'keyword', pattern: /\b(?:true|false|null)\b/y },
  { tone: 'punctuation', pattern: /[{}[\],:]/y },
];

const BASH_RULES: Rule[] = [
  { tone: 'comment', pattern: /#[^\n]*/y },
  { tone: 'string', pattern: /'[^']*'|"(?:\\.|[^"\\])*"/y },
  { tone: 'url', pattern: /https?:\/\/[^\s"'\\]+/y },
  { tone: 'flag', pattern: /--?[A-Za-z][\w-]*/y },
  { tone: 'function', pattern: /\b(?:curl|node|npm|npx|python3?|export|source|echo)\b/y },
  { tone: 'key', pattern: /\$[A-Za-z_][A-Za-z0-9_]*/y },
  { tone: 'punctuation', pattern: /\\\n?/y },
];

const JAVASCRIPT_RULES: Rule[] = [
  { tone: 'comment', pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
  { tone: 'string', pattern: /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/y },
  {
    tone: 'keyword',
    pattern:
      /\b(?:const|let|var|await|async|function|return|if|else|try|catch|throw|new|for|of|in|import|from|export|process|console)\b/y,
  },
  {
    tone: 'number',
    pattern: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y,
  },
  { tone: 'punctuation', pattern: /[{}[\]().,;:=+\-*/<>!?&|]/y },
];

const PYTHON_RULES: Rule[] = [
  { tone: 'comment', pattern: /#[^\n]*/y },
  {
    tone: 'string',
    pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/y,
  },
  {
    tone: 'keyword',
    pattern:
      /\b(?:import|from|def|return|if|elif|else|for|in|try|except|raise|with|as|None|True|False|not|and|or)\b/y,
  },
  { tone: 'number', pattern: /-?\b\d+(?:\.\d+)?\b/y },
  { tone: 'function', pattern: /\b(?:print|len|str|int|dict|list)\b/y },
  { tone: 'punctuation', pattern: /[{}[\]().,;:=+\-*/<>!?&|]/y },
];

const RULES: Record<CodeLanguage, Rule[]> = {
  json: JSON_RULES,
  bash: BASH_RULES,
  javascript: JAVASCRIPT_RULES,
  python: PYTHON_RULES,
  text: [],
};

export function highlightCode(code: string, language: CodeLanguage): CodeToken[] {
  const rules = RULES[language] || [];
  if (rules.length === 0) return [{ text: code, tone: 'plain' }];

  const tokens: CodeToken[] = [];
  let plainStart = 0;
  let index = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) {
      tokens.push({ text: code.slice(plainStart, end), tone: 'plain' });
    }
  };

  while (index < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(code);
      if (match && match.index === index && match[0].length > 0) {
        flushPlain(index);
        tokens.push({ text: match[0], tone: rule.tone });
        index += match[0].length;
        plainStart = index;
        matched = true;
        break;
      }
    }
    if (!matched) index += 1;
  }

  flushPlain(code.length);
  return tokens;
}
