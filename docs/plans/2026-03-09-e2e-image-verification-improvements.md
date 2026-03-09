# E2E Image Verification Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the e2e image verification tests with code de-duplication, HTML debug reports for failed assertions, and more accurate canvas capture via `.view-container` screenshot + auto-crop.

**Architecture:** Three independent improvements to `tests/ui-test/image-verification-utils.ts` and the two test files. Feature 3 (view-container capture) changes the coordinate space for all `sampleRegion` calls, so all coordinates must be re-validated locally after implementation. Validate locally with xvfb before pushing.

**Tech Stack:** TypeScript, Jimp 1.x (`img.autocrop()`, `img.getBase64()`, `img.crop()`), Mocha/Chai, vscode-extension-tester, xvfb-run.

**Run tests locally with:**
```bash
cd /path/to/repo
yarn test:compile
export VENV_BIN="$(pwd)/.venv/bin"
PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/image-rendering.test.js' --storage test-resources
```
Also run `display-options` separately:
```bash
PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/display-options.test.js' --storage test-resources
```

---

## Task 1: Export `switchToWebviewFrame` and de-duplicate `display-options.test.ts`

**Files:**
- Modify: `tests/ui-test/image-verification-utils.ts` — export the private function
- Modify: `tests/ui-test/display-options.test.ts` — delete local duplicates, import from utils

### Step 1: Export `switchToWebviewFrame` in image-verification-utils.ts

Change the function declaration from:
```typescript
async function switchToWebviewFrame(driver: WebDriver): Promise<boolean> {
```
to:
```typescript
export async function switchToWebviewFrame(driver: WebDriver): Promise<boolean> {
```

### Step 2: Update display-options.test.ts imports

Change the import block at the top from:
```typescript
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
  sampleRegion,
} from './image-verification-utils';
```
to:
```typescript
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
  clickDisplayOption,
  sampleRegion,
  switchToWebviewFrame,
} from './image-verification-utils';
```

Also remove the `WebElement` type import (it was only used by `clickDisplayOptionButton`):
```typescript
// DELETE this line:
import type { WebElement } from 'selenium-webdriver';
```

### Step 3: Delete local duplicate functions in display-options.test.ts

Delete the entire bodies of these four local functions (lines ~69–276):
- `switchToWebviewFrame()` (lines ~69–154) — now imported from utils
- `switchToMainContent()` (lines ~156–162) — replace inline with `driver.switchTo().defaultContent()`
- `clickDisplayOptionButton()` (lines ~164–209) — replaced by `clickDisplayOption` from utils
- `testDisplayOption()` (lines ~211–276) — replaced by direct `clickDisplayOption` calls

### Step 4: Replace uses of `testDisplayOption` / `clickDisplayOptionButton`

Each call like:
```typescript
const redClicked = await testDisplayOption('Red Channel', 'rgb-red-channel');
```
becomes:
```typescript
const redClicked = await clickDisplayOption(driver, 'Red Channel');
```
(Drop the screenshot-suffix argument — the screenshot logic inside `testDisplayOption` was just extra screenshots not needed for assertions.)

For places that used the return value just for a boolean check:
```typescript
if (redClicked) { ... }
```
Keep the same pattern but use the new form.

For places that didn't use the return value at all (just reset/colormap clicks), simplify to:
```typescript
await clickDisplayOption(driver, 'Reset');
```

Also delete the `viewVariableAndScreenshot` helper and replace its calls:
```typescript
// OLD:
await viewVariableAndScreenshot('rgb_gradient', 'success-rgb-default');
// NEW (no screenshot needed, just perform the action):
await debugHelper.performVariableAction({
  variableName: 'rgb_gradient',
  actionLabel: 'View Image',
  retrySetup: true,
  setupRetries: 5,
  type: 'variable',
});
await debugHelper.wait(1000);
await debugHelper.getWebviewEditor();
await debugHelper.wait(500);
```
Or better — extract a `viewVariable(name)` helper matching the one in `image-rendering.test.ts`.

### Step 5: Verify lint and compile
```bash
yarn lint && yarn test:compile
```
Expected: no errors.

### Step 6: Run display-options tests locally
```bash
PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/display-options.test.js' --storage test-resources
```
Expected: 1 test passing.

