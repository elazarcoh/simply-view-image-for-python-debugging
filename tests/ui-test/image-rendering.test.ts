/**
 * Image rendering verification tests.
 *
 * These tests go beyond checking that the webview opens — they verify that the
 * canvas actually renders the correct pixels for known inputs, and that display
 * options visually change the output in the expected direction.
 *
 * Strategy: use images with well-known, predictable pixel values (solid color regions,
 * Gaussian heatmap) and make relative/directional assertions that are robust to
 * canvas scaling, anti-aliasing, and minor GPU differences across machines.
 */

import { expect } from 'chai';
import { VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
  assertGrayscale,
  captureAnnotatedCanvas,
  clickDisplayOption,
  samplePoint,
  sampleRegion,
  waitForCanvasToRender,
} from './image-verification-utils';

describe('image rendering verification', () => {
  let debugHelper: DebugTestHelper;

  /**
   * One shared debug session for all rendering tests.
   * Starting a fresh session per-test causes Image Watch to fail to repopulate
   * variables on subsequent runs (matching the pattern used in display-options.test.ts).
   */
  before(async () => {
    DebugTestHelper.logger.step('Opening workspace for image rendering tests');
    await openWorkspace();

    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
    });

    // Start the single shared debug session.
    await startDebugSession();
  }).timeout(300000);

  after(async () => {
    if (debugHelper) {
      await debugHelper.cleanup();
    }
    DebugTestHelper.reset();
  }).timeout(60000);

  /**
   * Helper: start the display_options_test.py debug session and wait at the breakpoint.
   * All test images are available at that breakpoint.
   */
  async function startDebugSession(): Promise<void> {
    // Close all editors carried over from a previous test run. VS Code persists
    // the editor layout (including Image View) in --storage test-resources, so
    // without this the Image View may already be open with stale content and
    // drawing options when the first test of a fresh run begins.
    const { EditorView } = await import('vscode-extension-tester');
    await new EditorView().closeAllEditors();
    await debugHelper.wait(500);

    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('display_options_test.py'),
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
  }

  /**
   * Helper: open a variable in the Image View webview and ensure the panel is
   * focused so that element screenshots capture the canvas correctly.
   */
  async function viewVariable(name: string): Promise<void> {
    await debugHelper.performVariableAction({
      variableName: name,
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 5,
      type: 'variable',
    });
    await debugHelper.wait(1000);
    // Focus the Image View panel — activating the tab triggers a re-render.
    await debugHelper.getWebviewEditor();
    await debugHelper.wait(500);

    const driver = VSBrowser.instance.driver;

    // Wait until the canvas actually shows a rendered image before asserting.
    // The extension sends image data asynchronously; the canvas stays dark until
    // the first frame renders. We must wait here to avoid capturing a blank canvas.
    const rendered = await waitForCanvasToRender(driver, 15000);
    if (!rendered) {
      DebugTestHelper.logger.warn(`viewVariable: canvas did not render within 15s for "${name}"`);
    }

    // Click "Reset" AFTER the image is loaded so it properly clears any stale
    // display options (BGR swap, channel filters) that may have persisted from a
    // previous test run via VS Code's workbench state.
    const resetOk = await clickDisplayOption(driver, 'Reset');
    if (!resetOk) {
      throw new Error('clickDisplayOption: Reset button not found — cannot guarantee clean state for next test');
    }
    // Give Yew one frame to re-render after the Reset action.
    await debugHelper.wait(500);
  }

  // ---------------------------------------------------------------------------
  // RGB gradient — basic channel rendering
  //
  // The `rgb_gradient` numpy array is 100×150 uint8 with three solid regions:
  //   Left  third  (cols   0– 50): pure red   (255, 0, 0)
  //   Middle third (cols  50–100): pure green  (0, 255, 0)
  //   Right  third (cols 100–150): pure blue   (0, 0, 255)
  //
  // After autocrop the full image is visible; coordinates are expressed as
  // fractions of the cropped image (left≈0.0–0.43, mid≈0.43–0.86, right≈0.86–1.0).
  // ---------------------------------------------------------------------------

  it('should render the left region of rgb_gradient as red', async () => {
    debugHelper.setCurrentTest('rendering-rgb-left-red');

    await viewVariable('rgb_gradient');

    const driver = VSBrowser.instance.driver;
    const captured = await captureAnnotatedCanvas(driver, 'rendering-rgb-left-red');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Left red band: x≈0.0–0.43 in the autocropped image.
      const leftRegion = sampleRegion(img, 0.05, 0.25, 0.35, 0.40);
      DebugTestHelper.logger.info(`rgb_gradient left region mean: ${JSON.stringify(leftRegion)}`);
      annotator.record(0.05, 0.25, 0.35, 0.40, leftRegion, () => assertDominantChannel(leftRegion, 'r', 50, 'left region should be red'), 'left-red');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);

  it('should render the middle region of rgb_gradient as green', async () => {
    debugHelper.setCurrentTest('rendering-rgb-middle-green');

    await viewVariable('rgb_gradient');

    const driver = VSBrowser.instance.driver;
    const captured = await captureAnnotatedCanvas(driver, 'rendering-rgb-middle-green');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Middle green band: x≈0.43–0.86 in the autocropped image.
      const middleRegion = sampleRegion(img, 0.48, 0.25, 0.35, 0.40);
      DebugTestHelper.logger.info(`rgb_gradient middle region mean: ${JSON.stringify(middleRegion)}`);
      annotator.record(0.48, 0.25, 0.35, 0.40, middleRegion, () => assertDominantChannel(middleRegion, 'g', 50, 'middle region should be green'), 'middle-green');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);

  it('should render the right region of rgb_gradient as blue', async () => {
    debugHelper.setCurrentTest('rendering-rgb-right-blue');

    await viewVariable('rgb_gradient');

    const driver = VSBrowser.instance.driver;
    const captured = await captureAnnotatedCanvas(driver, 'rendering-rgb-right-blue');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Right blue band: x≈0.86–1.0 in the autocropped image.
      const rightRegion = sampleRegion(img, 0.88, 0.25, 0.10, 0.40);
      DebugTestHelper.logger.info(`rgb_gradient right region mean: ${JSON.stringify(rightRegion)}`);
      annotator.record(0.88, 0.25, 0.10, 0.40, rightRegion, () => assertDominantChannel(rightRegion, 'b', 50, 'right region should be blue'), 'right-blue');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // Grayscale gradient — all channels should be roughly equal
  //
  // `grayscale` is a 100×200 uint8 gradient (0→255, repeated vertically).
  // When rendered normally, R, G, B channels should be the same at any given point.
  // ---------------------------------------------------------------------------

  it('should render grayscale_gradient with equal R/G/B channels', async () => {
    debugHelper.setCurrentTest('rendering-grayscale-equal-channels');

    await viewVariable('grayscale');

    const driver = VSBrowser.instance.driver;
    const captured = await captureAnnotatedCanvas(driver, 'rendering-grayscale-equal-channels');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Grayscale (100×200 uint8): content x≈0.155–1.0, y≈0.315–0.688.
      // The gradient runs left→right (0→255); sample the mid-brightness area.
      const midPoint = samplePoint(img, 0.72, 0.50, 0.06);
      DebugTestHelper.logger.info(`grayscale mid point mean: ${JSON.stringify(midPoint)}`);
      annotator.record(0.66, 0.44, 0.12, 0.12, midPoint, () => assertGrayscale(midPoint, 25, 'mid-brightness point of grayscale gradient'), 'mid-grayscale');

      // Sample a darker point near the left edge of the image content (close to col 0 = value 0).
      const darkPoint = samplePoint(img, 0.18, 0.50, 0.02);
      DebugTestHelper.logger.info(`grayscale dark point mean: ${JSON.stringify(darkPoint)}`);
      annotator.record(0.16, 0.48, 0.04, 0.04, darkPoint, () => assertGrayscale(darkPoint, 25, 'dark point of grayscale gradient'), 'dark-grayscale');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // Heatmap — Gaussian peak should be brighter than corners
  //
  // `heatmap` is a 100×150 float32 Gaussian: peak at centre (~1.0), corners near 0.
  // ---------------------------------------------------------------------------

  it('should render heatmap_image with brighter centre than corners', async () => {
    debugHelper.setCurrentTest('rendering-heatmap-brightness');

    await viewVariable('heatmap');

    const driver = VSBrowser.instance.driver;
    const captured = await captureAnnotatedCanvas(driver, 'rendering-heatmap-brightness');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Heatmap (100×150 float32): content x≈0.0–1.0, y≈0.22–0.645.
      // The Gaussian peak is at the image centre.
      const centre = samplePoint(img, 0.50, 0.43, 0.05);
      // Corner of the image (near zero of the Gaussian) — use top-left corner with margin.
      const corner = samplePoint(img, 0.10, 0.25, 0.03);
      DebugTestHelper.logger.info(`heatmap centre: ${JSON.stringify(centre)}, corner: ${JSON.stringify(corner)}`);

      // Corner is info-only reference; centre assertion is recorded for the debug report.
      annotator.addRegion(0.07, 0.22, 0.06, 0.06, corner, 'corner-reference');
      annotator.record(0.45, 0.38, 0.10, 0.10, centre, () => assertBrighterThan(centre, corner, 30, 'Gaussian peak should be brighter than corner'), 'centre-peak');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // BGR swap — display option should transpose R and B channels
  //
  // Starting from `rgb_gradient`:
  //   Left region is red before swap → should be blue-dominant after swap.
  //   Right region is blue before swap → should be red-dominant after swap.
  // ---------------------------------------------------------------------------

  it('should swap R and B channels when "Swap RGB/BGR" is applied', async () => {
    debugHelper.setCurrentTest('rendering-bgr-swap');

    await viewVariable('rgb_gradient');

    const driver = VSBrowser.instance.driver;

    // Capture BEFORE swap
    const capturedBefore = await captureAnnotatedCanvas(driver, 'rendering-bgr-swap-before');
    expect(capturedBefore, 'before-swap canvas capture returned null').to.not.be.null;
    if (!capturedBefore) {
      throw new Error('before-swap canvas capture returned null');
    }
    const { img: before, annotator: annotatorBefore } = capturedBefore;

    const leftBefore = sampleRegion(before, 0.05, 0.25, 0.35, 0.40);
    const rightBefore = sampleRegion(before, 0.88, 0.25, 0.10, 0.40);
    DebugTestHelper.logger.info(`BEFORE swap — left: ${JSON.stringify(leftBefore)}, right: ${JSON.stringify(rightBefore)}`);
    annotatorBefore.addRegion(0.05, 0.25, 0.35, 0.40, leftBefore, 'left-before-swap');
    annotatorBefore.addRegion(0.88, 0.25, 0.10, 0.40, rightBefore, 'right-before-swap');

    try {
      // Apply BGR swap
      const clicked = await clickDisplayOption(driver, 'Swap RGB/BGR');
      expect(clicked, '"Swap RGB/BGR" button not found').to.be.true;

      // Capture AFTER swap
      const capturedAfter = await captureAnnotatedCanvas(driver, 'rendering-bgr-swap-after');
      expect(capturedAfter, 'after-swap canvas capture returned null').to.not.be.null;
      if (!capturedAfter) {
        throw new Error('after-swap canvas capture returned null');
      }
      const { img: after, annotator: annotatorAfter } = capturedAfter;

      try {
        const leftAfter = sampleRegion(after, 0.05, 0.25, 0.35, 0.40);
        const rightAfter = sampleRegion(after, 0.88, 0.25, 0.10, 0.40);
        DebugTestHelper.logger.info(`AFTER  swap — left: ${JSON.stringify(leftAfter)}, right: ${JSON.stringify(rightAfter)}`);

        // Left was red → should now be blue
        annotatorAfter.record(0.05, 0.25, 0.35, 0.40, leftAfter, () => assertChannelSwapped(leftBefore, leftAfter, 'r', 'b', 40, 'left region after BGR swap'), 'left-after-swap');
        // Right was blue → should now be red
        annotatorAfter.record(0.88, 0.25, 0.10, 0.40, rightAfter, () => assertChannelSwapped(rightBefore, rightAfter, 'b', 'r', 40, 'right region after BGR swap'), 'right-after-swap');
      }
      finally {
        await annotatorAfter.saveHtml();
      }
    }
    finally {
      await annotatorBefore.saveHtml();
    }
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // Red channel filter — only the R channel should remain
  //
  // After clicking "Red Channel" on `rgb_gradient`:
  //   Left region was (255, 0, 0) → R channel only → should be red-dominant
  //   Middle region was (0, 255, 0) → G becomes zero → near black
  // ---------------------------------------------------------------------------

  it('should isolate red channel when "Red Channel" filter is applied', async () => {
    debugHelper.setCurrentTest('rendering-red-channel-filter');

    await viewVariable('rgb_gradient');

    // Apply the red channel filter
    const driver = VSBrowser.instance.driver;
    const clicked = await clickDisplayOption(driver, 'Red Channel');
    expect(clicked, '"Red Channel" button not found').to.be.true;

    const captured = await captureAnnotatedCanvas(driver, 'rendering-red-channel-filter');
    expect(captured, 'canvas capture returned null').to.not.be.null;
    if (!captured) {
      throw new Error('canvas capture returned null');
    }
    const { img, annotator } = captured;

    try {
      // Left red band: x≈0.0–0.43; pure red stays bright after red-channel filter.
      const leftRegion = sampleRegion(img, 0.05, 0.25, 0.35, 0.40);
      DebugTestHelper.logger.info(`Red-channel left region: ${JSON.stringify(leftRegion)}`);
      annotator.record(0.05, 0.25, 0.35, 0.40, leftRegion, () => assertDominantChannel(leftRegion, 'r', 40, 'left region with red channel filter should be red'), 'left-red');

      // Middle green band: x≈0.43–0.86; green→no red content→near-black after red filter.
      const middleRegion = sampleRegion(img, 0.48, 0.25, 0.35, 0.40);
      DebugTestHelper.logger.info(`Red-channel middle region: ${JSON.stringify(middleRegion)}`);
      // The green region should be significantly darker than the red region after red-channel filter
      annotator.record(0.48, 0.25, 0.35, 0.40, middleRegion, () => assertBrighterThan(leftRegion, middleRegion, 40, 'red region should be brighter than green region after red filter'), 'middle-green-dark');
    }
    finally {
      await annotator.saveHtml();
    }
  }).timeout(300000);
});
