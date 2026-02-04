# Cartesia Sonic-3 Meta Tags Research

## Summary

Sonic-3 supports two types of markers for natural speech:

1. **SSML Tags** - XML-style tags for prosody control
2. **Text Markers** - Square bracket markers like `[laughter]`

---

## SSML Tags (Fully Supported)

### Break/Pause

Inserts silence into speech.

| Attribute | Format                           | Example                                         |
| --------- | -------------------------------- | ----------------------------------------------- |
| time      | seconds (s) or milliseconds (ms) | `<break time="300ms"/>` or `<break time="1s"/>` |

**Use cases:**

- Thinking pause before complex answer: `<break time="300ms"/>`
- Emphasis pause: `<break time="500ms"/>`
- Natural conversational rhythm

### Speed

Controls speech rate.

| Attribute | Range      | Default | Example                |
| --------- | ---------- | ------- | ---------------------- |
| ratio     | 0.6 to 1.5 | 1.0     | `<speed ratio="0.9"/>` |

**Use cases:**

- Slow down for important info: `<speed ratio="0.85"/>`
- Speed up for casual asides: `<speed ratio="1.2"/>`

**Known Issue:** Decimal values (e.g., `ratio="1.05"`) can break in some frameworks due to sentence tokenization treating the decimal point as a sentence boundary. Use whole numbers or test thoroughly.

### Volume

Controls speech loudness.

| Attribute | Range      | Default | Example                 |
| --------- | ---------- | ------- | ----------------------- |
| ratio     | 0.5 to 2.0 | 1.0     | `<volume ratio="0.7"/>` |

**Use cases:**

- Softer for sensitive topics
- Louder for emphasis

### Spell

Spells out text letter-by-letter.

| Syntax                | Example                  |
| --------------------- | ------------------------ |
| `<spell>text</spell>` | `<spell>ABC-123</spell>` |

**Use cases:**

- Confirmation codes
- License plates
- Acronyms that shouldn't be pronounced as words

### Emotion (Beta)

Controls emotional tone. **Highly experimental - may affect stability.**

| Attribute | Values                    | Example                      |
| --------- | ------------------------- | ---------------------------- |
| value     | angry, sad, excited, etc. | `<emotion value="excited"/>` |

**Warning:** "Emotion control is highly experimental, particularly when emotion shifts occur mid-generation" - Cartesia docs

---

## Text Markers

### Laughter

| Syntax       | Effect                 |
| ------------ | ---------------------- |
| `[laughter]` | Natural-sounding laugh |

**Use cases:**

- Light moments in conversation
- Responding to user jokes
- Warmth in greetings

**Guidance:** Use sparingly. Only when genuinely appropriate - user made a joke, lighthearted exchange, etc.

---

## API-Level Emotion Controls (Experimental)

Available through API parameters (not SSML), but requires older API version (2024-11-13) for stability.

### Emotion Names

| Name       | Effect                     |
| ---------- | -------------------------- |
| anger      | Adds frustration/intensity |
| positivity | Adds warmth/happiness      |
| surprise   | Adds wonder/astonishment   |
| sadness    | Adds sympathy/melancholy   |
| curiosity  | Adds inquisitiveness       |

### Intensity Levels

| Level   | Effect          |
| ------- | --------------- |
| lowest  | Subtle hint     |
| low     | Light addition  |
| (omit)  | Moderate        |
| high    | Strong presence |
| highest | Very pronounced |

### Syntax

Array of tags: `["positivity:high", "curiosity"]`

**Important:** Emotions are purely additive - `anger:low` adds a small amount of anger, it doesn't reduce anger.

---

## Best Practices for Natural Output

### Do

- Use `<break>` for thinking pauses before complex answers
- Use `[laughter]` only for genuinely light moments
- Vary `<speed>` based on content importance
- Let the LLM decide when markers are appropriate (context-aware)

### Don't

- Don't use emotion tags mid-sentence (unstable)
- Don't use decimal speed/volume values without testing
- Don't overuse `[laughter]` - sounds fake
- Don't use markers on every response - silence is natural

### Response Patterns

| Situation             | Recommended Markers                            |
| --------------------- | ---------------------------------------------- |
| Simple factual answer | None - just answer                             |
| Complex question      | `<break time="300ms"/>` before lookup          |
| Good news             | Can use `[laughter]` if genuinely lighthearted |
| Bad news              | `<speed ratio="0.9"/>` for empathy             |
| Confirmation          | None or `<speed ratio="0.95"/>` for clarity    |
| User joke             | `[laughter]` if appropriate, then respond      |

---

## Known Issues

1. **Decimal Tokenization Bug** - In some frameworks (Pipecat), decimal values in SSML attributes get split at the decimal point, breaking the tag. Use integers where possible.

2. **Emotion Stability** - Emotion tags, especially mid-generation, can cause unpredictable output. Use sparingly and test thoroughly.

3. **Voice-Dependent Effects** - Effects vary by voice. What sounds natural with one voice may sound off with another.

---

## Sources

- [Cartesia SSML Tags Documentation](https://docs.cartesia.ai/build-with-cartesia/sonic-3/ssml-tags)
- [Cartesia Sonic-3 Model Docs](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)
- [Control Speed and Emotion](https://docs.cartesia.ai/build-with-cartesia/capability-guides/control-speed-and-emotion)
- [Pipecat SSML Issue #2963](https://github.com/pipecat-ai/pipecat/issues/2963)
- [Cartesia Sonic Product Page](https://cartesia.ai/sonic)
