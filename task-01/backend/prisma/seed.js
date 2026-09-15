import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const products = [
  [
    '11111111-1111-4111-8111-111111111111',
    'Studio Laptop',
    '14-inch everyday powerhouse. 16 GB RAM, 512 GB SSD.',
    129900,
    12,
  ],
  [
    '22222222-2222-4222-8222-222222222222',
    'Wireless Mouse',
    'Quiet clicks. Precision tracking. A cleaner desk.',
    4900,
    48,
  ],
  [
    '33333333-3333-4333-8333-333333333333',
    'Mechanical Keyboard',
    'Tactile switches in a compact, aluminum frame.',
    12900,
    24,
  ],
  [
    '44444444-4444-4444-8444-444444444444',
    '4K Studio Monitor',
    '27-inch IPS display with true-to-life color.',
    39900,
    8,
  ],
  [
    '55555555-5555-4555-8555-555555555555',
    'Over-Ear Headphones',
    'Immersive sound with active noise cancellation.',
    17900,
    5,
  ],
  [
    '66666666-6666-4666-8666-666666666666',
    'USB-C Dock',
    'One connection for your entire workspace.',
    8900,
    1,
  ],
];
try {
  for (const [id, name, description, price, stock] of products) {
    await db.product.upsert({
      where: { id },
      update: {},
      create: { id, name, description, price, stock },
    });
  }
  console.log('Seeded six products without overwriting existing inventory.');
} finally {
  await db.$disconnect();
}
