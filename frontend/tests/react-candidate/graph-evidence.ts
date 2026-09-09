import { expect, type Page, type TestInfo } from '@playwright/test';
import { screenshotEvidence } from './browser-evidence';

export const screenshotGraphEvidence = async (page: Page, info: TestInfo, name: string): Promise<void> => {
  const canvas = page.getByTestId('workspace-graph').locator('canvas');
  await expect(canvas).toHaveAttribute('aria-busy', 'false');
  await screenshotEvidence(page, info, name);
  const screenshot = await canvas.screenshot();
  // Check the delivered screenshot itself: DOM visibility and a completed
  // render callback alone do not prove that WebGL reached the captured raster.
  const coloredPixels = await page.evaluate(async encoded => {
    const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const surface = document.createElement('canvas');
    surface.width = bitmap.width; surface.height = bitmap.height;
    const context = surface.getContext('2d');
    if (!context) throw new Error('GRAPH_EVIDENCE_IMAGE_CONTEXT_REQUIRED');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index]!, green = pixels[index + 1]!, blue = pixels[index + 2]!;
      const blueEntity = blue > 90 && blue > red * 1.5 && blue > green * 1.1;
      const cyanEntity = green > 90 && blue > 90 && green > red * 1.5 && blue > red * 1.5;
      if (blueEntity || cyanEntity) count += 1;
    }
    return count;
  }, screenshot.toString('base64'));
  expect(coloredPixels, 'Graph screenshot must contain rendered Entity/Account/Jurisdiction pixels').toBeGreaterThan(20);
};
