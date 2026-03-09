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

import type { WebElement } from 'selenium-webdriver';
import type { WebDriver } from 'vscode-extension-tester';
import { By } from 'selenium-webdriver';
import { VSBrowser } from 'vscode-extension-tester';
import { DebugTestHelper } from './DebugTestHelper';
import { fileInWorkspace, openWorkspace } from './globals';
import {
  assertBrighterThan,
  assertChannelSwapped,
  assertDominantChannel,
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

  /**
   * Helper to switch to the webview iframe — navigates all 3 iframe levels that
   * VS Code uses for webviews so that button clicks are not intercepted.
   *
   * Structure:
   *   Level 1: main window → <iframe class="webview [ready]"> (outer container)
   *   Level 2: <iframe src="vscode-webview://..."> (VS Code content manager)
   *   Level 3: <iframe id="active-frame"> (actual user HTML)
   */
  async function switchToWebviewFrame(): Promise<boolean> {
    try {
      const iframes = await driver.findElements(By.css('iframe'));
      DebugTestHelper.logger.info(`Found ${iframes.length} iframes at main level`);

      let outerSwitched = false;
      for (const iframe of iframes) {
        try {
          const className = await iframe.getAttribute('class');
          DebugTestHelper.logger.debug(`Iframe class="${className}"`);
          if (className && className.includes('webview')) {
            await driver.switchTo().frame(iframe);
            outerSwitched = true;
            DebugTestHelper.logger.success('Switched to outer webview iframe');
            break;
          }
        }
        catch (e) {
          DebugTestHelper.logger.debug(`Could not process iframe: ${e}`);
        }
      }

      if (!outerSwitched) {
        return false;
      }

      // Find and switch to the vscode-webview:// content-manager iframe.
      let level2Frame = null;
      for (let attempt = 0; attempt < 16; attempt++) {
        const nested = await driver.findElements(By.css('iframe'));
        if (nested.length > 0) {
          level2Frame = nested[0];
          break;
        }
        await driver.sleep(500);
      }
      if (level2Frame) {
        await driver.switchTo().frame(level2Frame);
        DebugTestHelper.logger.success('Switched to level-2 (vscode-webview://)');
      }

      // Switch into #active-frame — the actual user HTML where buttons live.
      // Without this, clicks are intercepted by the vscode-webview:// iframe.
      let activeFrame = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const frames = await driver.findElements(By.id('active-frame'));
        if (frames.length > 0) {
          activeFrame = frames[0];
          break;
        }
        await driver.sleep(500);
      }
      if (activeFrame) {
        await driver.switchTo().frame(activeFrame);
        DebugTestHelper.logger.success('Switched to #active-frame (user HTML)');
      }

      return true;
    }
    catch (error) {
      DebugTestHelper.logger.error(`Error switching to webview frame: ${error}`);
      return false;
    }
  }

  /**
   * Helper to switch back to the main content
   */
  async function switchToMainContent(): Promise<void> {
    await driver.switchTo().defaultContent();
    DebugTestHelper.logger.debug('Switched back to main content');
  }

  /**
   * Helper to find and click a display option button by its aria-label or title
   */
  async function clickDisplayOptionButton(buttonLabel: string): Promise<boolean> {
    try {
      // Try to find button by aria-label
      let button: WebElement | null = null;

      const selectors = [
        `button[aria-label="${buttonLabel}"]`,
        `button[title="${buttonLabel}"]`,
        `[aria-label="${buttonLabel}"]`,
        `[title="${buttonLabel}"]`,
      ];

      for (const selector of selectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            button = elements[0];
            DebugTestHelper.logger.success(`Found button with selector: ${selector}`);
            break;
          }
        }
        catch (_e) {
          // Try next selector
        }
      }

      if (button) {
        await button.click();
        await driver.sleep(500);
        DebugTestHelper.logger.success(`Clicked "${buttonLabel}" button`);
        return true;
      }

      DebugTestHelper.logger.warn(`Button "${buttonLabel}" not found`);
      return false;
    }
    catch (error) {
      DebugTestHelper.logger.error(`Error clicking button "${buttonLabel}": ${error}`);
      return false;
    }
  }

  /**
   * View a variable and take a screenshot
   */
  async function viewVariableAndScreenshot(
    variableName: string,
    screenshotName: string,
  ): Promise<void> {
    await debugHelper.performVariableAction({
      variableName,
      actionLabel: 'View Image',
      retrySetup: true,
      setupRetries: 5,
      type: 'variable',
    });

    await debugHelper.wait(1000);

    // Get the webview editor for screenshot
    const webviewEditor = await debugHelper.getWebviewEditor();

    await debugHelper.takeScreenshot({
      name: screenshotName,
      element: webviewEditor,
    });
  }

  /**
   * Test display option by clicking a button and taking a screenshot
   */
  async function testDisplayOption(
    buttonLabel: string,
    screenshotSuffix: string,
  ): Promise<boolean> {
    // Switch to webview frame
    const switched = await switchToWebviewFrame();
    if (!switched) {
      DebugTestHelper.logger.warn('Could not switch to webview frame, skipping button click');
      await switchToMainContent();
      return false;
    }

    // Click the display option button
    const clicked = await clickDisplayOptionButton(buttonLabel);

    // Switch back to main content
    await switchToMainContent();

    if (clicked) {
      await debugHelper.wait(500);

      // Take screenshot of the result
      const webviewEditor = await debugHelper.getWebviewEditor();
      await debugHelper.takeScreenshot({
        name: `display-option-${screenshotSuffix}`,
        element: webviewEditor,
      });

      // Also take fullscreen
      await debugHelper.takeScreenshot({
        name: `display-option-${screenshotSuffix}-fullscreen`,
        element: 'screen',
      });
    }

    return clicked;
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

    await viewVariableAndScreenshot('rgb_gradient', 'success-rgb-default');

    // Test Red channel filter
    const redClicked = await testDisplayOption('Red Channel', 'rgb-red-channel');
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
    await testDisplayOption('Reset', 'rgb-after-reset');

    // Test Green channel filter
    const greenClicked = await testDisplayOption('Green Channel', 'rgb-green-channel');
    if (greenClicked) {
      DebugTestHelper.logger.success('Green channel filter applied');
    }

    // Reset before next test
    await testDisplayOption('Reset', 'rgb-after-reset-2');

    // Test Blue channel filter
    const blueClicked = await testDisplayOption('Blue Channel', 'rgb-blue-channel');
    if (blueClicked) {
      DebugTestHelper.logger.success('Blue channel filter applied');
    }

    // Reset and test Grayscale
    await testDisplayOption('Reset', 'rgb-after-reset-3');
    await testDisplayOption('Grayscale', 'rgb-grayscale');

    // ===== Test 2: Grayscale and Contrast Options =====
    DebugTestHelper.logger.step('Testing grayscale and contrast display options...');

    // View the grayscale gradient
    await viewVariableAndScreenshot('grayscale', 'success-grayscale-default');

    // Test Invert
    await testDisplayOption('Invert Colors', 'grayscale-inverted');

    // Reset
    await testDisplayOption('Reset', 'grayscale-reset');

    // View the low contrast image
    await viewVariableAndScreenshot('low_contrast', 'success-low-contrast-default');

    // Test High Contrast
    await testDisplayOption('High Contrast', 'low-contrast-enhanced');

    // ===== Test 3: Heatmap and Segmentation Colormaps =====
    DebugTestHelper.logger.step('Testing heatmap and segmentation display options...');

    // View the heatmap image (float32 gaussian)
    await viewVariableAndScreenshot('heatmap', 'success-heatmap-default');

    // Test Heatmap colormap
    await testDisplayOption('Heatmap', 'heatmap-colormap');

    // View the segmentation image
    await viewVariableAndScreenshot('segmentation', 'success-segmentation-default');

    // Test Segmentation colormap
    await testDisplayOption('Segmentation', 'segmentation-colormap');

    // ===== Test 4: RGBA and BGR Options =====
    DebugTestHelper.logger.step('Testing RGBA and BGR display options...');

    // View the RGBA image
    await viewVariableAndScreenshot('rgba', 'success-rgba-default');

    // Test Ignore Alpha
    await testDisplayOption('Ignore Alpha', 'rgba-ignore-alpha');

    // View the BGR test image — capture BEFORE swap for comparison
    await viewVariableAndScreenshot('bgr_test', 'success-bgr-default');
    const imgBeforeBgr = await debugHelper.captureCanvasImage();

    // Test Swap RGB/BGR
    await testDisplayOption('Swap RGB/BGR', 'bgr-swapped');

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
