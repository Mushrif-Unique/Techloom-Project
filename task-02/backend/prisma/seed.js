import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const products = [
  [
    'Studio Headphones',
    'Electronics',
    '129.00',
    18,
    'headphones',
    'Warm, balanced sound in a quietly beautiful design. Soft over-ear cushions and a lightweight frame make long listening sessions feel effortless.',
  ],
  [
    'The Everyday Tote',
    'Accessories',
    '38.00',
    24,
    'tote',
    'A roomy natural-cotton carryall for market mornings, workdays, and everything between. Reinforced handles, an inner pocket, and a simple silhouette.',
  ],
  [
    'Arc Table Lamp',
    'Home',
    '89.00',
    12,
    'lamp',
    'A sculptural dome lamp that brings a warm pool of light to a bedside table or reading corner. Powder-coated metal, a weighted base, and an inline switch.',
  ],
  [
    'Essential Cotton Tee',
    'Clothing',
    '32.00',
    30,
    'shirt',
    'The one you reach for first. A relaxed unisex T-shirt in soft, substantial cotton, finished with a ribbed crew neck and clean seams. One standard relaxed fit.',
  ],
  [
    'Quiet Mechanical Keyboard',
    'Electronics',
    '115.00',
    9,
    'keyboard',
    'A compact wireless keyboard with tactile keys and a satisfying, softened sound. Neutral keycaps, a sturdy frame, and a layout that makes your desk feel considered.',
  ],
  [
    'Form Ceramic Vase',
    'Home',
    '46.00',
    16,
    'vase',
    'An understated ceramic vessel with a matte sand glaze. Beautiful with a single stem, dried flowers, or simply on its own. Each silhouette has a quiet presence.',
  ],
  [
    'Weekender Backpack',
    'Accessories',
    '78.00',
    10,
    'backpack',
    'Take the essentials and a little room for possibility. Durable olive canvas, padded straps, a laptop sleeve, and generous pockets for everyday organization.',
  ],
  [
    'Move Yoga Mat',
    'Sports',
    '58.00',
    14,
    'mat',
    'Make space for a slower start. A supportive, textured mat with a non-slip surface and a simple carry strap. Built for everyday stretching and movement.',
  ],
  [
    'Cloud Knit Sweater',
    'Clothing',
    '74.00',
    8,
    'shirt',
    'An easy layer for cool mornings and late evenings. Soft cotton knit with a relaxed shape, comfortable cuffs, and a natural oat finish. One standard relaxed fit.',
  ],
  [
    'Ritual Coffee Cup',
    'Home',
    '24.00',
    22,
    'mug',
    'Your morning ritual, made a little better. A generous stoneware mug with a comfortable handle and a warm, tactile glaze. Holds 350 ml.',
  ],
  [
    'Pocket Speaker',
    'Electronics',
    '64.00',
    7,
    'speaker',
    'A small speaker with a warm sound and a woven finish. Rechargeable, portable, and equally at home on a bookshelf or a picnic blanket.',
  ],
  [
    'Trail Water Bottle',
    'Sports',
    '29.00',
    20,
    'bottle',
    'Keep your rhythm wherever the day leads. A 750 ml insulated stainless-steel bottle with a leak-resistant lid and a durable matte finish.',
  ],
  [
    'Classic Canvas Cap',
    'Accessories',
    '26.00',
    0,
    'cap',
    'A familiar favorite in soft brushed canvas. Adjustable strap, curved brim, and an unstructured crown for an easy everyday fit.',
  ],
  [
    'Linen Cushion',
    'Home',
    '42.00',
    11,
    'cushion',
    'A soft landing for slower evenings. Natural-texture linen cover with a concealed zip and a supportive insert. A simple way to make a room feel like home.',
  ],
  [
    'Everyday Joggers',
    'Clothing',
    '56.00',
    6,
    'pants',
    'Comfort you can live in. Midweight cotton-blend joggers with a drawstring waist and deep pockets. Designed for an easy pace, in a standard relaxed fit.',
  ],
  [
    'Desk Charging Stand',
    'Electronics',
    '49.00',
    13,
    'stand',
    'A tidy home for your phone. An angled wireless charging stand with a weighted base and a subtle indicator light. Compatible with Qi-enabled phones.',
  ],
  [
    'Resistance Band Set',
    'Sports',
    '35.00',
    15,
    'bands',
    'A compact set of three resistance levels for movement at home or on the go. Includes a simple fabric pouch so your routine travels with you.',
  ],
  [
    'Slim Leather Wallet',
    'Accessories',
    '45.00',
    0,
    'wallet',
    'Carry what matters. A slim card wallet with four slots, a central pocket, and a clean stitched edge. Finished in a warm, understated brown.',
  ],
  [
    'Weekend Overshirt',
    'Clothing',
    '92.00',
    5,
    'shirt',
    'An easy layer with a little structure. Durable cotton twill, roomy patch pockets, and a relaxed collar in a muted olive tone. One standard relaxed fit.',
  ],
  [
    'Balance Foam Roller',
    'Sports',
    '39.00',
    9,
    'roller',
    'A supportive companion for recovery days. Medium-density foam with a gently textured surface for comfortable everyday mobility work.',
  ],
];
try {
  for (let i = 0; i < products.length; i++) {
    const [name, category, price, stockQuantity, image, description] = products[i];
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await db.product.upsert({
      where: { id },
      create: {
        id,
        name,
        category,
        price,
        stockQuantity,
        imageUrl: `/images/${image}.svg`,
        description,
        createdAt: new Date(Date.UTC(2026, 0, 20 - i)),
      },
      update: { name, category, description, imageUrl: `/images/${image}.svg` },
    });
  }
  console.info(`Seeded ${products.length} products. Existing prices and inventory were preserved.`);
} finally {
  await db.$disconnect();
}
