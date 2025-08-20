Build and contribution instructions for this repo

Build tooling

- Use Yarn only. Do not use npm or tsc directly.
- Primary commands (see package.json scripts):
  - yarn build — builds the full extension (webview + extension bundles in development mode)
  - yarn build:webview — builds the Rust/wasm webview UI and generates pkg/\* including type declarations
  - yarn build:extension — builds the VS Code extension bundle
  - yarn build:prod — production build used for publishing
  - yarn watch — build in watch mode (good for local development)
  - yarn lint — run ESLint with the repo config
  - yarn clean — removes dist and src/webview-ui/pkg (generated)
  - yarn vscode:prepublish — clean + production build, executed before packaging

Prerequisite: generate webview types

- The file src/webview/webview.d.ts re-exports types from "../webview-ui/pkg/webview" which is generated.
- Before editing or building TypeScript that imports from src/webview/webview.d.ts, run: yarn build:webview.
- The generated artifacts in src/webview-ui/pkg are not committed (ignored by .gitignore); regenerate as needed.

Dev tips

- Use VS Code tasks if you prefer watch mode (see workspace tasks), but keep Yarn as the underlying runner.
- For fast iteration yarn build:webview once for types, then yarn watch for the everything in watch mode.
- Publishing: yarn package or yarn package:pre-release (vscode:prepublish runs automatically). Do not commit the generated .vsix.

Coding guidelines (repo-aligned)

- Language and modules:
  - TypeScript (strict) targeting ES2021, module: commonjs for the extension.
- Linting/formatting:
  - ESLint config: eslint.config.mjs (extends @eslint/js recommended + typescript-eslint + prettier/recommended).
  - Prettier config: .prettierrc (2 spaces, no tabs, semicolons on). Run yarn lint and fix issues.
  - No non-null assertions: ts/no-non-null-assertion is enforced.
  - No unused vars: unused variables must be prefixed with \_ if intentionally unused.
- Types and structure:
  - Prefer explicit return types for exported functions; avoid any.
  - Narrow types and use Result/Option-like patterns where present (ts-results is available).
  - Keep imports ordered and deduplicated; prefer import type for types in mixed modules when helpful.
  - Use dependency injection consistently (typedi). Ensure reflect-metadata is imported once at the extension entry.
- Logging and diagnostics:
  - Avoid stray console.log; gate logs behind the svifpd.debug setting and/or use a shared logger/output channel.
  - Remove debugging prints before committing.
- File hygiene:
  - Do not commit generated assets (dist/, src/webview-ui/pkg/, .vsix, out/). yarn clean can reset.
  - Keep changes scoped; avoid unrelated refactors in the same PR.

PR review checklist
Scoping and intent

- The PR has a clear purpose and minimal, focused changes. No unrelated file churn.
- User-facing changes update README/CHANGELOG and settings descriptions if needed.

Build and quality gates

- yarn build:webview succeeds (types and wasm pkg generated, no errors/warnings beyond known upstream ones).
- yarn build (or yarn build:extension) succeeds without errors.
- yarn lint passes; no disabled rules snuck in; Prettier formatting respected.

Dependencies and assets

- No unnecessary dependencies added. New deps are justified and pinned (respecting Yarn 4 PnP).
- No generated/binary/large files committed (dist/, src/webview-ui/pkg/, \*.vsix, logs).

Code health

- Follows repo ESLint rules: no non-null assertions; unused vars are prefixed with \_ when intentional.
- Proper typing; avoids any and unsafe casts; uses type guards or narrowing where appropriate.
- Clear, concise comments where needed; no commented-out dead code.
- Extension code avoids blocking the event loop; long-running work is offloaded or async.

Behavior and compatibility

- Preserves existing functionality and defaults (e.g., respects svifpd.\* settings).
- Edge cases considered: Windows/Unix paths, remote/WSL, missing tools, empty/large images, null tensors.
- Webview/extension messaging remains compatible; feature flags (e.g., useExperimental\*) respected.

Testing and verification

- Manual smoke test steps provided (open viewer, track image/tensor/plot, run on sample in python_test/).
- If UI or settings changed, verify both webview and extension states. Validate resource cleanup.

Publishing readiness

- Versioning/packaging impacts considered (if relevant). Do not commit built .vsix; use yarn package for local install.
- Resulted vsix file size should not exceed 5MB. This has

Common pitfalls and fixes

- TS cannot find "../webview-ui/pkg/webview": run yarn build:webview first.
- ESLint non-null assertion violations: refactor to proper runtime checks or optional chaining.
- Unused variables: prefix with \_ or remove.
