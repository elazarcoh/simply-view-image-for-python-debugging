# Testing

## Overview

The extension uses [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester) (ExTester) for end-to-end UI tests. Tests launch a real VS Code instance, open Python debug sessions, and verify the extension's image/plot viewing features.

## Test Suites

| File                               | Description                                                           |
| ---------------------------------- | --------------------------------------------------------------------- |
| `extension.test.ts`                | Verifies extension is installed with correct metadata                 |
| `mvp.test.ts`                      | Core workflow: debug Python → view numpy image → verify webview opens |
| `python-debug-expressions.test.ts` | Add/view custom watch expressions in Image Watch                      |
| `pil-image.test.ts`                | View PIL/Pillow images during debugging                               |
| `matplotlib-plot.test.ts`          | View matplotlib figures via "View Plot" action                        |
| `tracking.test.ts`                 | Variable tracking across breakpoints (continue → re-verify)           |
| `display-options.test.ts`          | Display options (channel filters, heatmap, segmentation, etc.)        |

## Python Test Data

Located in `tests/test-data/workspace/`:

| Script                    | Variables                                                    |
| ------------------------- | ------------------------------------------------------------ |
| `debug_test.py`           | `x` — 2×2 RGB numpy array                                    |
| `numpy_test.py`           | `rgb_image`, `float_image`, `gray_uint8`, `large_image`, `x` |
| `pil_test.py`             | `pil_rgb`, `pil_gray`, `pil_rgba` (PIL Image objects)        |
| `matplotlib_test.py`      | `fig_line`, `fig_bar` (matplotlib Figure objects)            |
| `tracking_test.py`        | `img` modified across two breakpoints                        |
| `display_options_test.py` | Various images for display option testing                    |

## Running Tests

### Quick validation (no browser)

```bash
yarn test:validate
```

### Full UI tests (needs display)

```bash
yarn ui-test
```

### Headless / CI (recommended)

```bash
yarn ui-test:offscreen
```

Or with custom resolution:

```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" yarn extest run-tests './out/tests/ui-test/*.test.js'
```

### Run a single test file

```bash
yarn test:compile && extest run-tests './out/tests/ui-test/mvp.test.js'
```

### Prerequisites

- **xvfb** for headless: `sudo apt install xvfb`
- **Python dependencies**: `pip install -r tests/test-data/workspace/requirements.txt`
- **Build webview types first**: `yarn build:webview`

## CI Environment

Tests detect CI via environment variables:

- `CI=true` — Enables higher timeouts (60s) and 2 retries per test
- `MOCHA_JUNIT=true` — Outputs JUnit XML for CI test reporting

The GitHub Actions workflow (`.github/workflows/test.yml`) runs the full suite with xvfb and uploads screenshots and test results as artifacts.

## Debugging Failures

- **Screenshots**: Every test failure captures a screenshot with the test name and failed step
- **Debug state logging**: Failed tests log the Image Watch tree structure and debug session state
- **Artifacts in CI**: Screenshots and JUnit XML are uploaded as workflow artifacts
- **Debug launch config**: Use "Debug UI Tests" in `.vscode/launch.json` to step through tests

## Architecture

- **DebugTestHelper** (`DebugTestHelper.ts`): Singleton class with fluent API for all debug UI automation (file opening, debug sessions, Image Watch interaction, webview management, screenshots)
- **test-utils.ts**: Shared utilities for extension activation, webview detection, and error handling
- **globals.ts**: Workspace path constants and `openWorkspace()` with retry logic
- **.mocharc.js**: CI-aware Mocha config (timeouts, retries, JUnit reporter)