### Step 7: Commit
```bash
git add tests/ui-test/image-verification-utils.ts tests/ui-test/display-options.test.ts
git commit -m "refactor: de-duplicate switchToWebviewFrame and clickDisplayOption

Export switchToWebviewFrame from image-verification-utils.
Remove local duplicate implementations in display-options.test.ts.
Replace testDisplayOption/clickDisplayOptionButton with imported clickDisplayOption.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Add `DebugAnnotator` for HTML debug reports

**Files:**
- Modify: `tests/ui-test/image-verification-utils.ts` — add `DebugAnnotator` class and `captureAnnotatedCanvas`
- Modify: `tests/ui-test/image-rendering.test.ts` — integrate annotator
- Modify: `tests/ui-test/display-options.test.ts` — integrate annotator

### Step 1: Add `DebugAnnotator` class to image-verification-utils.ts

Add the following **before** the `captureCanvasImage` function:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

/** A single annotated region recorded by DebugAnnotator. */
interface Annotation {
  relX: number;
  relY: number;
  relW: number;
  relH: number;
  label: string;
  sampledColor: RgbColor;
  pass: boolean | null; // null = not yet evaluated
}

/**
 * Accumulates per-region annotations for a canvas capture and writes an HTML
 * debug report when SVIFPD_DEBUG_IMAGES=1 is set.
 *
 * Usage pattern:
 *   const annotator = new DebugAnnotator(img, 'my-test');
 *   const color = sampleRegion(img, relX, relY, relW, relH);
 *   annotator.record(relX, relY, relW, relH, color,
 *     () => assertDominantChannel(color, 'r', 50, 'left should be red'),
 *     'left-red');
 *   // In afterEach:
 *   await annotator.saveHtml();
 */
export class DebugAnnotator {
  private annotations: Annotation[] = [];
  private img: JimpImg;
  private testName: string;

  constructor(img: JimpImg, testName: string) {
    this.img = img;
    this.testName = testName;
  }

  /**
   * Execute an assertion function, record the region as pass/fail, and
   * re-throw on failure so the test still fails.
   */
  record(
    relX: number,
    relY: number,
    relW: number,
    relH: number,
    sampledColor: RgbColor,
    assertFn: () => void,
    label: string,
  ): void {
    try {
      assertFn();
      this.annotations.push({ relX, relY, relW, relH, label, sampledColor, pass: true });
    }
    catch (error) {
      this.annotations.push({ relX, relY, relW, relH, label, sampledColor, pass: false });
      throw error;
    }
  }

  /** Record a region without an assertion (shown grey in the HTML report). */
  addRegion(
    relX: number,
    relY: number,
    relW: number,
    relH: number,
    sampledColor: RgbColor,
    label: string,
  ): void {
    this.annotations.push({ relX, relY, relW, relH, label, sampledColor, pass: null });
  }

  /**
   * Write an HTML debug report to SVIFPD_DEBUG_DIR (default /tmp/svifpd-debug/).
   * Only writes when SVIFPD_DEBUG_IMAGES=1 is set.
   */
  async saveHtml(): Promise<void> {
    if (!process.env['SVIFPD_DEBUG_IMAGES']) {
      return;
    }
    const outputDir = process.env['SVIFPD_DEBUG_DIR'] ?? '/tmp/svifpd-debug';
    fs.mkdirSync(outputDir, { recursive: true });

    const base64 = await this.img.getBase64('image/png');
    const w = this.img.width;
    const h = this.img.height;

    const svgOverlays = this.annotations.map(a => {
      const x = Math.round(a.relX * w);
      const y = Math.round(a.relY * h);
      const rw = Math.round(a.relW * w);
      const rh = Math.round(a.relH * h);
      const color = a.pass === true ? '#00ff00' : a.pass === false ? '#ff0000' : '#888888';
      const colorSwatch = `rgb(${Math.round(a.sampledColor.r)},${Math.round(a.sampledColor.g)},${Math.round(a.sampledColor.b)})`;
      const labelText = `${a.label} | sampled: r=${Math.round(a.sampledColor.r)} g=${Math.round(a.sampledColor.g)} b=${Math.round(a.sampledColor.b)}`;
      return `
  <rect x="${x}" y="${y}" width="${rw}" height="${rh}"
        fill="none" stroke="${color}" stroke-width="2"/>
  <rect x="${x}" y="${y + rh + 2}" width="12" height="12" fill="${colorSwatch}" stroke="${color}" stroke-width="1"/>
  <text x="${x + 16}" y="${y + rh + 13}" fill="${color}" font-size="11" font-family="monospace">${escapeHtml(labelText)}</text>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Debug: ${escapeHtml(this.testName)}</title>
