// Audio Buffer Utilities
// Handles audio format conversions and buffering

// Audio format constants
export const MULAW_SAMPLE_RATE = 8000;
export const MULAW_CHANNELS = 1;
export const MULAW_BITS_PER_SAMPLE = 8;

// Chunk size for streaming (20ms of audio at 8kHz)
export const AUDIO_CHUNK_SIZE = 160; // 8000 * 0.02 = 160 samples

/**
 * Audio buffer that accumulates chunks and emits when ready
 */
export class AudioBuffer {
  private buffer: Buffer[] = [];
  private totalBytes = 0;
  private minChunkSize: number;

  constructor(minChunkSize: number = AUDIO_CHUNK_SIZE) {
    this.minChunkSize = minChunkSize;
  }

  /**
   * Add audio data to the buffer
   */
  add(data: Buffer): void {
    this.buffer.push(data);
    this.totalBytes += data.length;
  }

  /**
   * Check if we have enough data for a chunk
   */
  hasChunk(): boolean {
    return this.totalBytes >= this.minChunkSize;
  }

  /**
   * Get next chunk of audio data
   */
  getChunk(): Buffer | null {
    if (this.totalBytes < this.minChunkSize) {
      return null;
    }

    // Concatenate all buffered data
    const combined = Buffer.concat(this.buffer);
    this.buffer = [];
    this.totalBytes = 0;

    // If we have more than one chunk, save the remainder
    if (combined.length > this.minChunkSize) {
      const chunk = combined.subarray(0, this.minChunkSize);
      const remainder = combined.subarray(this.minChunkSize);
      this.buffer.push(remainder);
      this.totalBytes = remainder.length;
      return chunk;
    }

    return combined;
  }

  /**
   * Get all remaining data and clear buffer
   */
  flush(): Buffer | null {
    if (this.buffer.length === 0) {
      return null;
    }

    const combined = Buffer.concat(this.buffer);
    this.buffer = [];
    this.totalBytes = 0;
    return combined;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.totalBytes = 0;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.totalBytes;
  }
}

/**
 * Jitter buffer for smoothing out audio playback
 */
export class JitterBuffer {
  private queue: Buffer[] = [];
  private targetSize: number;
  private maxSize: number;

  constructor(targetSize: number = 3, maxSize: number = 10) {
    this.targetSize = targetSize;
    this.maxSize = maxSize;
  }

  /**
   * Add audio chunk to the buffer
   */
  add(chunk: Buffer): void {
    if (this.queue.length >= this.maxSize) {
      // Drop oldest chunk if buffer is full
      this.queue.shift();
      console.warn("[JITTER] Buffer overflow, dropping oldest chunk");
    }
    this.queue.push(chunk);
  }

  /**
   * Get next chunk if buffer is ready
   */
  get(): Buffer | null {
    // Wait until we have enough buffered
    if (this.queue.length < this.targetSize) {
      return null;
    }
    return this.queue.shift() || null;
  }

  /**
   * Get next chunk regardless of buffer level
   */
  getImmediate(): Buffer | null {
    return this.queue.shift() || null;
  }

  /**
   * Check if buffer is ready for playback
   */
  isReady(): boolean {
    return this.queue.length >= this.targetSize;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get current buffer level
   */
  level(): number {
    return this.queue.length;
  }
}

/**
 * Calculate duration of audio data in milliseconds
 */
export function audioDurationMs(
  bytes: number,
  sampleRate: number = MULAW_SAMPLE_RATE,
  bytesPerSample: number = 1,
): number {
  const samples = bytes / bytesPerSample;
  return (samples / sampleRate) * 1000;
}

/**
 * Calculate bytes needed for a duration of audio
 */
export function audioBytes(
  durationMs: number,
  sampleRate: number = MULAW_SAMPLE_RATE,
  bytesPerSample: number = 1,
): number {
  return Math.ceil((durationMs / 1000) * sampleRate * bytesPerSample);
}
