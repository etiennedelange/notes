import { defineConfig, type Plugin } from "vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// @codemirror/legacy-modes builds keyword lookup tables with plain object
// literals, so a word like "constructor" (a real C#/Kotlin/Java keyword)
// becomes `obj.constructor = true`. Our tauri.conf.json sets
// `security.freezePrototype: true`, which freezes Object.prototype — that
// assignment then throws instead of silently shadowing it, breaking syntax
// highlighting for every clike-family language. Patch the object literal to
// use a null-prototype object instead, rather than weakening the app's
// prototype-freeze protection.
function patchLegacyModesFrozenPrototype(): Plugin {
  const objPattern = /var obj = \{\}, words = str\.split/g;
  // Object.create(null) has no inherited propertyIsEnumerable either, so the
  // membership check needs to borrow it explicitly once obj is null-prototype.
  const containsPattern = /words\.propertyIsEnumerable\(word\)/g;
  return {
    name: "patch-legacy-modes-frozen-prototype",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@codemirror/legacy-modes/mode/")) return null;
      if (!objPattern.test(code) && !containsPattern.test(code)) return null;
      objPattern.lastIndex = 0;
      containsPattern.lastIndex = 0;
      return code
        .replace(objPattern, "var obj = Object.create(null), words = str.split")
        .replace(containsPattern, "Object.prototype.propertyIsEnumerable.call(words, word)");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [patchLegacyModesFrozenPrototype()],

  // In dev, Vite pre-bundles dependencies into node_modules/.vite/deps
  // *before* running plugin transform hooks, so the patch above would never
  // reach @codemirror/legacy-modes there. Exclude it from pre-bundling so it
  // always flows through the normal (patched) transform pipeline.
  optimizeDeps: {
    exclude: ["@codemirror/legacy-modes"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
