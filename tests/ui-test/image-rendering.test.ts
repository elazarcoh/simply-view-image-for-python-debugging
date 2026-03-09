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
  clickDisplayOption,
  samplePoint,
  sampleRegion,
} from './image-verification-utils';

describe('image rendering verification', () => {
  let debugHelper: DebugTestHelper;

  before(async () => {
    DebugTestHelper.logger.step('Opening workspace for image rendering tests');
    await openWorkspace();

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

  /**
   * Helper: start the display_options_test.py debug session and wait at the breakpoint.
   * All test images are available at that breakpoint.
   */
  async function startDebugSession(): Promise<void> {
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
    // Focus the Image View panel so subsequent element screenshots capture the GL canvas.
    await debugHelper.getWebviewEditor();
    await debugHelper.wait(1500);
  }

  // ---------------------------------------------------------------------------
  // RGB gradient — basic channel rendering
  //
  // The `rgb_gradient` numpy array is 100×150 uint8 with three solid regions:
  //   Left  third  (cols   0– 50): pure red   (255, 0, 0)
  //   Middle third (cols  50–100): pure green  (0, 255, 0)
  //   Right  third (cols 100–150): pure blue   (0, 0, 255)
  // ---------------------------------------------------------------------------

  it('should render the left region of rgb_gradient as red', async () => {
    debugHelper.setCurrentTest('rendering-rgb-left-red');

    await startDebugSession();
    await viewVariable('rgb_gradient');

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    // Sample the centre of the left third (relative coords)
    const leftRegion = sampleRegion(img!, 0.05, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`rgb_gradient left region mean: ${JSON.stringify(leftRegion)}`);

    assertDominantChannel(leftRegion, 'r', 50, 'left region should be red');
  }).timeout(300000);

  it('should render the middle region of rgb_gradient as green', async () => {
    debugHelper.setCurrentTest('rendering-rgb-middle-green');

    await startDebugSession();
    await viewVariable('rgb_gradient');

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    const middleRegion = sampleRegion(img!, 0.38, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`rgb_gradient middle region mean: ${JSON.stringify(middleRegion)}`);

    assertDominantChannel(middleRegion, 'g', 50, 'middle region should be green');
  }).timeout(300000);

  it('should render the right region of rgb_gradient as blue', async () => {
    debugHelper.setCurrentTest('rendering-rgb-right-blue');

    await startDebugSession();
    await viewVariable('rgb_gradient');

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    const rightRegion = sampleRegion(img!, 0.70, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`rgb_gradient right region mean: ${JSON.stringify(rightRegion)}`);

    assertDominantChannel(rightRegion, 'b', 50, 'right region should be blue');
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // Grayscale gradient — all channels should be roughly equal
  //
  // `grayscale` is a 100×200 uint8 gradient (0→255, repeated vertically).
  // When rendered normally, R, G, B channels should be the same at any given point.
  // ---------------------------------------------------------------------------

  it('should render grayscale_gradient with equal R/G/B channels', async () => {
    debugHelper.setCurrentTest('rendering-grayscale-equal-channels');

    await startDebugSession();
    await viewVariable('grayscale');

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    // Sample a mid-brightness point (around 50% width = ~127 intensity)
    const midPoint = samplePoint(img!, 0.5, 0.5, 0.08);
    DebugTestHelper.logger.info(`grayscale mid point mean: ${JSON.stringify(midPoint)}`);
    assertGrayscale(midPoint, 25, 'mid-brightness point of grayscale gradient');

    // Sample a dark point (near left edge)
    const darkPoint = samplePoint(img!, 0.05, 0.5, 0.04);
    DebugTestHelper.logger.info(`grayscale dark point mean: ${JSON.stringify(darkPoint)}`);
    assertGrayscale(darkPoint, 25, 'dark point of grayscale gradient');
  }).timeout(300000);

  // ---------------------------------------------------------------------------
  // Heatmap — Gaussian peak should be brighter than corners
  //
  // `heatmap` is a 100×150 float32 Gaussian: peak at centre (~1.0), corners near 0.
  // ---------------------------------------------------------------------------

  it('should render heatmap_image with brighter centre than corners', async () => {
    debugHelper.setCurrentTest('rendering-heatmap-brightness');

    await startDebugSession();
    await viewVariable('heatmap');

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    const centre = samplePoint(img!, 0.5, 0.5, 0.05);
    const corner = samplePoint(img!, 0.05, 0.05, 0.04);
    DebugTestHelper.logger.info(`heatmap centre: ${JSON.stringify(centre)}, corner: ${JSON.stringify(corner)}`);

    assertBrighterThan(centre, corner, 30, 'Gaussian peak should be brighter than corner');
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

    await startDebugSession();
    await viewVariable('rgb_gradient');

    // Capture BEFORE swap
    const before = await debugHelper.captureCanvasImage();
    expect(before, 'before-swap canvas capture returned null').to.not.be.null;

    const leftBefore = sampleRegion(before!, 0.05, 0.2, 0.25, 0.6);
    const rightBefore = sampleRegion(before!, 0.70, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`BEFORE swap — left: ${JSON.stringify(leftBefore)}, right: ${JSON.stringify(rightBefore)}`);

    // Apply BGR swap
    const driver = VSBrowser.instance.driver;
    const clicked = await clickDisplayOption(driver, 'Swap RGB/BGR');
    expect(clicked, '"Swap RGB/BGR" button not found').to.be.true;

    // Capture AFTER swap
    const after = await debugHelper.captureCanvasImage();
    expect(after, 'after-swap canvas capture returned null').to.not.be.null;

    const leftAfter = sampleRegion(after!, 0.05, 0.2, 0.25, 0.6);
    const rightAfter = sampleRegion(after!, 0.70, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`AFTER  swap — left: ${JSON.stringify(leftAfter)}, right: ${JSON.stringify(rightAfter)}`);

    // Left was red → should now be blue
    assertChannelSwapped(leftBefore, leftAfter, 'r', 'b', 40, 'left region after BGR swap');
    // Right was blue → should now be red
    assertChannelSwapped(rightBefore, rightAfter, 'b', 'r', 40, 'right region after BGR swap');
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

    await startDebugSession();
    await viewVariable('rgb_gradient');

    // Apply the red channel filter
    const driver = VSBrowser.instance.driver;
    const clicked = await clickDisplayOption(driver, 'Red Channel');
    expect(clicked, '"Red Channel" button not found').to.be.true;

    const img = await debugHelper.captureCanvasImage();
    expect(img, 'canvas capture returned null').to.not.be.null;

    // Left region was pure red → red channel filter preserves it
    const leftRegion = sampleRegion(img!, 0.05, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`Red-channel left region: ${JSON.stringify(leftRegion)}`);
    assertDominantChannel(leftRegion, 'r', 40, 'left region with red channel filter should be red');

    // Middle region was pure green → no red content → should be near-black (dim)
    const middleRegion = sampleRegion(img!, 0.38, 0.2, 0.25, 0.6);
    DebugTestHelper.logger.info(`Red-channel middle region: ${JSON.stringify(middleRegion)}`);
    // The green region should be significantly darker than the red region after red-channel filter
    assertBrighterThan(leftRegion, middleRegion, 40, 'red region should be brighter than green region after red filter');
  }).timeout(300000);
});
