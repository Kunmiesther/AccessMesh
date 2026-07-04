function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sanitizeUrl(raw: string, { allowDataImage = false } = {}) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (allowDataImage && /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function formatInlineMarkdown(value: string) {
  const codeTokens: string[] = [];
  let formatted = escapeHtml(value);

  formatted = formatted.replace(/`([^`\n]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  formatted = formatted.replace(
    /!\[([^\]]*)\]\(([^)\n]+)\)/g,
    (_match, altText, rawUrl) => {
      const url = sanitizeUrl(rawUrl, { allowDataImage: true });
      if (!url) {
        return _match;
      }

      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(altText)}" />`;
    },
  );

  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)\n]+)\)/g,
    (_match, label, rawUrl) => {
      const url = sanitizeUrl(rawUrl);
      if (!url) {
        return label;
      }

      return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${label}</a>`;
    },
  );

  formatted = formatted
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  return codeTokens.reduce(
    (output, html, index) => output.replaceAll(`@@CODE_${index}@@`, html),
    formatted,
  );
}

export function looksLikeMarkdownContent(content: string) {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```)/m.test(content) ||
    /!\[[^\]]*\]\(([^)\n]+)\)/.test(content) ||
    /\[[^\]\n]+\]\(([^)\n]+)\)/.test(content) ||
    /\*\*[^*\n]+\*\*/.test(content) ||
    /(^|[^\w*])\*[^*\n]+\*(?!\*)/.test(content) ||
    /`[^`\n]+`/.test(content)
  );
}

export function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeOpen = false;
  let codeLines: string[] = [];
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${paragraph.map(formatInlineMarkdown).join(" ")}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushCode = () => {
    if (codeOpen) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeOpen = false;
      codeLines = [];
    }
  };

  const flushQuote = () => {
    if (quoteLines.length > 0) {
      html.push(
        `<blockquote><p>${quoteLines.map(formatInlineMarkdown).join("<br />")}</p></blockquote>`,
      );
      quoteLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushQuote();
      if (codeOpen) {
        flushCode();
      } else {
        codeOpen = true;
      }
      continue;
    }

    if (codeOpen) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    flushQuote();

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();
  flushCode();

  return html.join("");
}
