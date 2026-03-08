/**
 * Image verification utilities for e2e tests.
 *
 * Provides canvas pixel extraction and approximate color comparison
 * for verifying that images are rendered correctly in the webview.
 *
 * Pixel extraction uses WebDriver's element screenshot API, which captures
 * the composited screen output. This works without `preserveDrawingBuffer`
 * on the WebGL context, so no production code changes are required.
 */

import type { WebDriver } from 'vscode-extension-tester';
import { Buffer } from 'node:buffer';
import { intToRGBA, Jimp } from 'jimp';
import { By } from 'selenium-webdriver';
import { DebugTestHelper } from './DebugTestHelper';

/** The instance type returned by Jimp.fromBuffer / Jimp.read. */
type JimpImg = Awaited<ReturnType<typeof Jimp.fromBuffer>>;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type Channel = 'r' | 'g' | 'b';

/**
 * Switch into the VS Code webview iframe (handles both levels used by VS Code webviews).
 * Returns true if successfully switched into the inner webview content frame.
 */
async function switchToWebviewFrame(driver: WebDriver): Promise<boolean> {
  try {
    const iframes = await driver.findElements(By.css('iframe'));
    DebugTestHelper.logger.debug(`switchToWebviewFrame: found ${iframes.length} iframes`);

    for (const iframe of iframes) {
      try {
        const className = await iframe.getAttribute('class');
        if (className && className.includes('webview')) {
          await driver.switchTo().frame(iframe);

          // VS Code webviews have a second nested iframe
          const nestedIframes = await driver.findElements(By.css('iframe'));
          if (nestedIframes.length > 0) {
            await driver.switchTo().frame(nestedIframes[0]);
          }

          DebugTestHelper.logger.debug('switchToWebviewFrame: switched to webview iframe');
          return true;
        }
      }
      catch {
        // Try the next iframe
      }
    }

    DebugTestHelper.logger.warn('switchToWebviewFrame: no webview iframe found');
    return false;
  }
  catch (error) {
    DebugTestHelper.logger.warn(`switchToWebviewFrame: error — ${error}`);
    return false;
  }
}

/**
 * Capture the rendered canvas (`#gl-canvas`) as a decoded Jimp image.
 *
 * Uses WebDriver element screenshot, which captures the composited screen
 * output — no need for `preserveDrawingBuffer` on the WebGL context.
 *
 * Returns null if the canvas could not be found or the screenshot failed.
 */
export async function captureCanvasImage(driver: WebDriver): Promise<JimpImg | null> {
  const switched = await switchToWebviewFrame(driver);
  if (!switched) {
    DebugTestHelper.logger.warn('captureCanvasImage: could not switch to webview iframe');
    return null;
  }

  try {
    const canvasElements = await driver.findElements(By.css('#gl-canvas'));
    if (canvasElements.length === 0) {
      DebugTestHelper.logger.warn('captureCanvasImage: #gl-canvas not found');
      return null;
    }

    const base64 = await canvasElements[0].takeScreenshot();
    if (!base64) {
      DebugTestHelper.logger.warn('captureCanvasImage: empty screenshot returned');
      return null;
    }

    const img = await Jimp.fromBuffer(Buffer.from(base64, 'base64'));
    DebugTestHelper.logger.debug(`captureCanvasImage: captured ${img.width}×${img.height} canvas`);
    return img;
  }
  finally {
    await driver.switchTo().defaultContent();
  }
}

/**
 * Sample the mean R/G/B color of a rectangular region.
 * Coordinates are in relative units (0.0–1.0) so the result is scale-independent.
 */
export function sampleRegion(
  img: JimpImg,
  relX: number,
  relY: number,
  relW: number,
  relH: number,
): RgbColor {
  const x = Math.round(relX * img.width);
  const y = Math.round(relY * img.height);
  const w = Math.max(1, Math.round(relW * img.width));
  const h = Math.max(1, Math.round(relH * img.height));

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let px = x; px < Math.min(x + w, img.width); px++) {
    for (let py = y; py < Math.min(y + h, img.height); py++) {
      const rgba = intToRGBA(img.getPixelColor(px, py));
      r += rgba.r;
      g += rgba.g;
      b += rgba.b;
      count++;
    }
  }

  if (count === 0) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * Sample the mean color around a point using a square neighbourhood.
 * Both point position and radius are in relative coordinates (0.0–1.0).
 */
export function samplePoint(
  img: JimpImg,
  relX: number,
  relY: number,
  relRadius: number = 0.05,
): RgbColor {
  return sampleRegion(
    img,
    relX - relRadius,
    relY - relRadius,
    relRadius * 2,
    relRadius * 2,
  );
}

/**
 * Compute perceptual luminance (0–255) from an RGB color.
 */
export function luminance(color: RgbColor): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * Assert that `channel` is the dominant color channel in `color`.
 * `margin` is the minimum amount by which the dominant channel must exceed all others.
 */
