import { PriceRange, PrismaClient } from '@prisma/client';

export async function seedSampleRestaurants(prisma: PrismaClient) {
  // Check if sample restaurants already exist
  const existing = await prisma.restaurant.count();
  if (existing > 0) {
    return { count: existing, message: 'Restaurants already exist in database' };
  }

  // 1. Ensure cuisines exist
  const italian = await prisma.cuisine.upsert({
    where: { slug: 'italian' },
    update: {},
    create: { name: 'Italian', slug: 'italian', iconUrl: '🍕' },
  });
  const japanese = await prisma.cuisine.upsert({
    where: { slug: 'japanese' },
    update: {},
    create: { name: 'Japanese', slug: 'japanese', iconUrl: '🍣' },
  });
  const indian = await prisma.cuisine.upsert({
    where: { slug: 'indian' },
    update: {},
    create: { name: 'Indian', slug: 'indian', iconUrl: '🍛' },
  });
  const american = await prisma.cuisine.upsert({
    where: { slug: 'american' },
    update: {},
    create: { name: 'American', slug: 'american', iconUrl: '🍔' },
  });

  // 2. Create Restaurant 1: Bella Napoli Trattoria
  await prisma.restaurant.create({
    data: {
      name: 'Bella Napoli Trattoria',
      slug: 'bella-napoli-trattoria',
      description:
        'Authentic Neapolitan sourdough pizza and handcrafted pasta prepared in traditional wood-fired ovens.',
      phone: '+91 98765 43210',
      email: 'reservations@bellanapoli.example.com',
      website: 'https://bellanapoli.example.com',
      priceRange: PriceRange.MODERATE,
      coverImageUrl:
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      logoUrl:
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=200&q=80',
      isQueueOpen: true,
      location: {
        create: {
          addressLine1: '42 Baker Street, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          country: 'IN',
          latitude: 12.9716,
          longitude: 77.6412,
        },
      },
      operatingSettings: {
        create: {
          minPartySize: 1,
          maxPartySize: 8,
          estimatedMinutesPerParty: 15,
          callTimeoutMinutes: 10,
          maxActiveQueueEntries: 40,
        },
      },
      cuisines: {
        create: [{ cuisineId: italian.id }],
      },
      tables: {
        create: [
          { tableNumber: 'T1', capacity: 2, minCapacity: 1 },
          { tableNumber: 'T2', capacity: 2, minCapacity: 1 },
          { tableNumber: 'T3', capacity: 4, minCapacity: 2 },
          { tableNumber: 'T4', capacity: 4, minCapacity: 2 },
          { tableNumber: 'T5', capacity: 6, minCapacity: 4 },
        ],
      },
      menuCategories: {
        create: [
          {
            name: 'Starters & Antipasti',
            sortOrder: 1,
            items: {
              create: [
                {
                  name: 'Bruschetta al Pomodoro',
                  description:
                    'Toasted sourdough with vine-ripened tomatoes, garlic, extra virgin olive oil, and fresh basil.',
                  price: 340,
                  isVegetarian: true,
                  isAvailable: true,
                  sortOrder: 1,
                },
                {
                  name: 'Truffle Arancini',
                  description:
                    'Crispy saffron risotto balls filled with mozzarella and black truffle essence.',
                  price: 420,
                  isVegetarian: true,
                  isAvailable: true,
                  sortOrder: 2,
                },
              ],
            },
          },
          {
            name: 'Wood-Fired Pizzas',
            sortOrder: 2,
            items: {
              create: [
                {
                  name: 'Margherita D.O.P.',
                  description:
                    'San Marzano tomatoes, fresh fior di latte mozzarella, basil, and aged parmesan.',
                  price: 580,
                  isVegetarian: true,
                  isAvailable: true,
                  sortOrder: 1,
                },
                {
                  name: 'Diavola Piccante',
                  description:
                    'Tomato sugo, spicy artisanal salami, fresh mozzarella, and hot chili drizzle.',
                  price: 680,
                  isVegetarian: false,
                  isSpicy: true,
                  isAvailable: true,
                  sortOrder: 2,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // 3. Create Restaurant 2: Kuroshio Ramen & Izakaya
  await prisma.restaurant.create({
    data: {
      name: 'Kuroshio Ramen & Izakaya',
      slug: 'kuroshio-ramen-izakaya',
      description:
        'Rich 18-hour simmered Tonkotsu and Tori Paitan broth with house-made alkaline noodles and craft gyoza.',
      phone: '+91 98765 43211',
      priceRange: PriceRange.EXPENSIVE,
      coverImageUrl:
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80',
      isQueueOpen: true,
      location: {
        create: {
          addressLine1: '18 Koramangala 4th Block',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          country: 'IN',
          latitude: 12.9352,
          longitude: 77.6245,
        },
      },
      operatingSettings: {
        create: {
          minPartySize: 1,
          maxPartySize: 6,
          estimatedMinutesPerParty: 12,
          callTimeoutMinutes: 8,
        },
      },
      cuisines: {
        create: [{ cuisineId: japanese.id }],
      },
      tables: {
        create: [
          { tableNumber: 'Bar-1', capacity: 1, minCapacity: 1 },
          { tableNumber: 'Bar-2', capacity: 1, minCapacity: 1 },
          { tableNumber: 'Table-1', capacity: 4, minCapacity: 2 },
          { tableNumber: 'Table-2', capacity: 4, minCapacity: 2 },
        ],
      },
      menuCategories: {
        create: [
          {
            name: 'Ramen Bowls',
            sortOrder: 1,
            items: {
              create: [
                {
                  name: 'Kuroshio Black Garlic Tonkotsu',
                  description:
                    'Creamy pork broth enriched with roasted black garlic oil, ajitsuke tamago, and tender chashu.',
                  price: 650,
                  isSpicy: false,
                  isAvailable: true,
                  sortOrder: 1,
                },
                {
                  name: 'Spicy Tantanmen',
                  description:
                    'Sesame chili broth with spiced minced plant meat, bok choy, and scallions.',
                  price: 620,
                  isVegetarian: true,
                  isSpicy: true,
                  isAvailable: true,
                  sortOrder: 2,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // 4. Create Restaurant 3: The Copper Handi
  await prisma.restaurant.create({
    data: {
      name: 'The Copper Handi',
      slug: 'the-copper-handi',
      description:
        'Royal Awadhi and Dum Pukht cuisine slow-cooked in hand-beaten copper pots over charcoal ember.',
      phone: '+91 98765 43212',
      priceRange: PriceRange.MODERATE,
      coverImageUrl:
        'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=80',
      isQueueOpen: true,
      location: {
        create: {
          addressLine1: '77 Lavelle Road, Shanthala Nagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
          latitude: 12.9719,
          longitude: 77.5993,
        },
      },
      operatingSettings: {
        create: {
          minPartySize: 2,
          maxPartySize: 12,
          estimatedMinutesPerParty: 20,
          callTimeoutMinutes: 10,
        },
      },
      cuisines: {
        create: [{ cuisineId: indian.id }],
      },
      tables: {
        create: [
          { tableNumber: 'H1', capacity: 4, minCapacity: 2 },
          { tableNumber: 'H2', capacity: 6, minCapacity: 4 },
          { tableNumber: 'H3', capacity: 8, minCapacity: 6 },
        ],
      },
      menuCategories: {
        create: [
          {
            name: 'Biryanis & Mains',
            sortOrder: 1,
            items: {
              create: [
                {
                  name: 'Dum Pukht Lucknowi Biryani',
                  description:
                    'Fragrant long-grain basmati rice layered with saffron, rose water, and choice cut spices.',
                  price: 520,
                  isSpicy: false,
                  isAvailable: true,
                  sortOrder: 1,
                },
                {
                  name: 'Dal Makhani Bukhara Style',
                  description:
                    'Slow-cooked black lentils simmered overnight for 24 hours with churned butter and cream.',
                  price: 440,
                  isVegetarian: true,
                  isSpicy: false,
                  isAvailable: true,
                  sortOrder: 2,
                },
              ],
            },
          },
        ],
      },
    },
  });

  return { count: 3, message: 'Sample restaurants seeded successfully' };
}
