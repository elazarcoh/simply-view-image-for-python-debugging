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
 * Switch into the VS Code webview iframe all the way to the user HTML layer.
 *
 * VS Code webviews use a nested iframe structure. This function navigates to
 * the innermost frame containing the actual user HTML (Yew app, buttons, canvas).
 *
 * Returns true if successfully switched into the innermost user-content frame.
 */
export async function switchToWebviewFrame(driver: WebDriver): Promise<boolean> {
  try {
    // Dump top-level iframe structure for diagnostics.
    const topIframes = await driver.findElements(By.css('iframe'));
    DebugTestHelper.logger.debug(`switchToWebviewFrame: found ${topIframes.length} iframes at main level`);
    for (let i = 0; i < topIframes.length; i++) {
      const cls = await topIframes[i].getAttribute('class').catch(() => '?');
      const id = await topIframes[i].getAttribute('id').catch(() => '?');
      const name = await topIframes[i].getAttribute('name').catch(() => '?');
      const src = await topIframes[i].getAttribute('src').catch(() => '?');
      DebugTestHelper.logger.debug(`  iframe[${i}] class="${cls}" id="${id}" name="${name}" src="${(src ?? '').slice(0, 60)}"`);
    }

    // Step 1: Switch to the outer webview iframe (class includes "webview").
    let outerSwitched = false;
    for (const iframe of topIframes) {
      try {
        const className = await iframe.getAttribute('class');
        if (className && className.includes('webview')) {
          await driver.switchTo().frame(iframe);
          outerSwitched = true;
          DebugTestHelper.logger.debug('switchToWebviewFrame: switched into outer webview iframe');
          break;
        }
      }
      catch {
        // Try the next iframe
      }
    }

    if (!outerSwitched) {
      DebugTestHelper.logger.warn('switchToWebviewFrame: no outer webview iframe found');
      return false;
    }

    // Step 2: Find nested iframes inside the outer frame and switch to the
    // first one (the vscode-webview:// content host). Wait up to 8 s for it.
    let level2Frame = null;
    for (let attempt = 0; attempt < 16; attempt++) {
      const nested = await driver.findElements(By.css('iframe'));
      if (nested.length > 0) {
        level2Frame = nested[0];
        DebugTestHelper.logger.debug(`switchToWebviewFrame: level-2 iframe found after ${attempt * 500}ms`);
        break;
      }
      await driver.sleep(500);
    }

    if (!level2Frame) {
      DebugTestHelper.logger.debug('switchToWebviewFrame: no level-2 iframe; using outer frame');
      return true;
    }

    // Log level-2 iframe attributes for diagnostics.
    const l2cls = await level2Frame.getAttribute('class').catch(() => '?');
    const l2id = await level2Frame.getAttribute('id').catch(() => '?');
    const l2name = await level2Frame.getAttribute('name').catch(() => '?');
    DebugTestHelper.logger.debug(`  level-2 iframe: class="${l2cls}" id="${l2id}" name="${l2name}"`);

    await driver.switchTo().frame(level2Frame);
    DebugTestHelper.logger.debug('switchToWebviewFrame: switched to level-2 iframe');

    // Dump iframes inside level-2 for diagnostics.
    const l3iframes = await driver.findElements(By.css('iframe')).catch(() => []);
    DebugTestHelper.logger.debug(`switchToWebviewFrame: found ${l3iframes.length} iframes inside level-2`);
    for (let i = 0; i < l3iframes.length; i++) {
      const cls = await l3iframes[i].getAttribute('class').catch(() => '?');
      const id = await l3iframes[i].getAttribute('id').catch(() => '?');
      const name = await l3iframes[i].getAttribute('name').catch(() => '?');
      DebugTestHelper.logger.debug(`  level-2 child iframe[${i}] class="${cls}" id="${id}" name="${name}"`);
    }

    // Step 3: Try to switch into #active-frame (or whatever the innermost frame is).
    // #active-frame is the id used by older VS Code versions. Check all child iframes.
    if (l3iframes.length > 0) {
      // Look for #active-frame first; fall back to first iframe found.
      let foundActiveFrame = false;
      for (const f of l3iframes) {
        const id = await f.getAttribute('id').catch(() => '');
        if (id === 'active-frame') {
          await driver.switchTo().frame(f);
          DebugTestHelper.logger.debug('switchToWebviewFrame: switched to #active-frame by id');
          foundActiveFrame = true;
          break;
        }
      }

      if (!foundActiveFrame) {
        // Fall back to the first child iframe.
        await driver.switchTo().frame(l3iframes[0]);
        const fid = await l3iframes[0].getAttribute('id').catch(() => '?');
        const fname = await l3iframes[0].getAttribute('name').catch(() => '?');
        DebugTestHelper.logger.debug(`switchToWebviewFrame: switched to first level-3 iframe (id="${fid}" name="${fname}")`);
      }
    }
    else {
      DebugTestHelper.logger.debug('switchToWebviewFrame: no level-3 iframes; staying at level-2');
    }

    return true;
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
    // Dispatch a resize event to force the WebGL renderer to re-render the canvas.
    // Without this, the canvas backbuffer may have been cleared since the last render
    // (WebGL default: preserveDrawingBuffer=false), resulting in a blank capture.
    await driver.executeScript('window.dispatchEvent(new Event(\'resize\'))');
    await driver.sleep(400);

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
    DebugTestHelper.logger.info(`captureCanvasImage: ${img.width}×${img.height}`);
    return img;
  }
  finally {
    await driver.switchTo().defaultContent();
  }
}