export function assertDominantChannel(
  color: RgbColor,
  channel: Channel,
  margin: number = 40,
  context: string = '',
): void {
  const values: Record<Channel, number> = { r: color.r, g: color.g, b: color.b };
  const dominant = values[channel];
  const others = (['r', 'g', 'b'] as Channel[])
    .filter(c => c !== channel)
    .map(c => values[c]);
  const maxOther = Math.max(...others);

  if (dominant - maxOther < margin) {
    throw new Error(
      `Expected channel '${channel}' to dominate by ≥${margin}, `
      + `but got ${channel}=${dominant.toFixed(1)}, maxOther=${maxOther.toFixed(1)} `
      + `in color ${JSON.stringify(color)}${
        context ? ` [${context}]` : ''}`,
    );
  }
}

/**
 * Assert that `colorA` is significantly brighter than `colorB`.
 * `margin` is the minimum luminance difference required.
 */
export function assertBrighterThan(
  colorA: RgbColor,
  colorB: RgbColor,
  margin: number = 30,
  context: string = '',
): void {
  const lumA = luminance(colorA);
  const lumB = luminance(colorB);

  if (lumA - lumB < margin) {
    throw new Error(
      `Expected colorA to be brighter than colorB by ≥${margin}, `
      + `but lumA=${lumA.toFixed(1)}, lumB=${lumB.toFixed(1)}${
        context ? ` [${context}]` : ''}`,
    );
  }
}

/**
 * Assert that all RGB channels are approximately equal (grayscale-like rendering).
 * `tolerance` is the max allowed difference between any two channels.
 */
export function assertGrayscale(
  color: RgbColor,
  tolerance: number = 20,
  context: string = '',
): void {
  const maxDiff = Math.max(
    Math.abs(color.r - color.g),
    Math.abs(color.r - color.b),
    Math.abs(color.g - color.b),
  );

  if (maxDiff > tolerance) {
    throw new Error(
      `Expected grayscale (all channels within ±${tolerance} of each other), `
      + `but got ${JSON.stringify(color)}, max channel diff=${maxDiff.toFixed(1)}${
        context ? ` [${context}]` : ''}`,
    );
  }
}

/**
 * Assert that channels `ch1` and `ch2` were swapped between two captures.
 *
 * For example, `assertChannelSwapped(before, after, 'r', 'b')` verifies a BGR↔RGB swap:
 * the region that was R-dominant before should be B-dominant after, and vice versa.
 */
export function assertChannelSwapped(
  beforeColor: RgbColor,
  afterColor: RgbColor,
  ch1: Channel,
  ch2: Channel,
  margin: number = 30,
  context: string = '',
): void {
  const before1 = beforeColor[ch1];
  const before2 = beforeColor[ch2];
  const after1 = afterColor[ch1];
  const after2 = afterColor[ch2];

  if (before1 - before2 < margin) {
    throw new Error(
      `assertChannelSwapped: expected ${ch1}>${ch2} in BEFORE capture (by ≥${margin}), `
      + `but ${ch1}=${before1.toFixed(1)}, ${ch2}=${before2.toFixed(1)}${
        context ? ` [${context}]` : ''}`,
    );
  }
  if (after2 - after1 < margin) {
    throw new Error(
      `assertChannelSwapped: expected ${ch2}>${ch1} in AFTER capture (by ≥${margin}), `
      + `but ${ch1}=${after1.toFixed(1)}, ${ch2}=${after2.toFixed(1)}${
        context ? ` [${context}]` : ''}`,
    );
  }
}

/**
 * Switch to the webview iframe, click a display option button by its aria-label or title,
 * then switch back to the main content. Returns true if the button was clicked.
 *
 * Wait `postClickMs` ms after clicking to allow the WebGL canvas to re-render.
 */
export async function clickDisplayOption(
  driver: WebDriver,
  buttonLabel: string,
  postClickMs: number = 600,
): Promise<boolean> {
  const switched = await switchToWebviewFrame(driver);
  if (!switched) {
    DebugTestHelper.logger.warn(`clickDisplayOption: could not switch to webview iframe for "${buttonLabel}"`);
    return false;
  }

  try {
    const selectors = [
      `button[aria-label="${buttonLabel}"]`,
      `button[title="${buttonLabel}"]`,
      `[aria-label="${buttonLabel}"]`,
      `[title="${buttonLabel}"]`,
    ];

    for (const selector of selectors) {
      const elements = await driver.findElements(By.css(selector));
      if (elements.length > 0) {
        await elements[0].click();
        DebugTestHelper.logger.debug(`clickDisplayOption: clicked "${buttonLabel}" via "${selector}"`);
        await driver.sleep(postClickMs);
        return true;
      }
    }

    DebugTestHelper.logger.warn(`clickDisplayOption: button "${buttonLabel}" not found`);
    return false;
  }
  finally {
    await driver.switchTo().defaultContent();
  }
}

/**
 * Assert that two colors are approximately equal (per-channel absolute distance ≤ tolerance).
 */
export function assertApproxColor(
  actual: RgbColor,
  expected: RgbColor,
  tolerance: number = 30,
  context: string = '',
): void {
  const dr = Math.abs(actual.r - expected.r);
  const dg = Math.abs(actual.g - expected.g);
  const db = Math.abs(actual.b - expected.b);

  if (dr > tolerance || dg > tolerance || db > tolerance) {
    throw new Error(
      `Color mismatch (tolerance ±${tolerance}): `
      + `actual=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)}, `
      + `deltas=(Δr=${dr}, Δg=${dg}, Δb=${db})${
        context ? ` [${context}]` : ''}`,
    );
  }
}
