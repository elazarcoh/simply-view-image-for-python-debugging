# Simply View Image for Python Debugging — Copilot Instructions

## Architecture

This is a VS Code extension with two main components:

1. **TypeScript extension** (`src/`) — hooks into VS Code's Debug Adapter Protocol (DAP) and Jupyter kernel API to evaluate Python expressions during debugging. It injects Python helper code into the debugged process (via `exec` over DAP evaluate), serializes objects to disk or transfers them via a local socket, then opens a webview to display them.

2. **Rust/wasm webview UI** (`src/webview-ui/`) — a wasm-compiled Rust app (using `yew`) that renders the image/tensor/plot viewer panel inside VS Code's webview. It is built with webpack via `wasm-pack` and outputs generated TypeScript bindings to `src/webview-ui/pkg/` (not committed).

### Key subsystems

- **`src/viewable/`** — Defines the `Viewable<T>` interface. Each supported type (NumpyImage, PillowImage, NumpyTensor, TorchTensor, PlotlyFigure, PyplotFigure, PyplotAxes) is a plain object implementing this interface. Each `Viewable` provides Python snippets for: setup, type-test, info retrieval, and serialization. Python source is embedded at build time with `?raw` imports (e.g., `import NUMPY_CODE from '../python/image_numpy.py?raw'`).

- **`src/python-communication/`** — Injects a synthetic Python module (`_python_view_image_mod`) into the debugged process; all helpers live inside it. Also runs a local socket server (`socket-based/Server.ts`) as an alternative fast transfer path.

- **`src/session/`** — Abstracts over two session types: `DebugSession` (DAP/debugpy, via `DebugAdapterTracker`) and `JupyterSession` (via the `@vscode/jupyter-extension` API). All data-retrieval logic operates on the `Session` union type.

- **`src/image-watch-tree/`** — The Image Watch sidebar tree view: tracks watched expressions and variables across debug steps.

- **`src/webview/communication/`** — Typed message passing between the extension and the webview panel (`ExtensionRequest` / `ExtensionResponse` / `ImageMessage` types defined in the generated webview types).

- **Plugin API** — Third-party extensions can register additional `PluginViewable` objects via `registerPlugin()` exported from `src/api.ts`. Users must consent before a plugin is activated.

- **Dependency injection** — `typedi` with `@Service()` decorators throughout. `reflect-metadata` must be imported exactly once, at the top of `src/extension.ts`.

## Build tooling

Use **Yarn only**. Do not use npm or tsc directly.

| Command | Description |
|---|---|
| `yarn build` | Full extension build (development mode) |
| `yarn build:webview` | Build Rust/wasm webview UI; generates `src/webview-ui/pkg/` |
| `yarn build:extension` | Build VS Code extension bundle only |
| `yarn build:prod` | Production build (used for publishing) |
| `yarn watch` | Watch mode for fast iteration |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Run ESLint with auto-fix |
| `yarn clean` | Remove `dist/` and `src/webview-ui/pkg/` |
| `yarn package` | Package as `.vsix` (runs `vscode:prepublish` automatically) |

### Webview types prerequisite

`src/webview/webview.d.ts` re-exports types from `../webview-ui/pkg/webview` which is generated. Before editing TypeScript that imports from `webview.d.ts`, run `yarn build:webview`. These generated artifacts are gitignored.

## Testing

### Quick (no browser)
```bash
yarn test:validate
```

### Single UI test file
```bash
yarn test:compile && extest run-tests './out/tests/ui-test/mvp.test.js'
```
Replace `mvp.test.js` with any file from `out/tests/ui-test/`. Available suites: `extension`, `mvp`, `python-debug-expressions`, `pil-image`, `matplotlib-plot`, `tracking`, `display-options`.

### Full UI tests (headless/CI)
```bash
yarn ui-test:offscreen
# or with explicit resolution:
xvfb-run -a --server-args="-screen 0 1920x1080x24" yarn extest run-tests './out/tests/ui-test/*.test.js'
```

### Test prerequisites
- `xvfb` for headless: `sudo apt install xvfb`
- Python deps: `pip install -r tests/test-data/workspace/requirements.txt`
- Webview types: `yarn build:webview`

### CI environment variables
- `CI=true` — higher timeouts (60 s) and 2 retries per test
- `MOCHA_JUNIT=true` — JUnit XML output

## Coding guidelines

- **TypeScript strict**, ES2021, module: commonjs for the extension bundle.
- **No non-null assertions** (`!`) — use optional chaining or explicit runtime checks.
- **No unused variables** — prefix with `_` if intentionally unused.
- **Prefer explicit return types** on exported functions; avoid `any`.
- **Use `ts-results`** (`Ok`/`Err`/`Option`) for fallible operations; use `Result` / `Option` from `src/utils/`.
- **`typedi` DI** — decorate injectable classes with `@Service()`. Register singletons with `Container.set()` in `extension.ts`.
- **Logging** — use `logDebug`/`logInfo`/`logWarn`/`logError` from `src/Logging.ts`; never `console.log` in committed code.
- **Settings** — all configuration keys are prefixed `svifpd.*`. Read via `getConfiguration()` from `src/config.ts`.
- **Python code** — embed `.py` files with `?raw` imports; never inline multi-line Python strings in TypeScript.

## Adding a new viewable type

1. Add a `.py` file in `src/python/` with `is_<type>`, `<type>_info`, and `<type>_save` functions.
2. Create a `Viewable<YourInfo>` object in `src/viewable/` (see `Image.ts` as a reference).
3. Register it in `src/extension.ts` via `allViewables.addViewable(YourViewable)`.

## PR review checklist

**Build and quality gates**
- `yarn build:webview` succeeds.
- `yarn build` (or `yarn build:extension`) succeeds without errors.
- `yarn lint` passes; Prettier formatting respected.

**Dependencies and assets**
- No generated/binary files committed (`dist/`, `src/webview-ui/pkg/`, `*.vsix`, logs).
- New deps are justified and pinned (Yarn 4 PnP).

**Behavior and compatibility**
- Preserves existing defaults; respects `svifpd.*` settings.
- Edge cases handled: Windows/Unix paths, remote/WSL, empty/large images, null tensors.
- Webview/extension message types remain compatible.

**Publishing**
- `.vsix` must not exceed 5 MB. Use `yarn package` for local install; do not commit the built `.vsix`.

## Common pitfalls

- `TS cannot find "../webview-ui/pkg/webview"` → run `yarn build:webview` first.
- ESLint non-null assertion violations → refactor to optional chaining or type guards.
- Unused variables → prefix with `_` or remove.
- ExTester warnings about Node.js version → the extension targets Node.js 22.x; ignore ExTester's Node 20 recommendations.
