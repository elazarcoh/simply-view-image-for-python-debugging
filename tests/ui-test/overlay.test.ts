/**
 * Overlay Feature Test Suite
 *
 * Tests the overlay and "Edges" display option introduced in this PR.
 *
 * Test data (overlay_test.py):
 *  - base_image  : 100×100 single-channel uint8 — dark background (value 50) with a
 *                  bright circle (value 200, radius 30, centred at 50×50).  The viewer
 *                  renders this as a grayscale image (R = G = B at every pixel).
 *  - seg_mask    : 100×100 uint8 — label 0 = background, label 1 = circle interior,
 *                  derived by thresholding base_image at 100.  The label boundary forms
 *                  a clean circular edge.
 *
 * Test flow (mirrors what a user would do):
 *  1. View base_image → verify canvas is grayscale.
 *  2. Load seg_mask into the viewer, then switch back to base_image.
 *  3. Click the "Overlay" icon next to seg_mask → Segmentation mode (default alpha 0.8).
 *     Label 1 covers the entire circle interior with a distinct hue.
 *     ✔ Assert: circle-centre region is now coloured (not grayscale).
 *  4. Click "Edges" in the overlay toolbar.
 *     Only the circular boundary is drawn; the interior shows the base image.
 *     ✔ Assert: circle-centre region is grayscale again (no edge at centre).
 *  5. Click "Hide Overlay" → verify the canvas reverts to a fully grayscale view.
 */

