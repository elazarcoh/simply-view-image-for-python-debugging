/**
 * Display Options Test Suite
 *
 * Tests the display options feature by creating various types of images
 * and verifying that the display options buttons work correctly.
 *
 * Test images created:
 * - RGB gradient: Red/Green/Blue regions for channel filtering tests
 * - Grayscale gradient: For high contrast and invert tests
 * - Segmentation mask: Integer labels for segmentation colormap test
 * - Heatmap image: Float32 gaussian for heatmap colormap test
 * - RGBA image: Checkerboard alpha for ignore alpha test
 * - BGR test image: Cyan/Red pattern for RGB/BGR swap test
 * - Low contrast image: For high contrast enhancement test
 */

import type { WebDriver } from 'vscode-extension-tester';
import { VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
  captureAnnotatedCanvas,
  clickDisplayOption,
  sampleRegion,
} from './image-verification-utils';

describe('display options tests', () => {
  let debugHelper: DebugTestHelper;
  let driver: WebDriver;

  before(async () => {
    DebugTestHelper.logger.step('Opening workspace for display options tests');
    await openWorkspace();
    DebugTestHelper.logger.step('Workspace opened');

    driver = VSBrowser.instance.driver;

    // Initialize the debug helper
    debugHelper = DebugTestHelper.getInstance({
      timeout: 30000,
      retryCount: 5,
      sleepDuration: 1000,
    });
  }).timeout(60000);

  afterEach(async () => {
    // Clean up after tests
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
    // Focus the Image View panel — activating the tab triggers a re-render.
    await debugHelper.getWebviewEditor();
    await debugHelper.wait(500);
  }

  /**
   * Comprehensive test that tests all display options in a single debug session.
   * This is more reliable than running separate tests.
   */
  it('should test all display options', async () => {
    debugHelper.setCurrentTest('display-options');

    DebugTestHelper.logger.testStart('Testing all display options');

    // Setup debugging with the display options test file
    await debugHelper.setupEditorForDebug({
      fileName: fileInWorkspace('display_options_test.py'),
      debugConfig: 'Python: Current File',
      openFile: true,
    });

    await debugHelper.startDebugging();
    await debugHelper.waitForBreakpoint();
    await debugHelper.wait(2000); // extra wait for extension to process debug state in CI

    await debugHelper.expandImageWatchSection();
    await debugHelper.collapseOtherDebugSections();

    // Explicitly trigger run-setup to ensure the extension detects variables
    // (important on first test run in CI where extension may still be initializing)
    await debugHelper.runSetup();
    await debugHelper.wait(1000);

    // ===== Test 1: RGB Channel Filters =====
    DebugTestHelper.logger.step('Testing RGB channel display options on rgb_gradient...');

    await viewVariable('rgb_gradient');

    // Test Red channel filter
    const redClicked = await clickDisplayOption(driver, 'Red Channel');
    if (redClicked) {
      DebugTestHelper.logger.success('Red channel filter applied');

      // Verify pixel rendering: left region (pure red) should remain red;
      // middle region (pure green) should become dark since its red content is zero.
      const capturedRed = await captureAnnotatedCanvas(driver, 'display-options-red-channel');
      if (capturedRed) {
        const { img: imgAfterRed, annotator: annotatorRed } = capturedRed;
        try {
          // After autocrop: left red band x≈0.0–0.43, middle green band x≈0.43–0.86.
          const leftAfterRed = sampleRegion(imgAfterRed, 0.05, 0.25, 0.35, 0.40);
          const middleAfterRed = sampleRegion(imgAfterRed, 0.48, 0.25, 0.35, 0.40);
          DebugTestHelper.logger.info(`Red filter — left: ${JSON.stringify(leftAfterRed)}, middle: ${JSON.stringify(middleAfterRed)}`);
          annotatorRed.record(0.05, 0.25, 0.35, 0.40, leftAfterRed, () => assertDominantChannel(leftAfterRed, 'r', 40, 'left region after red channel filter'), 'left-red');
          annotatorRed.record(0.48, 0.25, 0.35, 0.40, middleAfterRed, () => assertBrighterThan(leftAfterRed, middleAfterRed, 40, 'left/red brighter than middle/green after red filter'), 'middle-green-dark');
        }
        finally {
          await annotatorRed.saveHtml();
        }
      }
    }

    // Reset before next test
    {
      const resetOk = await clickDisplayOption(driver, 'Reset');
      if (!resetOk) {
        throw new Error('clickDisplayOption: Reset button not found — cannot guarantee clean state for next test');
      }
    }

    // Test Green channel filter
    const greenClicked = await clickDisplayOption(driver, 'Green Channel');
    if (greenClicked) {
      DebugTestHelper.logger.success('Green channel filter applied');
    }

    // Reset before next test
    {
      const resetOk = await clickDisplayOption(driver, 'Reset');
      if (!resetOk) {
        throw new Error('clickDisplayOption: Reset button not found — cannot guarantee clean state for next test');
      }
    }

    // Test Blue channel filter
    const blueClicked = await clickDisplayOption(driver, 'Blue Channel');
    if (blueClicked) {
      DebugTestHelper.logger.success('Blue channel filter applied');
    }

    // Reset and test Grayscale
    {
      const resetOk = await clickDisplayOption(driver, 'Reset');
      if (!resetOk) {
        throw new Error('clickDisplayOption: Reset button not found — cannot guarantee clean state for next test');
      }
    }
    await clickDisplayOption(driver, 'Grayscale');

    // ===== Test 2: Grayscale and Contrast Options =====
    DebugTestHelper.logger.step('Testing grayscale and contrast display options...');

    // View the grayscale gradient
    await viewVariable('grayscale');

    // Test Invert
    await clickDisplayOption(driver, 'Invert Colors');

    // Reset
    {
      const resetOk = await clickDisplayOption(driver, 'Reset');
      if (!resetOk) {
        throw new Error('clickDisplayOption: Reset button not found — cannot guarantee clean state for next test');
      }
    }

    // View the low contrast image
    await viewVariable('low_contrast');

    // Test High Contrast
    await clickDisplayOption(driver, 'High Contrast');

    // ===== Test 3: Heatmap and Segmentation Colormaps =====
    DebugTestHelper.logger.step('Testing heatmap and segmentation display options...');

    // View the heatmap image (float32 gaussian)
    await viewVariable('heatmap');

    // Test Heatmap colormap
    await clickDisplayOption(driver, 'Heatmap');

    // View the segmentation image
    await viewVariable('segmentation');

    // Test Segmentation colormap
    await clickDisplayOption(driver, 'Segmentation');

    // ===== Test 4: RGBA and BGR Options =====
    DebugTestHelper.logger.step('Testing RGBA and BGR display options...');

    // View the RGBA image
    await viewVariable('rgba');

    // Test Ignore Alpha
    await clickDisplayOption(driver, 'Ignore Alpha');

    // View the BGR test image — capture BEFORE swap for comparison
    await viewVariable('bgr_test');
    const capturedBefore = await captureAnnotatedCanvas(driver, 'display-options-bgr-before');

    // Test Swap RGB/BGR
    await clickDisplayOption(driver, 'Swap RGB/BGR');

    // Capture AFTER swap and verify channel swap if both captures succeeded.
    const capturedAfter = await captureAnnotatedCanvas(driver, 'display-options-bgr-after');
    if (capturedBefore) {
      const { img: imgBeforeBgr, annotator: annotatorBefore } = capturedBefore;
      try {
        if (!capturedAfter) {
          throw new Error('after-swap canvas capture returned null');
        }
        const { img: imgAfterBgr, annotator: annotatorAfter } = capturedAfter;
        try {
        // bgr_test right half (x≈0.64–0.86): channel[0]=255 displays as Red before
        // swap, and Blue after swap (BGR→RGB reinterpretation).
          const rightBefore = sampleRegion(imgBeforeBgr, 0.65, 0.25, 0.20, 0.40);
          const rightAfter = sampleRegion(imgAfterBgr, 0.65, 0.25, 0.20, 0.40);
          DebugTestHelper.logger.info(`BGR swap right half — before: ${JSON.stringify(rightBefore)}, after: ${JSON.stringify(rightAfter)}`);
          annotatorBefore.addRegion(0.65, 0.25, 0.20, 0.40, rightBefore, 'right-before-swap');
          annotatorAfter.record(0.65, 0.25, 0.20, 0.40, rightAfter, () => assertChannelSwapped(rightBefore, rightAfter, 'r', 'b', 40, 'right region after Swap RGB/BGR'), 'right-after-swap');
        }
        finally {
          await annotatorAfter.saveHtml();
        }
      }
      finally {
        await annotatorBefore.saveHtml();
      }
    }

    DebugTestHelper.logger.success('All display options tests completed');
  }).timeout(300000);
});
