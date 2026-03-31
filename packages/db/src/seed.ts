/**
 * Seed script: 25 sample golf courses across the US with mood tags and geo coordinates.
 * Run with: pnpm --filter @teezy/db db:seed
 */

import { db, courses, teeTimeSlots } from './index';

const SAMPLE_COURSES = [
  {
    name: 'Pebble Beach Golf Links',
    description: 'World-famous coastal course with stunning Pacific Ocean views.',
    locationLat: '36.568600',
    locationLng: '-121.951900',
    address: '1700 17-Mile Drive, Pebble Beach, CA 93953',
    moodTags: ['challenging', 'scenic', 'advanced', 'competitive'],
    amenities: ['pro-shop', 'restaurant', 'caddie', 'cart-rental'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.pebblebeach.com',
  },
  {
    name: 'Augusta National Golf Club',
    description: 'Legendary course known for the Masters Tournament.',
    locationLat: '33.503000',
    locationLng: '-82.023600',
    address: '2604 Washington Road, Augusta, GA 30904',
    moodTags: ['competitive', 'advanced', 'challenging'],
    amenities: ['pro-shop', 'caddie', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: null,
  },
  {
    name: 'Torrey Pines Golf Course (South)',
    description: 'Municipal public course on the cliffs above the Pacific Ocean.',
    locationLat: '32.898600',
    locationLng: '-117.252400',
    address: '11480 N Torrey Pines Rd, La Jolla, CA 92037',
    moodTags: ['scenic', 'competitive', 'advanced', 'challenging'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.torreypinesgolfcourse.com',
  },
  {
    name: 'Bethpage Black Course',
    description: 'Public course that hosted the US Open twice. Notoriously difficult.',
    locationLat: '40.742400',
    locationLng: '-73.456700',
    address: '99 Quaker Meeting House Rd, Farmingdale, NY 11735',
    moodTags: ['challenging', 'competitive', 'advanced'],
    amenities: ['pro-shop', 'cart-rental'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://parks.ny.gov/golf',
  },
  {
    name: 'Bandon Dunes Golf Resort - Pacific Dunes',
    description: 'Walking-only links course on the Oregon coast.',
    locationLat: '43.121700',
    locationLng: '-124.449800',
    address: '57744 Round Lake Dr, Bandon, OR 97411',
    moodTags: ['scenic', 'challenging', 'competitive', 'advanced'],
    amenities: ['caddie', 'pro-shop', 'restaurant', 'lodge'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://www.bandondunesgolf.com',
  },
  {
    name: 'Whistling Straits (Straits Course)',
    description: 'Pete Dye masterpiece on the shores of Lake Michigan.',
    locationLat: '43.856700',
    locationLng: '-87.752400',
    address: 'W. 14697 County Road XO, Haven, WI 53083',
    moodTags: ['scenic', 'challenging', 'competitive', 'advanced'],
    amenities: ['caddie', 'pro-shop', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.americanclubresort.com',
  },
  {
    name: 'TPC Sawgrass (Stadium Course)',
    description: 'Home of The Players Championship. Features the iconic island green par-3 17th.',
    locationLat: '30.197500',
    locationLng: '-81.393000',
    address: '110 Championship Way, Ponte Vedra Beach, FL 32082',
    moodTags: ['competitive', 'challenging', 'advanced'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant', 'practice-range'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.tpc.com/sawgrass',
  },
  {
    name: 'Pinehurst No. 2',
    description: 'Donald Ross classic and multiple US Open host.',
    locationLat: '35.192500',
    locationLng: '-79.469400',
    address: '1 Carolina Vista Dr, Village of Pinehurst, NC 28374',
    moodTags: ['competitive', 'challenging', 'advanced'],
    amenities: ['caddie', 'pro-shop', 'restaurant', 'cart-rental'],
    holeCount: 18,
    parScore: 70,
    websiteUrl: 'https://www.pinehurst.com',
  },
  {
    name: 'Erin Hills Golf Course',
    description: 'Public links-style course that hosted the 2017 US Open.',
    locationLat: '43.175800',
    locationLng: '-88.353600',
    address: 'W6169 County Road O, Erin, WI 53027',
    moodTags: ['scenic', 'competitive', 'challenging'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.erinhills.com',
  },
  {
    name: 'Chambers Bay Golf Course',
    description: 'Links-style public course on Puget Sound. 2015 US Open host.',
    locationLat: '47.183900',
    locationLng: '-122.505800',
    address: '6320 Grandview Dr W, University Place, WA 98467',
    moodTags: ['scenic', 'competitive', 'challenging', 'advanced'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant', 'caddie'],
    holeCount: 18,
    parScore: 69,
    websiteUrl: 'https://www.chambersbaygolf.com',
  },
  {
    name: 'Streamsong Resort - Blue Course',
    description: 'Florida's most acclaimed modern course with rolling terrain.',
    locationLat: '27.751400',
    locationLng: '-81.863400',
    address: '1000 Streamsong Dr, Streamsong, FL 33834',
    moodTags: ['scenic', 'challenging', 'social'],
    amenities: ['caddie', 'pro-shop', 'restaurant', 'lodge'],
    holeCount: 18,
    parScore: 73,
    websiteUrl: 'https://www.streamsong.com',
  },
  {
    name: 'Cabot Cliffs',
    description: 'Perched atop the cliffs of Cape Breton, Nova Scotia.',
    locationLat: '46.670000',
    locationLng: '-61.340000',
    address: '84 Inverness Crt, Inverness, NS B0E 1N0, Canada',
    moodTags: ['scenic', 'challenging', 'advanced', 'competitive'],
    amenities: ['caddie', 'pro-shop', 'restaurant', 'lodge'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.cabotlinks.com',
  },
  {
    name: 'Sand Valley Golf Resort - Sand Valley Course',
    description: 'Coore & Crenshaw design in the Wisconsin sand barrens.',
    locationLat: '44.025000',
    locationLng: '-89.808300',
    address: 'W8214 County Rd G, Nekoosa, WI 54457',
    moodTags: ['scenic', 'relaxed', 'social', 'competitive'],
    amenities: ['pro-shop', 'restaurant', 'lodge', 'caddie'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.sandvalleygolfresort.com',
  },
  {
    name: 'Mossy Oak Golf Club',
    description: 'Scenic mountain course perfect for a relaxed round.',
    locationLat: '34.851400',
    locationLng: '-83.567200',
    address: '1 Cherokee Hills Drive, Cherokee, NC 28719',
    moodTags: ['scenic', 'relaxed', 'beginner', 'social'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: null,
  },
  {
    name: 'Buffalo Run Golf Course',
    description: 'Affordable municipal course with wide fairways, great for beginners.',
    locationLat: '39.770000',
    locationLng: '-104.890000',
    address: '15700 E 112th Ave, Commerce City, CO 80022',
    moodTags: ['beginner', 'relaxed', 'social', 'fast-paced'],
    amenities: ['pro-shop', 'cart-rental', 'snack-bar'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.buffalorun.golf',
  },
  {
    name: 'Topgolf Las Vegas',
    description: 'Multi-level driving range and entertainment venue at MGM Grand.',
    locationLat: '36.102400',
    locationLng: '-115.171200',
    address: '4627 Koval Ln, Las Vegas, NV 89109',
    moodTags: ['social', 'beginner', 'fast-paced', 'relaxed'],
    amenities: ['food-beverage', 'entertainment', 'lessons'],
    holeCount: 0,
    parScore: 0,
    websiteUrl: 'https://topgolf.com/us/las-vegas',
  },
  {
    name: 'Papago Golf Course',
    description: 'Popular Phoenix municipal course with stunning red rock backdrop.',
    locationLat: '33.467700',
    locationLng: '-111.938400',
    address: '5595 E Moreland St, Phoenix, AZ 85008',
    moodTags: ['scenic', 'relaxed', 'social', 'beginner'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://phoenix.gov/parks/golf',
  },
  {
    name: 'Bethel Woods Golf Course',
    description: 'Quiet countryside course ideal for a peaceful round with friends.',
    locationLat: '41.695400',
    locationLng: '-74.877600',
    address: '200 Hurd Road, Bethel, NY 12720',
    moodTags: ['scenic', 'relaxed', 'social'],
    amenities: ['cart-rental', 'snack-bar'],
    holeCount: 18,
    parScore: 70,
    websiteUrl: null,
  },
  {
    name: 'Pacific Grove Golf Links',
    description: 'Affordable public links course with ocean views on the Monterey Peninsula.',
    locationLat: '36.626500',
    locationLng: '-121.930300',
    address: '77 Asilomar Blvd, Pacific Grove, CA 93950',
    moodTags: ['scenic', 'relaxed', 'beginner', 'social'],
    amenities: ['pro-shop', 'cart-rental'],
    holeCount: 18,
    parScore: 70,
    websiteUrl: 'https://www.pggolflinks.com',
  },
  {
    name: 'Corica Park Golf Course (North)',
    description: 'Affordable Bay Area public course, great for quick rounds.',
    locationLat: '37.753900',
    locationLng: '-122.226200',
    address: '1 Clubhouse Memorial Rd, Alameda, CA 94502',
    moodTags: ['fast-paced', 'beginner', 'social', 'relaxed'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://www.coricapark.com',
  },
  {
    name: 'Jackson Park Golf Course',
    description: 'Historic Chicago public course redesigned by Tiger Woods Foundation.',
    locationLat: '41.783600',
    locationLng: '-87.582100',
    address: '63rd St & Stony Island Ave, Chicago, IL 60637',
    moodTags: ['social', 'beginner', 'relaxed', 'fast-paced'],
    amenities: ['pro-shop', 'cart-rental'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://www.cpdgolf.com/jackson-park',
  },
  {
    name: 'Rancho Park Golf Course',
    description: 'Beloved LA public course with a vintage feel in the heart of the city.',
    locationLat: '34.046600',
    locationLng: '-118.422500',
    address: '10460 W Pico Blvd, Los Angeles, CA 90064',
    moodTags: ['social', 'relaxed', 'beginner', 'fast-paced'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 71,
    websiteUrl: 'https://www.lacity.org/recreation/golf',
  },
  {
    name: 'Spyglass Hill Golf Course',
    description: 'Challenging Pebble Beach resort course through Del Monte Forest.',
    locationLat: '36.580300',
    locationLng: '-121.963600',
    address: 'Stevenson Drive, Pebble Beach, CA 93953',
    moodTags: ['scenic', 'challenging', 'competitive', 'advanced'],
    amenities: ['pro-shop', 'caddie', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.pebblebeach.com/golf/spyglass-hill',
  },
  {
    name: 'Bayou Oaks at City Park (South Course)',
    description: 'New Orleans public course nestled in historic City Park.',
    locationLat: '29.986600',
    locationLng: '-90.097200',
    address: '1 Friedrichs Ave, New Orleans, LA 70124',
    moodTags: ['social', 'relaxed', 'beginner'],
    amenities: ['pro-shop', 'cart-rental', 'restaurant'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.bayouoaksgolf.com',
  },
  {
    name: 'Cascata Golf Club',
    description: 'Exclusive private-feel course near Las Vegas with a 418-foot waterfall.',
    locationLat: '36.016700',
    locationLng: '-114.847700',
    address: '1 Cascata Dr, Boulder City, NV 89005',
    moodTags: ['scenic', 'competitive', 'advanced', 'challenging'],
    amenities: ['caddie', 'pro-shop', 'restaurant', 'practice-range'],
    holeCount: 18,
    parScore: 72,
    websiteUrl: 'https://www.cascata.com',
  },
];

async function seedCourses() {
  console.log('Seeding courses...');
  const inserted = await db
    .insert(courses)
    .values(
      SAMPLE_COURSES.map((c) => ({
        ...c,
        isActive: true,
      }))
    )
    .returning({ id: courses.id, name: courses.name });

  console.log(`Inserted ${inserted.length} courses`);
  return inserted;
}

async function seedTeeTimeSlots(insertedCourses: { id: string; name: string }[]) {
  console.log('Seeding tee time slots...');
  const slots = [];
  const now = new Date();

  for (const course of insertedCourses) {
    // Generate 8 slots per course across the next 7 days
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      for (const hour of [7, 9, 11, 13, 15, 17]) {
        const startsAt = new Date(now);
        startsAt.setDate(startsAt.getDate() + dayOffset);
        startsAt.setHours(hour, 0, 0, 0);

        slots.push({
          courseId: course.id,
          startsAt,
          capacity: 4,
          bookedCount: 0,
          priceInCents: Math.floor(Math.random() * 8000) + 2000, // $20–$100
        });
      }
    }
  }

  const inserted = await db.insert(teeTimeSlots).values(slots).returning({ id: teeTimeSlots.id });
  console.log(`Inserted ${inserted.length} tee time slots`);
}

async function main() {
  try {
    const insertedCourses = await seedCourses();
    await seedTeeTimeSlots(insertedCourses);
    console.log('Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
