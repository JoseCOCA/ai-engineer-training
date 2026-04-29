/**
 * Cuatro chunkers ilustrativos para S07.1.
 *
 * - fixedSizeChunker: corta cada N caracteres con overlap.
 * - sentenceAwareChunker: corta solo en límites de oración.
 * - markdownStructuralChunker: chunks por sección H1/H2/H3.
 *
 * El recursive lo usamos directo desde @langchain/textsplitters
 * en los demos — es lo que vas a usar en producción real.
 */

export interface Chunk {
  text: string;
  metadata: {
    chunkId: string;
    position: number;
    startChar: number;
    endChar: number;
    headings?: string[];
  };
}

export interface FixedSizeOptions {
  chunkSize: number;
  overlap: number;
  source?: string;
}

export function fixedSizeChunker(text: string, opts: FixedSizeOptions): Chunk[] {
  const { chunkSize, overlap } = opts;
  const source = opts.source ?? "doc";
  const chunks: Chunk[] = [];
  let pos = 0;
  let i = 0;

  while (pos < text.length) {
    const end = Math.min(pos + chunkSize, text.length);
    chunks.push({
      text: text.slice(pos, end),
      metadata: {
        chunkId: `${source}:c${i}`,
        position: i,
        startChar: pos,
        endChar: end,
      },
    });
    if (end === text.length) break;
    pos = end - overlap;
    i += 1;
  }
  return chunks;
}

export interface SentenceAwareOptions {
  maxChars: number;
  overlapSentences: number;
  source?: string;
}

export function sentenceAwareChunker(
  text: string,
  opts: SentenceAwareOptions,
): Chunk[] {
  const source = opts.source ?? "doc";
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;
  let position = 0;
  let startChar = 0;
  let cursor = 0;

  for (const sentence of sentences) {
    if (bufferLen + sentence.length + 1 > opts.maxChars && buffer.length > 0) {
      const text = buffer.join(" ");
      chunks.push({
        text,
        metadata: {
          chunkId: `${source}:c${position}`,
          position,
          startChar,
          endChar: cursor,
        },
      });
      position += 1;

      const overlap = buffer.slice(-opts.overlapSentences);
      const overlapText = overlap.join(" ");
      buffer = [...overlap];
      bufferLen = overlapText.length;
      startChar = cursor - overlapText.length;
    }
    buffer.push(sentence);
    bufferLen += sentence.length + 1;
    cursor += sentence.length + 1;
  }

  if (buffer.length > 0) {
    chunks.push({
      text: buffer.join(" "),
      metadata: {
        chunkId: `${source}:c${position}`,
        position,
        startChar,
        endChar: cursor,
      },
    });
  }

  return chunks;
}

export interface MarkdownStructuralOptions {
  source?: string;
  fallbackChunkSize?: number;
}

/**
 * Chunker structural para Markdown. Recorre headings (H1/H2/H3)
 * y devuelve un chunk por sección con metadata.headings = path.
 *
 * Si una sección excede fallbackChunkSize, la sigue partiendo
 * con fixed-size manteniendo el heading path.
 */
export function markdownStructuralChunker(
  text: string,
  opts: MarkdownStructuralOptions = {},
): Chunk[] {
  const source = opts.source ?? "doc";
  const fallbackSize = opts.fallbackChunkSize ?? 2000;
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  const headingStack: string[] = [];

  let buffer: string[] = [];
  let position = 0;
  let currentHeadings: string[] = [];

  function flush(): void {
    const content = buffer.join("\n").trim();
    if (!content) return;

    if (content.length <= fallbackSize) {
      chunks.push({
        text: content,
        metadata: {
          chunkId: `${source}:c${position}`,
          position,
          startChar: 0,
          endChar: content.length,
          headings: [...currentHeadings],
        },
      });
      position += 1;
    } else {
      const sub = fixedSizeChunker(content, {
        chunkSize: fallbackSize,
        overlap: Math.round(fallbackSize * 0.1),
        source: `${source}:s${position}`,
      });
      for (const c of sub) {
        chunks.push({
          ...c,
          metadata: {
            ...c.metadata,
            chunkId: `${source}:c${position}`,
            position,
            headings: [...currentHeadings],
          },
        });
        position += 1;
      }
    }
    buffer = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      headingStack.length = level - 1;
      headingStack[level - 1] = title;
      currentHeadings = headingStack.slice(0, level);
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }

  flush();
  return chunks;
}
