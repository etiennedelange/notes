import { describe, it, expect } from "vitest";
import { looksLikeCode, guessLanguage, fenceCodeBlock } from "./pasteCode";

describe("looksLikeCode", () => {
  it("detects a javascript function", () => {
    const text = "function add(a, b) {\n  return a + b;\n}";
    expect(looksLikeCode(text)).toBe(true);
  });

  it("detects an indented python function", () => {
    const text = "def add(a, b):\n    return a + b";
    expect(looksLikeCode(text)).toBe(true);
  });

  it("rejects plain prose", () => {
    const text = "This is just a couple of\nlines of regular prose text.";
    expect(looksLikeCode(text)).toBe(false);
  });

  it("rejects a single line", () => {
    expect(looksLikeCode("const x = 1;")).toBe(false);
  });

  it("rejects text already fenced", () => {
    const text = "```js\nconst x = 1;\n```";
    expect(looksLikeCode(text)).toBe(false);
  });

  it("rejects an empty or whitespace-only paste", () => {
    expect(looksLikeCode("\n\n\n")).toBe(false);
  });
});

describe("guessLanguage", () => {
  it("guesses typescript for typed interfaces", () => {
    expect(guessLanguage("interface Foo {\n  bar: string;\n}")).toBe("ts");
  });

  it("guesses python for def/print", () => {
    expect(guessLanguage("def add(a, b):\n    print(a + b)")).toBe("python");
  });

  it("guesses csharp over js for var/new despite shared C-style syntax", () => {
    const text = [
      "public LytxSurfsightClient(",
      "    ILytxSurfsightClientOptions options,",
      "    HttpClient? httpClient = null,",
      "    Func<RetryStrategy> retryFactory = null)",
      "{",
      "    Guard.IsNotNull(options);",
      "    retryFactory ??= DoublingWaitRetryStrategy.DefaultStrategy;",
      "    if (httpClient == null)",
      "    {",
      "        _httpClient = new HttpClient",
      "        {",
      "            BaseAddress = new Uri(options.ApiUrl.TrimEnd('/') + \"/\"),",
      "        };",
      "    }",
      "    var authenticationService = new AuthenticationService(options, _httpClient);",
      "}",
    ].join("\n");
    expect(guessLanguage(text)).toBe("csharp");
  });

  it("returns empty string when nothing matches", () => {
    expect(guessLanguage("plain text with no code markers")).toBe("");
  });
});

describe("fenceCodeBlock", () => {
  it("wraps text in a fenced block with guessed language", () => {
    const text = "function add(a, b) {\n  return a + b;\n}\n";
    expect(fenceCodeBlock(text)).toBe(
      "```js\nfunction add(a, b) {\n  return a + b;\n}\n```",
    );
  });

  it("normalizes CRLF line endings", () => {
    const text = "const x = 1;\r\nconst y = 2;";
    expect(fenceCodeBlock(text)).toBe("```js\nconst x = 1;\nconst y = 2;\n```");
  });
});
