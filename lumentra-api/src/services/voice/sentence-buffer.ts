// Sentence Buffer
// Accumulates streaming LLM output and yields complete sentences for TTS

export interface SentenceBufferConfig {
  // Minimum chars before allowing sentence break
  minChunkSize: number;
  // Maximum chars before forcing a break
  maxChunkSize: number;
  // Whether to break on commas for long sentences
  breakOnComma: boolean;
}

const DEFAULT_CONFIG: SentenceBufferConfig = {
  minChunkSize: 8,   // Allow short sentences like "I see." or "Got it."
  maxChunkSize: 150,
  breakOnComma: true,
};

export class SentenceBuffer {
  private buffer: string = "";
  private config: SentenceBufferConfig;

  constructor(config?: Partial<SentenceBufferConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add text to the buffer and return any complete sentences
   */
  add(text: string): string[] {
    this.buffer += text;
    return this.extractSentences();
  }

  /**
   * Flush any remaining text in the buffer
   */
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining || null;
  }

  /**
   * Clear the buffer without returning content
   */
  clear(): void {
    this.buffer = "";
  }

  /**
   * Check if buffer has content
   */
  hasContent(): boolean {
    return this.buffer.trim().length > 0;
  }

  /**
   * Get current buffer content (for debugging)
   */
  peek(): string {
    return this.buffer;
  }

  private extractSentences(): string[] {
    const sentences: string[] = [];

    while (true) {
      const boundary = this.findSentenceBoundary();
      if (boundary < 0) break;

      const sentence = this.buffer.slice(0, boundary).trim();
      this.buffer = this.buffer.slice(boundary).trimStart();

      if (sentence) {
        sentences.push(sentence);
      }
    }

    return sentences;
  }

  private findSentenceBoundary(): number {
    const text = this.buffer;

    // Don't break if we have less than minimum
    if (text.length < this.config.minChunkSize) {
      return -1;
    }

    // Look for sentence-ending punctuation followed by space or end
    // Patterns: ". " or "! " or "? " or end of meaningful content
    const sentenceEndPatterns = [
      /[.!?]\s+/g,  // Period/exclamation/question followed by space
      /[.!?]$/g,    // End of buffer with punctuation
    ];

    for (const pattern of sentenceEndPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match.index !== undefined) {
          const endIndex = match.index + match[0].length;
          // Only accept if we have enough content
          if (endIndex >= this.config.minChunkSize) {
            return endIndex;
          }
        }
      }
    }

    // If buffer is getting too long, force break at a natural point
    if (text.length > this.config.maxChunkSize) {
      // Try to break at comma
      if (this.config.breakOnComma) {
        const commaMatch = text.match(/,\s+/g);
        if (commaMatch) {
          // Find the last comma that gives us at least minChunkSize
          let lastGoodComma = -1;
          let searchIndex = 0;

          while (true) {
            const commaIndex = text.indexOf(", ", searchIndex);
            if (commaIndex < 0) break;

            const endIndex = commaIndex + 2;
            if (endIndex >= this.config.minChunkSize && endIndex < text.length) {
              lastGoodComma = endIndex;
            }
            searchIndex = commaIndex + 1;
          }

          if (lastGoodComma > 0) {
            return lastGoodComma;
          }
        }
      }

      // Last resort: break at last space before maxChunkSize
      const lastSpace = text.lastIndexOf(" ", this.config.maxChunkSize);
      if (lastSpace > this.config.minChunkSize) {
        return lastSpace + 1;
      }

      // Absolute last resort: force break at maxChunkSize
      return this.config.maxChunkSize;
    }

    return -1;
  }
}

/**
 * Create a sentence buffer with optional config
 */
export function createSentenceBuffer(
  config?: Partial<SentenceBufferConfig>,
): SentenceBuffer {
  return new SentenceBuffer(config);
}

/**
 * Simple utility to find first sentence boundary in text
 * Returns index after the sentence end, or -1 if no boundary found
 */
export function findSentenceBoundary(
  text: string,
  minLength: number = 20,
): number {
  if (text.length < minLength) return -1;

  // Look for sentence endings
  const match = text.match(/[.!?](\s+|$)/);
  if (match && match.index !== undefined) {
    const endIndex = match.index + match[0].length;
    if (endIndex >= minLength) {
      return endIndex;
    }
  }

  return -1;
}
