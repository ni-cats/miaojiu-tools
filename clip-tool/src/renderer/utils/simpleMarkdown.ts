/**
 * 轻量 Markdown → HTML 转换工具
 * 不依赖第三方库，支持常见 Markdown 语法
 * 用于 AI 搜索结果等场景的简单渲染
 */

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 简单的代码语法高亮（One Dark Pro 配色）
 * 通过正则匹配常见 token 并包裹 span 标签
 */
function highlightCode(code: string, lang: string): string {
  // 先转义 HTML
  let escaped = escapeHtml(code)

  // 通用关键字列表（覆盖主流语言）
  const keywords = [
    'abstract', 'async', 'await', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
    'double', 'else', 'enum', 'export', 'extends', 'false', 'final', 'finally',
    'float', 'for', 'from', 'function', 'goto', 'if', 'implements', 'import',
    'in', 'instanceof', 'int', 'interface', 'let', 'long', 'native', 'new',
    'null', 'of', 'package', 'private', 'protected', 'public', 'return', 'short',
    'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void',
    'volatile', 'while', 'with', 'yield',
    // Python
    'def', 'elif', 'except', 'lambda', 'pass', 'raise', 'None', 'True', 'False',
    'and', 'or', 'not', 'is', 'as', 'nonlocal', 'global', 'assert', 'with',
    // Rust
    'fn', 'impl', 'mod', 'pub', 'use', 'crate', 'self', 'Self', 'struct',
    'trait', 'where', 'mut', 'ref', 'loop', 'match', 'move', 'unsafe',
    // Go
    'func', 'chan', 'defer', 'go', 'map', 'range', 'select', 'struct',
    'fallthrough',
    // Shell
    'then', 'fi', 'done', 'esac', 'echo', 'exit',
  ]

  // 内置类型
  const builtinTypes = [
    'string', 'number', 'object', 'any', 'never', 'unknown', 'symbol', 'bigint',
    'Array', 'Map', 'Set', 'Promise', 'Record', 'Partial', 'Required', 'Readonly',
    'String', 'Number', 'Boolean', 'Object', 'Function', 'RegExp', 'Date', 'Error',
    'console', 'window', 'document', 'Math', 'JSON', 'parseInt', 'parseFloat',
    'str', 'int', 'float', 'bool', 'list', 'dict', 'tuple', 'set',
    'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64',
    'usize', 'isize', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc',
  ]

  const keywordPattern = keywords.join('|')
  const typePattern = builtinTypes.join('|')

  // 用占位符替换，避免嵌套替换冲突
  // 处理顺序：注释 → 字符串 → 数字 → 关键字 → 类型 → 函数调用
  const tokens: { start: number; end: number; replacement: string }[] = []

  // 收集所有 token（基于转义后的文本）
  const collectTokens = (regex: RegExp, cls: string, group = 0) => {
    let m: RegExpExecArray | null
    while ((m = regex.exec(escaped)) !== null) {
      const text = group > 0 && m[group] !== undefined ? m[group] : m[0]
      const start = group > 0 ? m.index + m[0].indexOf(text) : m.index
      tokens.push({
        start,
        end: start + text.length,
        replacement: `<span class="hl-${cls}">${text}</span>`,
      })
    }
  }

  // 1. 单行注释 // 和 #（shell/python）
  collectTokens(/\/\/.*$/gm, 'comment')
  collectTokens(/(?:^|\s)(#[^!].*$)/gm, 'comment', 1)

  // 2. 多行注释 /* ... */
  collectTokens(/\/\*[\s\S]*?\*\//g, 'comment')

  // 3. 字符串（双引号、单引号、模板字符串）
  collectTokens(/&quot;(?:[^&]|&(?!quot;))*?&quot;/g, 'string')
  collectTokens(/'(?:[^'\\]|\\.)*?'/g, 'string')
  collectTokens(/`(?:[^`\\]|\\.)*?`/g, 'string')

  // 4. 数字
  collectTokens(/\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, 'number')

  // 5. 关键字（需要单词边界）
  collectTokens(new RegExp(`\\b(?:${keywordPattern})\\b`, 'g'), 'keyword')

  // 6. 内置类型
  collectTokens(new RegExp(`\\b(?:${typePattern})\\b`, 'g'), 'type')

  // 7. 函数调用 identifier(
  collectTokens(/\b([a-zA-Z_$][\w$]*)\s*(?=\()/g, 'function', 1)

  // 按 start 排序，去除重叠
  tokens.sort((a, b) => a.start - b.start)
  const filtered: typeof tokens = []
  let lastEnd = 0
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t)
      lastEnd = t.end
    }
  }

  // 从后往前替换，避免偏移
  let result = escaped
  for (let j = filtered.length - 1; j >= 0; j--) {
    const t = filtered[j]
    result = result.slice(0, t.start) + t.replacement + result.slice(t.end)
  }

  return result
}

/**
 * 解析行内 Markdown 格式（粗体、斜体、行内代码、链接、删除线）
 */
function parseInline(text: string): string {
  let result = escapeHtml(text)
  // 行内代码（优先处理，避免内部被其他规则干扰）
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  // 粗斜体
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  // 粗体
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // 斜体
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // 删除线
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>')
  // 链接
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return result
}

/**
 * 将 Markdown 文本转换为 HTML
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const htmlParts: string[] = []
  let i = 0
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''

  while (i < lines.length) {
    const line = lines[i]

    // 代码块处理
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.trimStart().slice(3).trim()
        codeBlockContent = []
        i++
        continue
      } else {
        // 结束代码块
        inCodeBlock = false
        const highlighted = highlightCode(codeBlockContent.join('\n'), codeBlockLang)
        const langLabel = codeBlockLang ? `<span class="code-lang-label">${escapeHtml(codeBlockLang)}</span>` : ''
        htmlParts.push(`<pre class="code-block-onedark">${langLabel}<code>${highlighted}</code></pre>`)
        i++
        continue
      }
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      i++
      continue
    }

    // 空行
    if (line.trim() === '') {
      i++
      continue
    }

    // 标题 h1-h6
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      htmlParts.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // 分割线
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      htmlParts.push('<hr />')
      i++
      continue
    }

    // 引用块
    if (line.trimStart().startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i].trimStart().startsWith('> ') || lines[i].trimStart().startsWith('>'))) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      htmlParts.push(`<blockquote>${quoteLines.map(l => `<p>${parseInline(l)}</p>`).join('')}</blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      htmlParts.push(`<ul>${listItems.map(item => `<li>${parseInline(item)}</li>`).join('')}</ul>`)
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      htmlParts.push(`<ol>${listItems.map(item => `<li>${parseInline(item)}</li>`).join('')}</ol>`)
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(c => c)
      i += 2 // 跳过表头和分隔行
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(c => c))
        i++
      }
      const thead = `<thead><tr>${headerCells.map(c => `<th>${parseInline(c)}</th>`).join('')}</tr></thead>`
      const tbody = rows.length > 0
        ? `<tbody>${rows.map(row => `<tr>${row.map(c => `<td>${parseInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
        : ''
      htmlParts.push(`<table>${thead}${tbody}</table>`)
      continue
    }

    // 普通段落（收集连续非空行）
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trimStart().startsWith('#') && !lines[i].trimStart().startsWith('```') && !lines[i].trimStart().startsWith('> ') && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^[-*_]{3,}\s*$/.test(lines[i].trim())) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      htmlParts.push(`<p>${paraLines.map(l => parseInline(l)).join('<br />')}</p>`)
    }
  }

  // 如果代码块未关闭，也输出
  if (inCodeBlock && codeBlockContent.length > 0) {
    const highlighted = highlightCode(codeBlockContent.join('\n'), codeBlockLang)
    const langLabel = codeBlockLang ? `<span class="code-lang-label">${escapeHtml(codeBlockLang)}</span>` : ''
    htmlParts.push(`<pre class="code-block-onedark">${langLabel}<code>${highlighted}</code></pre>`)
  }

  return htmlParts.join('\n')
}