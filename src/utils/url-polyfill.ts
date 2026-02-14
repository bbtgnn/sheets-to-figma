/**
 * Minimal URL + URLSearchParams polyfill for environments that don't provide
 * the global URL API (e.g. Figma plugin sandbox). Effect's Hash and our fetch
 * logic rely on URL being defined.
 */
if (typeof globalThis.URL === "undefined") {
  class URLSearchParamsPolyfill {
    private _entries: [string, string][] = [];

    constructor(init?: string | Record<string, string> | [string, string][]) {
      if (typeof init === "string") {
        const q = init.startsWith("?") ? init.slice(1) : init;
        q.split("&").forEach((pair) => {
          const [k, v] = pair.split("=").map(decodeURIComponent);
          if (k) this._entries.push([k, v ?? ""]);
        });
      } else if (init && typeof init === "object") {
        if (Array.isArray(init)) {
          this._entries = init.map(([k, v]) => [String(k), String(v)]);
        } else {
          Object.entries(init).forEach(([k, v]) =>
            this._entries.push([k, String(v)])
          );
        }
      }
    }

    get(name: string): string | null {
      const e = this._entries.find(([k]) => k === name);
      return e ? e[1] : null;
    }

    toString(): string {
      return this._entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    }
  }

  class URLPolyfill {
    href: string;
    searchParams: URLSearchParamsPolyfill;

    constructor(url: string, base?: string) {
      const resolved = base ? resolveUrl(base, url) : url;
      const [pathname, search] = splitSearch(resolved);
      this.href = resolved;
      this.searchParams = new URLSearchParamsPolyfill(search || "");
    }

    toString(): string {
      return this.href;
    }
  }

  function splitSearch(s: string): [string, string] {
    const i = s.indexOf("?");
    if (i === -1) return [s, ""];
    return [s.slice(0, i), s.slice(i + 1)];
  }

  function resolveUrl(base: string, url: string): string {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
    const [basePath, baseSearch] = splitSearch(base);
    const baseWithoutQuery = baseSearch ? basePath : base;
    const baseSlash = baseWithoutQuery.lastIndexOf("/") + 1;
    const baseDir =
      baseSlash > 0 ? baseWithoutQuery.slice(0, baseSlash) : baseWithoutQuery;
    if (url.startsWith("/")) {
      const originEnd = base.indexOf("/", 8);
      const origin = originEnd > 0 ? base.slice(0, originEnd) : base;
      return origin + url;
    }
    if (url.startsWith("?")) return basePath + url;
    if (!url) return base;
    const joined = baseDir + url;
    const parts = joined.split("/");
    const out: string[] = [];
    for (const p of parts) {
      if (p === "..") out.pop();
      else if (p !== ".") out.push(p);
    }
    return out.join("/").replace(/\/+/g, "/");
  }

  (globalThis as any).URL = URLPolyfill;
  (globalThis as any).URLSearchParams = URLSearchParamsPolyfill;
}