<style>body{background:#1e1e1e;color:#ccc;font-family:monospace;padding:16px}
h1{font-size:14px;margin-bottom:8px}</style></head>
<body>
<h1>Test: ${escapeHtml(this.testName)}</h1>
<div style="position:relative;display:inline-block">
  <img src="${base64}" style="display:block;max-width:100%"/>
  <svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none"
       viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
${svgOverlays}
  </svg>
</div>
</body></html>`;

    const filename = path.join(outputDir, `${this.testName.replace(/[^a-z0-9-]/gi, '_')}.html`);
    fs.writeFileSync(filename, html, 'utf-8');
    DebugTestHelper.logger.info(`DebugAnnotator: saved HTML report → ${filename}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

### Step 2: Add `captureAnnotatedCanvas` convenience function

Add after `captureCanvasImage`:

```typescript
/**
 * Capture canvas and return both the image and a DebugAnnotator pre-loaded with it.
 * The annotator writes an HTML report on saveHtml() when SVIFPD_DEBUG_IMAGES=1.
 */
export async function captureAnnotatedCanvas(
  driver: WebDriver,
  testName: string,
): Promise<{ img: JimpImg; annotator: DebugAnnotator } | null> {
  const img = await captureCanvasImage(driver);
  if (!img) {
    return null;
  }
  return { img, annotator: new DebugAnnotator(img, testName) };
}
```

### Step 3: Integrate annotator into image-rendering.test.ts

For each test, replace the raw `sampleRegion + assertXxx` pairs with `annotator.record(...)`.

Example — current pattern:
```typescript
const leftRegion = sampleRegion(img!, 0.52, 0.22, 0.10, 0.30);
assertDominantChannel(leftRegion, 'r', 50, 'left region should be red');
```

New pattern:
```typescript
const captured = await captureAnnotatedCanvas(driver, 'rendering-rgb-left-red');
expect(captured, 'canvas capture returned null').to.not.be.null;
const { img, annotator } = captured!;

const leftRegion = sampleRegion(img, 0.52, 0.22, 0.10, 0.30);
annotator.record(0.52, 0.22, 0.10, 0.30, leftRegion,
  () => assertDominantChannel(leftRegion, 'r', 50, 'left region should be red'),
  'left-red');
```

Add in the `after`/`afterEach` hook (or in a try/finally in each test):
```typescript
afterEach(async () => {
  // annotator is defined per-test — no shared state needed
});
```

Actually, since each test creates its own annotator, the simplest approach is to call `annotator.saveHtml()` at the END of each test (in a try/finally):

```typescript
it('should render the left region of rgb_gradient as red', async () => {
  debugHelper.setCurrentTest('rendering-rgb-left-red');
  await viewVariable('rgb_gradient');
  const driver = VSBrowser.instance.driver;
  const captured = await captureAnnotatedCanvas(driver, 'rendering-rgb-left-red');
  expect(captured, 'canvas capture returned null').to.not.be.null;
  const { img, annotator } = captured!;

  try {
    const leftRegion = sampleRegion(img, 0.52, 0.22, 0.10, 0.30);
    annotator.record(0.52, 0.22, 0.10, 0.30, leftRegion,
      () => assertDominantChannel(leftRegion, 'r', 50, 'left region should be red'),
      'left-red');
  }
  finally {
    await annotator.saveHtml();
  }
}).timeout(300000);
```

Apply this pattern to all 6 tests in `image-rendering.test.ts`. For tests that capture multiple images (BGR swap), create separate annotators (or reuse one per capture).

For `display-options.test.ts`, wrap the two pixel-assertion blocks similarly.

### Step 4: Add `captureAnnotatedCanvas` to the imports in both test files

In `image-rendering.test.ts`, change the import:
```typescript
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
  assertGrayscale,
  captureAnnotatedCanvas,    // ADD
  clickDisplayOption,
  samplePoint,
  sampleRegion,
  waitForCanvasToRender,
} from './image-verification-utils';
```

Remove `DebugTestHelper.captureCanvasImage()` calls and replace with `captureAnnotatedCanvas(driver, testName)`.

### Step 5: Lint, compile, run tests

```bash
yarn lint && yarn test:compile
SVIFPD_DEBUG_IMAGES=1 SVIFPD_DEBUG_DIR=/tmp/svifpd-debug \
  PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/image-rendering.test.js' --storage test-resources
```

Expected:
- All 7 tests pass
- `/tmp/svifpd-debug/*.html` files created — open in browser to inspect annotated regions

### Step 6: Commit
```bash
git add tests/ui-test/image-verification-utils.ts tests/ui-test/image-rendering.test.ts tests/ui-test/display-options.test.ts
git commit -m "feat: add DebugAnnotator HTML debug reports for pixel assertions

When SVIFPD_DEBUG_IMAGES=1, saves an HTML file per test to
SVIFPD_DEBUG_DIR (/tmp/svifpd-debug/ by default).  Each file shows
the captured canvas with SVG rectangle overlays for every sampled
region, colour-coded green/red/grey for pass/fail/unevaluated.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Switch canvas capture to `.view-container` + autocrop

**Files:**
- Modify: `tests/ui-test/image-verification-utils.ts` — update `captureCanvasImage`
- Modify: `tests/ui-test/image-rendering.test.ts` — update sample coordinates
- Modify: `tests/ui-test/display-options.test.ts` — update sample coordinates
- Modify: `tests/ui-test/DebugTestHelper.ts` — ensure `captureCanvasImage` still delegates cleanly

### Why this is better

`#gl-canvas` is `position: absolute; width: 100%; height: 100%` on the webview root. Its element screenshot captures the full viewport including the webview's internal sidebar (image list, ~47% of width). `.view-container` is the `main` grid cell (no sidebar, no toolbar, no status bar). Its element screenshot is cropped to just the rendering area. After `autocrop()`, we get just the rendered image pixels — so sample coordinates can be expressed as true image fractions (left third ≈ 0.0–0.33, etc.).

### Step 1: Update `captureCanvasImage` in image-verification-utils.ts

Replace the canvas-finding and screenshot block:

```typescript
// OLD:
const canvasElements = await driver.findElements(By.css('#gl-canvas'));
if (canvasElements.length === 0) { ... }
const base64 = await canvasElements[0].takeScreenshot();
```

with:

```typescript
// Try .view-container first (tight crop around rendering area, no internal sidebar).
// Fall back to #gl-canvas if not found (older layout or unexpected DOM state).
let base64: string | null = null;
const viewContainerElements = await driver.findElements(By.css('.view-container'));
if (viewContainerElements.length > 0) {
  base64 = await viewContainerElements[0].takeScreenshot().catch(() => null);
  DebugTestHelper.logger.debug('captureCanvasImage: captured .view-container');
}
if (!base64) {
  const canvasElements = await driver.findElements(By.css('#gl-canvas'));
  if (canvasElements.length === 0) {
    DebugTestHelper.logger.warn('captureCanvasImage: neither .view-container nor #gl-canvas found');
    return null;
  }
  base64 = await canvasElements[0].takeScreenshot().catch(() => null);
  DebugTestHelper.logger.debug('captureCanvasImage: captured #gl-canvas (fallback)');
}
if (!base64) {
  DebugTestHelper.logger.warn('captureCanvasImage: empty screenshot returned');
  return null;
}

let img = await Jimp.fromBuffer(Buffer.from(base64, 'base64'));

// Autocrop: trim the VS Code background color from all 4 edges.
// The background color is taken from the corner pixels; the rendered image
// content differs from it by more than the tolerance threshold.
const preCropSize = `${img.width}×${img.height}`;
img.autocrop({ tolerance: 0.05, leaveBorder: 2 });
DebugTestHelper.logger.info(`captureCanvasImage: ${preCropSize} → ${img.width}×${img.height} (after autocrop)`);
return img;
```

Also update `waitForCanvasToRender` sampling strips — after autocrop the image fills roughly the whole capture, so use:
```typescript
const points = [
  sampleRegion(img, 0.10, 0.30, 0.20, 0.40), // left third
  sampleRegion(img, 0.40, 0.30, 0.20, 0.40), // centre
  sampleRegion(img, 0.70, 0.30, 0.20, 0.40), // right third
];
```

### Step 2: Compile and run with debug enabled to see new coordinates

```bash
yarn test:compile
SVIFPD_DEBUG_IMAGES=1 SVIFPD_DEBUG_DIR=/tmp/svifpd-debug \
  PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/image-rendering.test.js' --storage test-resources
```

Open the HTML reports in `/tmp/svifpd-debug/` to see where the current sample rectangles land on the new (sidebar-free, autocropped) images.

### Step 3: Update sample coordinates in image-rendering.test.ts

After autocrop, `rgb_gradient` (100h × 150w) fills the captured area. Expected new coordinate layout (verify against HTML reports):

```
rgb_gradient (100h × 150w, 3 equal bands):
  Left  red   (cols   0– 50): x ≈ 0.03–0.30
  Middle green (cols  50–100): x ≈ 0.37–0.63
  Right  blue  (cols 100–150): x ≈ 0.70–0.97
  y: full height (0.05–0.95)

grayscale (100h × 200w, gradient 0→255 L→R):
  mid-brightness col: x ≈ 0.50
  dark col (near left edge): x ≈ 0.05

heatmap (100h × 150w, Gaussian peak at centre):
  centre: x ≈ 0.50, y ≈ 0.50
  corner (top-left): x ≈ 0.05, y ≈ 0.05
```

Update all `sampleRegion` / `samplePoint` calls accordingly. Example:
```typescript
// rgb_gradient left red
const leftRegion = sampleRegion(img, 0.05, 0.20, 0.22, 0.60);
// rgb_gradient middle green
const middleRegion = sampleRegion(img, 0.38, 0.20, 0.22, 0.60);
// rgb_gradient right blue
const rightRegion = sampleRegion(img, 0.72, 0.20, 0.22, 0.60);
```

**Note:** The exact values must be confirmed by inspecting the HTML debug reports. Adjust until all tests pass.

### Step 4: Update sample coordinates in display-options.test.ts

Current coords (0.05, 0.38, 0.55) were based on the #gl-canvas layout. After autocrop:
- `imgAfterRed` samples for `rgb_gradient` → use the same new coords as image-rendering.test.ts
- `imgBeforeBgr` / `imgAfterBgr` samples for `bgr_test` → validate via HTML reports

### Step 5: Run both test files until all pass

```bash
yarn test:compile
# image-rendering:
PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/image-rendering.test.js' --storage test-resources

# display-options:
PATH="$VENV_BIN:$PATH" xvfb-run -a --server-args="-screen 0 1920x1080x24" \
  ./node_modules/.bin/extest run-tests './out/tests/ui-test/display-options.test.js' --storage test-resources
```

Iterate (inspect HTML reports → adjust coords → recompile → re-run) until **all tests pass**.

### Step 6: Commit
```bash
git add tests/ui-test/image-verification-utils.ts tests/ui-test/image-rendering.test.ts tests/ui-test/display-options.test.ts
git commit -m "feat: capture .view-container + autocrop for sidebar-free pixel coords

Switch captureCanvasImage from #gl-canvas (full viewport, includes
webview internal sidebar) to .view-container (main grid cell only).
Apply Jimp autocrop to trim VS Code background from all 4 edges.

Result: sample coordinates are now true image fractions (1/3 = left
band, 2/3 = right band), removing the 0.47 sidebar x-offset and the
right-edge overflow that previously caused blue band to be clipped.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Push and verify CI

### Step 1: Push to PR branch
```bash
git push origin feat/e2e-image-verification
```

### Step 2: Monitor CI
Wait for GitHub Actions to run. The workflow is `.github/workflows/ci.yml`.

### Step 3: If CI passes, request review
The PR is #221: https://github.com/elazarcoh/simply-view-image-for-python-debugging/pull/221

---

## Notes

- Tasks 1, 2, 3 are independent and can be done in order without blocking each other.
- Task 3's coordinate update step (Step 3) requires at least one test run with `SVIFPD_DEBUG_IMAGES=1` to inspect actual HTML output — do NOT guess coordinates, always validate empirically.
- The `autocrop` call may occasionally over-crop if the rendered image exactly matches the background color at its edges (unlikely for solid-color test images, but worth checking).
- If `autocrop` is too aggressive, reduce tolerance: `img.autocrop({ tolerance: 0.02, leaveBorder: 1 })`.
