import { describe, it, expect } from 'vitest';
import { haversineDistance, formatPriceCents, slugify } from '../utils';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance({ lat: 40.7128, lng: -74.006 }, { lat: 40.7128, lng: -74.006 })).toBe(0);
  });

  it('computes approximate distance between NYC and LA (~3940 km)', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const dist = haversineDistance(nyc, la);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it('computes distance across the equator correctly', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 1 };
    // ~111 km per degree of longitude at equator
    const dist = haversineDistance(a, b);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(113);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5074, lng: -0.1278 }; // London
    const b = { lat: 48.8566, lng: 2.3522 }; // Paris
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 5);
  });
});

describe('formatPriceCents', () => {
  it('formats zero cents', () => {
    expect(formatPriceCents(0)).toBe('$0.00');
  });

  it('formats whole dollar amounts', () => {
    expect(formatPriceCents(100)).toBe('$1.00');
    expect(formatPriceCents(5000)).toBe('$50.00');
  });

  it('formats fractional cents correctly', () => {
    expect(formatPriceCents(199)).toBe('$1.99');
    expect(formatPriceCents(9999)).toBe('$99.99');
  });

  it('formats large amounts', () => {
    expect(formatPriceCents(100000)).toBe('$1,000.00');
  });
});

describe('slugify', () => {
  it('lowercases and trims', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('Pebble Beach Golf')).toBe('pebble-beach-golf');
  });

  it('removes special characters', () => {
    expect(slugify("St. Andrew's Links!")).toBe('st-andrews-links');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('Augusta---National')).toBe('augusta-national');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---course---')).toBe('course');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles already-slugified input', () => {
    expect(slugify('oak-valley-links')).toBe('oak-valley-links');
  });
});
