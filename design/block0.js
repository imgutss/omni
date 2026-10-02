
/* Preview/sandbox-safe storage: in embedded or sandboxed contexts (and in
   Safari private mode) touching localStorage throws. Fall back to memory so
   the panel still boots instead of dying on the first theme read. */
try { window.localStorage.getItem("kaveh.probe"); } catch (_) {
  const mem = new Map();
  const shim = {
    getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),
    setItem: (k, v) => mem.set(String(k), String(v)),
    removeItem: (k) => mem.delete(String(k)),
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => shim });
}
