import { describe, expect, it } from 'vitest';
import { idForSlug, slugify, sourceSlug } from '../scripts/slug';

describe('stable image slugs', () => {
  it('keeps Chinese names while normalizing separators and accents', () => {
    expect(sourceSlug('旅行/春日 花园 01.JPG')).toBe('旅行-春日-花园-01');
    expect(slugify('Café & Sun')).toBe('cafe-sun');
  });

  it('provides stable IDs from slugs', () => {
    expect(idForSlug('旅行-春日')).toBe('image-旅行-春日');
    expect(slugify('---')).toBe('image');
  });
});