/**
 * Poll the canvas until it shows a rendered image (i.e. any sampled point has
 * luminance above `minLuminance`). Returns true if the canvas became active
 * before `timeoutMs`, false on timeout.
 *
 * This is needed because the extension sends image data to the webview
 * asynchronously after "View Image" is clicked. The canvas stays dark
 * (~lum 13) until the first render completes.
 *
 * Samples only the central band of the canvas (y=35–65%, x=15–85%) to avoid
 * VS Code toolbar/button chrome that may be visible at the canvas edges in the
 * element screenshot. These toolbar pixels can produce a false-positive
 * luminance value (~44) on an otherwise dark canvas.
 */
export async function waitForCanvasToRender(
  driver: WebDriver,
  timeoutMs = 15000,
  minLuminance = 30,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const img = await captureCanvasImage(driver);
    if (img !== null) {
      // Sample from the render area only (x > 0.50), which is right of the
      // Image Watch sidebar that occupies the left ~44% of the canvas screenshot.
      // Sampling the sidebar would give false-positive luminance from variable
      // name text even when no image has been rendered yet.
      const points = [
        sampleRegion(img, 0.50, 0.35, 0.14, 0.30), // left portion of render area
        sampleRegion(img, 0.65, 0.35, 0.14, 0.30), // centre of render area
        sampleRegion(img, 0.82, 0.35, 0.14, 0.30), // right portion of render area
      ];
      const maxLum = Math.max(...points.map(luminance));
      DebugTestHelper.logger.debug(
        `waitForCanvasToRender: maxLum=${maxLum.toFixed(1)} `
        + `(L=${luminance(points[0]).toFixed(1)} C=${luminance(points[1]).toFixed(1)} R=${luminance(points[2]).toFixed(1)})`,
      );
      if (maxLum > minLuminance) {
        return true;
      }
    }
    await driver.sleep(800);
  }
  DebugTestHelper.logger.warn(`waitForCanvasToRender: timed out after ${timeoutMs}ms — canvas still dark`);
  return false;
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
  const selectors = [
    `button[aria-label="${buttonLabel}"]`,
    `button[title="${buttonLabel}"]`,
    `[aria-label="${buttonLabel}"]`,
    `[title="${buttonLabel}"]`,
  ];

  // Retry a few times to handle webview render delays.
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const switched = await switchToWebviewFrame(driver);
    if (!switched) {
      DebugTestHelper.logger.warn(`clickDisplayOption: could not switch to webview iframe for "${buttonLabel}" (attempt ${attempt})`);
      await driver.sleep(500);
      continue;
    }

    try {
      for (const selector of selectors) {
        const elements = await driver.findElements(By.css(selector));
        if (elements.length > 0) {
          // Use JS click to bypass coordinate-based interception by Monaco panel sashes.
          await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', elements[0]);
          await driver.executeScript('arguments[0].click()', elements[0]);
          DebugTestHelper.logger.debug(`clickDisplayOption: clicked "${buttonLabel}" via "${selector}" (attempt ${attempt})`);
          await driver.sleep(postClickMs);
          return true;
        }
      }

      DebugTestHelper.logger.warn(`clickDisplayOption: button "${buttonLabel}" not found (attempt ${attempt}/${maxAttempts})`);
    }
    finally {
      await driver.switchTo().defaultContent();
    }

    if (attempt < maxAttempts) {
      await driver.sleep(600);
    }
  }

  DebugTestHelper.logger.warn(`clickDisplayOption: button "${buttonLabel}" not found after ${maxAttempts} attempts`);
  return false;
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
