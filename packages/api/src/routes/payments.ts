import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, bookings, courses } from '@par-tee/db';
import { authMiddleware } from '../middleware/auth';
import Stripe from 'stripe';

export const paymentsRouter = new Hono();

function getStripe(): Stripe {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  return new Stripe(key, { apiVersion: '2024-04-10' });
}

const onboardSchema = z.object({
  courseId: z.string().uuid(),
});

const paymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
});

// POST /v1/payments/connect/onboard — create Stripe Connect account link
paymentsRouter.post(
  '/connect/onboard',
  authMiddleware,
  zValidator('json', onboardSchema),
  async (c) => {
    const { courseId } = c.req.valid('json');
    const stripe = getStripe();

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
    }

    let stripeAccountId = course.stripeAccountId;

    // Create a new Connect account if none exists
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { courseId },
      });
      stripeAccountId = account.id;

      await db
        .update(courses)
        .set({ stripeAccountId, updatedAt: new Date() })
        .where(eq(courses.id, courseId));
    }

    const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${webUrl}/dashboard/connect?refresh=true`,
      return_url: `${webUrl}/dashboard/connect?success=true`,
      type: 'account_onboarding',
    });

    return c.json({ url: accountLink.url });
  }
);

// GET /v1/payments/connect/status/:courseId — check Connect status
paymentsRouter.get('/connect/status/:courseId', authMiddleware, async (c) => {
  const { courseId } = c.req.param();
  const stripe = getStripe();

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
  }

  if (!course.stripeAccountId) {
    return c.json({ data: { connected: false, detailsSubmitted: false } });
  }

  const account = await stripe.accounts.retrieve(course.stripeAccountId);

  return c.json({
    data: {
      connected: account.charges_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    },
  });
});

// POST /v1/payments/intent — create PaymentIntent for booking
paymentsRouter.post(
  '/intent',
  authMiddleware,
  zValidator('json', paymentIntentSchema),
  async (c) => {
    const { bookingId } = c.req.valid('json');
    const stripe = getStripe();

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);
    }

    // Get the course's Stripe account
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, booking.courseId))
      .limit(1);

    if (!course) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
    }

    // Tiered platform fee based on course's promotional tier
    const TIER_FEES: Record<string, number> = {
      founding:         150,
      tournament:       175,
      active_promotion: 200,
      basic_promotion:  225,
      standard:         275,
    };
    const platformFeeCents = TIER_FEES[course.pricingTier ?? 'standard'] ?? 275;
    const totalAmount = booking.totalPriceInCents + platformFeeCents;

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalAmount,
      currency: 'usd',
      metadata: { bookingId, courseId: booking.courseId },
    };

    // If course has a Stripe Connect account, route payment through it
    if (course.stripeAccountId) {
      intentParams.transfer_data = {
        destination: course.stripeAccountId,
        amount: booking.totalPriceInCents,
      };
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    // Store the payment intent ID on the booking
    await db
      .update(bookings)
      .set({ stripePaymentIntentId: intent.id, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    return c.json({ clientSecret: intent.client_secret });
  }
);

// POST /v1/payments/webhook — Stripe webhook handler
paymentsRouter.post('/webhook', async (c) => {
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' } }, 500);
  }

  const stripe = getStripe();
  const signature = c.req.header('Stripe-Signature');

  if (!signature) {
    return c.json({ error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe-Signature header' } }, 400);
  }

  let event: Stripe.Event;
  const rawBody = await c.req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return c.json({ error: { code: 'INVALID_SIGNATURE', message } }, 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata?.bookingId;

    if (bookingId) {
      await db
        .update(bookings)
        .set({
          paymentStatus: 'paid',
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(bookings.stripePaymentIntentId, intent.id));
    }
  }

  return c.json({ received: true });
});
