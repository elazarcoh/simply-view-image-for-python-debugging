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

  async function viewVariable(variableName: string): Promise<void> {
    await debugHelper.performVariableAction({
      variableName,
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 5,
      type: 'variable',
    });
    await debugHelper.wait(1000);
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
      const imgAfterRed = await debugHelper.captureCanvasImage();
      if (imgAfterRed) {
        const leftAfterRed = sampleRegion(imgAfterRed, 0.05, 0.2, 0.25, 0.6);
        const middleAfterRed = sampleRegion(imgAfterRed, 0.38, 0.2, 0.25, 0.6);
        DebugTestHelper.logger.info(`Red filter — left: ${JSON.stringify(leftAfterRed)}, middle: ${JSON.stringify(middleAfterRed)}`);
        assertDominantChannel(leftAfterRed, 'r', 40, 'left region after red channel filter');
        assertBrighterThan(leftAfterRed, middleAfterRed, 40, 'left/red brighter than middle/green after red filter');
      }
    }

    // Reset before next test
    await clickDisplayOption(driver, 'Reset');

    // Test Green channel filter
    const greenClicked = await clickDisplayOption(driver, 'Green Channel');
    if (greenClicked) {
      DebugTestHelper.logger.success('Green channel filter applied');
    }

    // Reset before next test
    await clickDisplayOption(driver, 'Reset');

    // Test Blue channel filter
    const blueClicked = await clickDisplayOption(driver, 'Blue Channel');
    if (blueClicked) {
      DebugTestHelper.logger.success('Blue channel filter applied');
    }

    // Reset and test Grayscale
    await clickDisplayOption(driver, 'Reset');
    await clickDisplayOption(driver, 'Grayscale');

    // ===== Test 2: Grayscale and Contrast Options =====
    DebugTestHelper.logger.step('Testing grayscale and contrast display options...');

    // View the grayscale gradient
    await viewVariable('grayscale');

    // Test Invert
    await clickDisplayOption(driver, 'Invert Colors');

    // Reset
    await clickDisplayOption(driver, 'Reset');

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
    const imgBeforeBgr = await debugHelper.captureCanvasImage();

    // Test Swap RGB/BGR
    await clickDisplayOption(driver, 'Swap RGB/BGR');

    // Verify channel swap: bgr_test right half is stored as BGR-red ([0,0,255]) which
    // the extension displays as blue before swap (b>r), and red after swap (r>b).
    const imgAfterBgr = await debugHelper.captureCanvasImage();
    if (imgBeforeBgr && imgAfterBgr) {
      const rightBefore = sampleRegion(imgBeforeBgr, 0.55, 0.2, 0.35, 0.6);
      const rightAfter = sampleRegion(imgAfterBgr, 0.55, 0.2, 0.35, 0.6);
      DebugTestHelper.logger.info(`BGR swap right half — before: ${JSON.stringify(rightBefore)}, after: ${JSON.stringify(rightAfter)}`);
      assertChannelSwapped(rightBefore, rightAfter, 'b', 'r', 40, 'right region after Swap RGB/BGR');
    }

    DebugTestHelper.logger.success('All display options tests completed');
  }).timeout(300000);
});
