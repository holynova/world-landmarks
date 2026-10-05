import { describe, expect, it } from 'vitest';
import { chooseVariantWidths, orientedDimensions } from '../scripts/image-pipeline';

describe('image pipeline decisions', () => {
  it('does not upscale and includes the source width exactly once', () => {
    expect(chooseVariantWidths(1200, [480, 768, 1200, 1920])).toEqual([480, 768, 1200]);
    expect(chooseVariantWidths(600, [480, 480, 768])).toEqual([480, 600]);
  });

  it('normalizes EXIF orientations that swap axes', () => {
    expect(orientedDimensions({ width: 400, height: 800, orientation: 6 } as never)).toEqual({ width: 800, height: 400 });
    expect(orientedDimensions({ width: 400, height: 800, orientation: 1 } as never)).toEqual({ width: 400, height: 800 });
  });
});
