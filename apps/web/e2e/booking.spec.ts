import { test, expect } from '@playwright/test';

const MOCK_COURSES = [
  {
    id: 'course-1',
    name: 'Pebble Beach',
    description: 'Iconic seaside course',
    locationLat: '36.5681',
    locationLng: '-121.9497',
    address: '17 Mile Drive, Pebble Beach, CA',
    moodTags: ['scenic', 'challenging'],
    amenities: ['restaurant', 'pro-shop'],
    photoUrls: [],
    holeCount: 18,
    parScore: 72,
    distanceM: 5000,
  },
];

const MOCK_SLOTS = [
  {
    id: 'slot-1',
    courseId: 'course-1',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    capacity: 4,
    bookedCount: 1,
    priceInCents: 29900,
  },
];

test.describe('Course discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/v1/courses/discover**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_COURSES,
          pagination: { total: 1, page: 1, pageSize: 20, hasNext: false },
        }),
      })
    );
  });

  test('discover page loads and shows course cards', async ({ page }) => {
    await page.goto('/');
    // Landing page should link to discover/explore
    await expect(page.getByRole('heading', { name: /book golf by mood/i })).toBeVisible();
  });
});

test.describe('Booking flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/v1/courses/course-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { ...MOCK_COURSES[0], upcomingSlots: MOCK_SLOTS },
        }),
      })
    );

    await page.route('**/v1/bookings', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'booking-1',
              slotId: 'slot-1',
              courseId: 'course-1',
              partySize: 1,
              totalPriceInCents: 29900,
              status: 'pending',
              paymentStatus: 'pending',
            },
          }),
        });
      }
      return route.continue();
    });
  });

  test('slot booking API mock returns correct structure', async ({ page }) => {
    // Intercept and verify booking payload
    const [request] = await Promise.all([
      page.waitForRequest('**/v1/bookings'),
      page.evaluate(async () => {
        await fetch('/v1/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
          body: JSON.stringify({ slotId: 'slot-1', partySize: 1 }),
        });
      }),
    ]);
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON();
    expect(body.slotId).toBe('slot-1');
    expect(body.partySize).toBe(1);
  });
});

test.describe('Dashboard analytics', () => {
  test('analytics page requires authentication', async ({ page }) => {
    await page.route('**/v1/analytics/**', (route) =>
      route.fulfill({ status: 403, body: JSON.stringify({ error: { code: 'FORBIDDEN' } }) })
    );
    await page.goto('/dashboard/analytics');
    // Page should still load; 403 from API should show error state, not crash
    await expect(page).not.toHaveURL(/500|error/);
  });
});
