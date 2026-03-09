# E2E Image Verification Improvements — Design

## Problem

The existing e2e image verification tests (`image-rendering.test.ts`, `display-options.test.ts`) have three issues:

1. **Code duplication** — `switchToWebviewFrame()` is implemented identically in both `image-verification-utils.ts` (private) and `display-options.test.ts` (local). A local `clickDisplayOptionButton` also duplicates `clickDisplayOption` from utils.

2. **No debuggable output** — when an assertion fails, there is no visual record of what was actually sampled vs. what was expected. Diagnosing coordinate calibration issues required temporary debug hacks.

3. **Imprecise canvas capture** — `#gl-canvas` is `position: absolute; width: 100%; height: 100%` (full viewport). Its element screenshot includes the Image Watch sidebar HTML (left ~47%) that bleeds through the transparent canvas area, forcing all sample coordinates to carry a large, fragile x-offset.

---

## Design

### 1. Code De-duplication

**What:** Export `switchToWebviewFrame` from `image-verification-utils.ts` and remove the duplicate implementation in `display-options.test.ts`. Also replace the local `clickDisplayOptionButton` in `display-options.test.ts` with the existing `clickDisplayOption` from utils.

**Why:** Single source of truth for iframe navigation. Any future change (e.g. VS Code adds a new iframe level) only needs to be fixed in one place.

**Scope:** `image-verification-utils.ts` (add `export`), `display-options.test.ts` (delete local functions, add imports).

---

### 2. HTML Debug Report (`SVIFPD_DEBUG_IMAGES`)

**When:** Only when the environment variable `SVIFPD_DEBUG_IMAGES=1` is set. Keeps normal test runs clean.

**Output:** One self-contained `.html` file per test, written to `SVIFPD_DEBUG_DIR` (default `/tmp/svifpd-debug/`). The file contains:

- The canvas screenshot embedded as a base64 `<img>`
- SVG `<rect>` overlays for every sampled region/point, color-coded:
  - **Green** — assertion passed
  - **Red** — assertion failed
  - **Grey** — region sampled but not yet asserted
- SVG `<text>` labels on each rectangle showing sampled RGB and the assertion context string

**Implementation:** New `DebugAnnotator` class in `image-verification-utils.ts`:

```
class DebugAnnotator {
  constructor(img: JimpImg, testName: string)
  addRegion(relX, relY, relW, relH, label: string, color: RgbColor, pass: boolean | null): void
  saveHtml(outputDir: string): Promise<void>   // writes <testName>.html
}
```

Assertion helpers (`assertDominantChannel`, `assertBrighterThan`, etc.) gain an optional last parameter `annotator?: DebugAnnotator`. When provided, they call `annotator.addRegion(...)` before throwing or returning.

`captureCanvasImage()` accepts an optional `testName` and, when `SVIFPD_DEBUG_IMAGES=1`, returns an annotator alongside the image. A convenience wrapper `captureAnnotatedCanvas(driver, testName)` returns `{ img, annotator }`.

Tests save the annotator in `afterEach` (or in `catch`) via `annotator?.saveHtml(debugDir)`.

---

### 3. `.view-container` Screenshot + Auto-crop

**Why it's better than `#gl-canvas`:**

The canvas is `position: absolute; top:0; left:0; width:100%; height:100%` relative to the webview root — it covers the full viewport. WebGL scissor restricts _rendering_ to the `.view-container` grid cell, but the element screenshot of `#gl-canvas` captures the visual composite including sidebar HTML underneath the transparent canvas area.

`.view-container` is inside the `main` grid area (no sidebar, no toolbar, no status bar). `element.takeScreenshot()` of `.view-container` returns its visual bounding rect, which includes the overlaid canvas pixels — so we get the rendered image without the sidebar.

**Auto-crop:** After capturing `.view-container`, sample the 4 corners (3×3 pixel average) to detect the background color. Scan inward from each of the 4 edges to find the first row/column with a pixel differing by more than `tolerance=20` from the background. Crop to the resulting tight bounding box.

**Result:** Sample coordinates can now be expressed directly relative to the image (e.g. left=0.0–0.33, middle=0.33–0.67, right=0.67–1.0), with no sidebar x-offset.

**Fallback:** If `.view-container` is not found in the DOM, fall back to the existing `#gl-canvas` capture (no auto-crop).

**Changes:** `captureCanvasImage()` in `image-verification-utils.ts` (swap element selector, add crop logic). All `sampleRegion` / `samplePoint` coordinate constants in `image-rendering.test.ts` and `display-options.test.ts` updated to the new (sidebar-free) coordinate space. `waitForCanvasToRender` sampling strips also updated.

---

## Testing

- Run `image-rendering.test.ts` locally with `xvfb-run` after each change
- Run `display-options.test.ts` locally to confirm de-duplication didn't break anything
- Run with `SVIFPD_DEBUG_IMAGES=1 SVIFPD_DEBUG_DIR=/tmp/svifpd-debug` and inspect the generated HTML reports
- Push to PR #221 only after all tests pass locally
