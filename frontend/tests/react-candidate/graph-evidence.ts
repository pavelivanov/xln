import { expect, type Page, type TestInfo } from '@playwright/test';
import { screenshotEvidence } from './browser-evidence';

export const screenshotGraphEvidence = async (page: Page, info: TestInfo, name: string): Promise<void> => {
  const canvas = page.getByTestId('workspace-graph').locator('canvas');
  await expect(canvas).toHaveAttribute('aria-busy', 'false');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('GRAPH_EVIDENCE_CANVAS_BOUNDS_REQUIRED');
  const scrollY = await page.evaluate(() => window.scrollY);
  const screenshot = await screenshotEvidence(page, info, name);
  // Check the delivered screenshot itself: DOM visibility and a completed
  // render callback alone do not prove that WebGL reached the captured raster.
  const coloredPixels = await page.evaluate(async ({ encoded, bounds, scrollY }) => {
    const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const surface = document.createElement('canvas');
    surface.width = Math.round(bounds.width); surface.height = Math.round(bounds.height);
    const context = surface.getContext('2d');
    if (!context) throw new Error('GRAPH_EVIDENCE_IMAGE_CONTEXT_REQUIRED');
    context.drawImage(bitmap, bounds.x, bounds.y + scrollY, bounds.width, bounds.height, 0, 0, surface.width, surface.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 2]! > 90 && pixels[index + 2]! > pixels[index]! * 1.5 && pixels[index + 2]! > pixels[index + 1]! * 1.1) count += 1;
    }
    return count;
  }, { encoded: screenshot.toString('base64'), bounds, scrollY });
  expect(coloredPixels, 'Graph screenshot must contain rendered Entity/Account/Jurisdiction pixels').toBeGreaterThan(20);
};
