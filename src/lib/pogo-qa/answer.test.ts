import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat/types';

// One shared mock for the SDK's create() so each test can script a response
// sequence. Declared with `vi.hoisted` because vi.mock is hoisted above imports.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

// Minimal stand-ins for the SDK error classes. The real ones are constructed
// with an HTTP response object; we only need `instanceof` to work.
class MockAPIError extends Error {
  status: number;
  constructor(status = 500, message = 'boom') {
    super(message);
    this.status = status;
  }
}
class MockRateLimitError extends MockAPIError {}
class MockAuthenticationError extends MockAPIError {}
class MockBadRequestError extends MockAPIError {}
class MockAPIConnectionError extends MockAPIError {}

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    beta = { messages: { create: createMock } };
    static APIError = MockAPIError;
    static RateLimitError = MockRateLimitError;
    static AuthenticationError = MockAuthenticationError;
    static BadRequestError = MockBadRequestError;
    static APIConnectionError = MockAPIConnectionError;
  }
  return { default: MockAnthropic };
});

// Keep the tools offline — the feed is a third-party HTTP call.
vi.mock('./tools', () => ({
  QA_TOOLS: [{ name: 'get_current_raid_bosses' }, { name: 'get_upcoming_events' }],
  runTool: vi.fn(async (name: string) => `stub result for ${name}`),
}));

const { answerQuestion, SYSTEM_PROMPT } = await import('./answer');
const { runTool } = await import('./tools');

/** A finished (non-tool) response. */
function textResponse(text: string, usage: Record<string, unknown> = {}) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50, ...usage },
  };
}

/** A response asking for one tool call. */
function toolResponse(name: string) {
  return {
    stop_reason: 'tool_use',
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'tool_use', id: 'toolu_1', name, input: {} },
    ],
    usage: { input_tokens: 80, output_tokens: 20 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

describe('SYSTEM_PROMPT', () => {
  it('contains no interpolation', () => {
    // A timestamp or member name here would break prompt caching on every
    // request AND put personal data in a request to a US processor.
    expect(SYSTEM_PROMPT).not.toContain('${');
  });

  it('instructs plain text and Danish', () => {
    expect(SYSTEM_PROMPT).toMatch(/[Pp]lain text only/);
    expect(SYSTEM_PROMPT).toMatch(/Danish/);
  });

  it('tells the model to treat the question as data, not instructions', () => {
    expect(SYSTEM_PROMPT).toMatch(/data, not instructions/);
  });
});

describe('answerQuestion', () => {
  it('returns the model text and usage', async () => {
    createMock.mockResolvedValueOnce(textResponse('Mega Gengar er svag mod Ghost.'));

    const result = await answerQuestion('counter til Mega Gengar?');

    expect(result).toEqual({
      ok: true,
      text: 'Mega Gengar er svag mod Ghost.',
      usage: { inputTokens: 100, outputTokens: 50, webSearches: 0 },
    });
  });

  it('sends only the question — no history, no member data', async () => {
    createMock.mockResolvedValueOnce(textResponse('svar'));

    await answerQuestion('hvad er en lure?');

    const request = createMock.mock.calls[0][0];
    expect(request.messages).toEqual([{ role: 'user', content: 'hvad er en lure?' }]);
    expect(request.system).toBe(SYSTEM_PROMPT);
    expect(request.model).toBe('claude-opus-5');
    expect(request.output_config).toEqual({ effort: 'low' });
  });

  it('locks web search to the approved domains', async () => {
    createMock.mockResolvedValueOnce(textResponse('svar'));

    await answerQuestion('hvad er nyt?');

    const search = createMock.mock.calls[0][0].tools.find(
      (tool: { type?: string }) => tool.type === 'web_search_20260209'
    );
    expect(search.allowed_domains).toContain('leekduck.com');
    expect(search.max_uses).toBe(2);
    // A second execution environment confuses the model — the _20260209 variant
    // runs code execution internally.
    expect(
      createMock.mock.calls[0][0].tools.some((tool: { type?: string }) =>
        tool.type?.startsWith('code_execution')
      )
    ).toBe(false);
  });

  it('counts web searches from server_tool_use', async () => {
    createMock.mockResolvedValueOnce(
      textResponse('svar', { server_tool_use: { web_search_requests: 2 } })
    );

    const result = await answerQuestion('hvad er nyt?');

    expect(result).toMatchObject({ ok: true, usage: { webSearches: 2 } });
  });

  it('runs a tool, feeds the result back, and stops', async () => {
    createMock
      .mockResolvedValueOnce(toolResponse('get_current_raid_bosses'))
      .mockResolvedValueOnce(textResponse('Raid-bossen er Ho-Oh.'));

    const result = await answerQuestion('hvad er raid-bossen nu?');

    expect(result).toMatchObject({ ok: true, text: 'Raid-bossen er Ho-Oh.' });
    expect(runTool).toHaveBeenCalledWith('get_current_raid_bosses');
    expect(createMock).toHaveBeenCalledTimes(2);

    // Second call must carry the assistant turn verbatim, then all tool results
    // in ONE user message.
    const second = createMock.mock.calls[1][0];
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1].role).toBe('assistant');
    expect(second.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: 'stub result for get_current_raid_bosses',
        },
      ],
    });
  });

  it('accumulates usage across tool iterations', async () => {
    createMock
      .mockResolvedValueOnce(toolResponse('get_upcoming_events'))
      .mockResolvedValueOnce(textResponse('Raid hour er på onsdag.'));

    const result = await answerQuestion('hvornår er raid hour?');

    // 80 + 100 in, 20 + 50 out — each iteration is a separately billed request.
    expect(result).toMatchObject({
      ok: true,
      usage: { inputTokens: 180, outputTokens: 70 },
    });
  });

  it('gives up after the tool-iteration cap', async () => {
    createMock.mockResolvedValue(toolResponse('get_current_raid_bosses'));

    const result = await answerQuestion('hvad er raid-bossen?');

    expect(result).toEqual({ ok: false, reason: 'tool_loop_exhausted' });
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it('truncates an over-long answer to the chat limit', async () => {
    const long = Array.from({ length: 400 }, (_, i) => `linje ${i}`).join('\n');
    createMock.mockResolvedValueOnce(textResponse(long));

    const result = await answerQuestion('fortæl alt');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeLessThanOrEqual(CHAT_MESSAGE_MAX_LENGTH);
      expect(result.text.endsWith('\n…')).toBe(true);
    }
  });

  it('reports a refusal rather than posting nothing', async () => {
    createMock.mockResolvedValueOnce({
      stop_reason: 'refusal',
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    expect(await answerQuestion('noget upassende')).toEqual({
      ok: false,
      reason: 'refusal',
    });
  });

  it('reports an empty answer', async () => {
    createMock.mockResolvedValueOnce(textResponse('   '));

    expect(await answerQuestion('hmm')).toEqual({ ok: false, reason: 'empty_answer' });
  });

  it('maps SDK errors to slugs without throwing', async () => {
    const cases: [Error, string][] = [
      [new MockRateLimitError(429), 'api_rate_limited'],
      [new MockAuthenticationError(401), 'api_unauthorized'],
      [new MockBadRequestError(400), 'api_bad_request'],
      [new MockAPIConnectionError(), 'api_unreachable'],
      [new MockAPIError(503), 'api_error_503'],
      [new Error('something else'), 'unexpected'],
    ];

    for (const [error, reason] of cases) {
      createMock.mockRejectedValueOnce(error);
      expect(await answerQuestion('spørgsmål')).toEqual({ ok: false, reason });
    }
  });
});