import type { WebDriver } from 'vscode-extension-tester';
import { VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';
import {
  assertGrayscale,
  captureAnnotatedCanvas,
  clickDisplayOption,
  clickOverlayButtonForExpression,
  sampleRegion,
} from './image-verification-utils';

describe('overlay tests', () => {
  let debugHelper: DebugTestHelper;
  let driver: WebDriver;

  before(async () => {
    DebugTestHelper.logger.step('Opening workspace for overlay tests');
    await openWorkspace();
    DebugTestHelper.logger.step('Workspace opened');

    driver = VSBrowser.instance.driver;

    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
    });
  }).timeout(60000);

  afterEach(async () => {
    if (debugHelper) {
      await debugHelper.cleanup();
    }
  }).timeout(60000);

  after(async () => {
    DebugTestHelper.reset();
  }).timeout(5000);

  async function viewVariable(name: string): Promise<void> {
    await debugHelper.performVariableAction({
      variableName: name,
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 5,
      type: 'variable',
    });
    await debugHelper.wait(1000);
    await debugHelper.getWebviewEditor();
    await debugHelper.wait(500);
  }

  it('should test overlay feature', async () => {
    debugHelper.setCurrentTest('overlay');
    DebugTestHelper.logger.testStart('Testing overlay with Segmentation and Edges display options');

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('overlay_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.wait(2000);

    await debugHelper.expandImageWatchSection();
    await debugHelper.collapseOtherDebugSections();
    await debugHelper.runSetup();
    await debugHelper.wait(1000);

    // ── Step 1: Load base_image — expect a grayscale canvas ────────────────
    DebugTestHelper.logger.step('Step 1: loading base_image (grayscale circle)');
    await viewVariable('base_image');
    const capturedBaseline = await captureAnnotatedCanvas(driver, 'overlay-1-baseline');

    // ── Step 2: Load seg_mask into the viewer, then return to base_image ───
    DebugTestHelper.logger.step('Step 2: loading seg_mask, then switching back to base_image');
    await viewVariable('seg_mask');
    await viewVariable('base_image');

    // ── Step 3: Apply seg_mask as overlay (Segmentation mode, alpha = 0.8) ─
    DebugTestHelper.logger.step('Step 3: clicking "Overlay" icon for seg_mask');
    const overlayApplied = await clickOverlayButtonForExpression(driver, 'seg_mask', 'Overlay');
    if (!overlayApplied) {
      throw new Error('Could not find "Overlay" button for expression "seg_mask"');
    }
    await debugHelper.wait(1000);
    const capturedSegmentation = await captureAnnotatedCanvas(driver, 'overlay-2-segmentation');

    // ── Step 4: Switch to Edges display option ──────────────────────────────
    DebugTestHelper.logger.step('Step 4: clicking "Edges" display option in overlay toolbar');
    const edgesClicked = await clickDisplayOption(driver, 'Edges');
    if (!edgesClicked) {
      throw new Error('Could not find "Edges" display option button in the overlay toolbar');
    }
    await debugHelper.wait(800);
    const capturedEdges = await captureAnnotatedCanvas(driver, 'overlay-3-edges');

    // ── Step 5: Hide overlay ────────────────────────────────────────────────
    DebugTestHelper.logger.step('Step 5: hiding overlay');
    await clickDisplayOption(driver, 'Hide Overlay');
    await debugHelper.wait(800);
    const capturedHidden = await captureAnnotatedCanvas(driver, 'overlay-4-hidden');

    // ── Pixel-level assertions ──────────────────────────────────────────────
    //
    // Sampling region: a 30×30% box centred inside the bright circle, well away
    // from the boundary (circle radius = 30% of image; sample is only 15% from
    // centre → safely inside).
    //
    //   image coords: (35%–65%, 35%–65%)
    //   circle interior (label 1) fills this box in seg_mask.
    //
    const inner = { x: 0.35, y: 0.35, w: 0.30, h: 0.30 } as const;

    if (capturedBaseline) {
      const { img: imgBaseline, annotator } = capturedBaseline;
      try {
        const color = sampleRegion(imgBaseline, inner.x, inner.y, inner.w, inner.h);
        DebugTestHelper.logger.info(`Baseline centre: ${JSON.stringify(color)}`);
        annotator.record(
          inner.x,
          inner.y,
          inner.w,
          inner.h,
          color,
          () => assertGrayscale(color, 20, 'baseline — single-channel image must render as grayscale'),
          'centre-baseline',
        );
      }
      finally {
        await annotator.saveHtml();
      }
    }

    if (capturedSegmentation) {
      const { img: imgSeg, annotator } = capturedSegmentation;
      try {
        const color = sampleRegion(imgSeg, inner.x, inner.y, inner.w, inner.h);
        DebugTestHelper.logger.info(`Segmentation overlay centre: ${JSON.stringify(color)}`);
        // The segmentation colormap assigns a distinct hue to label 1.
        // With default alpha 0.8 the circle interior is heavily tinted → not grayscale.
        annotator.record(
          inner.x,
          inner.y,
          inner.w,
          inner.h,
          color,
          () => {
            const maxDelta = Math.max(
              Math.abs(color.r - color.g),
              Math.abs(color.r - color.b),
              Math.abs(color.g - color.b),
            );
            if (maxDelta < 30) {
              throw new Error(
                `Segmentation overlay should colour the circle interior but centre is still grey: `
                + `r=${color.r} g=${color.g} b=${color.b}, maxDelta=${maxDelta}`,
              );
            }
          },
          'centre-segmentation',
        );
      }
      finally {
        await annotator.saveHtml();
      }
    }

    if (capturedEdges) {
      const { img: imgEdges, annotator } = capturedEdges;
      try {
        const color = sampleRegion(imgEdges, inner.x, inner.y, inner.w, inner.h);
        DebugTestHelper.logger.info(`Edges overlay centre: ${JSON.stringify(color)}`);
        // In Edges mode only the boundary contour of the segmentation is drawn.
        // The interior of the circle has NO edge pixel → the base image shows through.
        // The base image is grayscale, so the sampled region must be grey.
        annotator.record(
          inner.x,
          inner.y,
          inner.w,
          inner.h,
          color,
          () => assertGrayscale(color, 25, 'Edges mode — circle interior should show through as grayscale (no edge at centre)'),
          'centre-edges',
        );
      }
      finally {
        await annotator.saveHtml();
      }
    }

    if (capturedHidden) {
      const { img: imgHidden, annotator } = capturedHidden;
      try {
        const color = sampleRegion(imgHidden, inner.x, inner.y, inner.w, inner.h);
        DebugTestHelper.logger.info(`Hidden overlay centre: ${JSON.stringify(color)}`);
        // Hiding the overlay should restore the plain grayscale rendering.
        annotator.record(
          inner.x,
          inner.y,
          inner.w,
          inner.h,
          color,
          () => assertGrayscale(color, 20, 'Hidden overlay — canvas should revert to grayscale'),
          'centre-hidden',
        );
      }
      finally {
        await annotator.saveHtml();
      }
    }

    DebugTestHelper.logger.success('Overlay feature test completed');
  }).timeout(300000);
});
