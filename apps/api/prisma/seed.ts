/**
 * Demo data: employees to pick from and a page-able set of OPEN orders. Idempotent: every record has a fixed id and is
 * only inserted when missing, so re-running never duplicates data or undoes transitions made in the demo.
 *
 * Run with `yarn workspace @app/api seed` (Node strips the types, no build step needed).
 */
import { PrismaClient } from '@prisma/client';

/** A fixed ObjectId per record, so the seed can tell what it already inserted. */
function seedId(kind: 'employee' | 'order', n: number): string {
  return `66f0${kind === 'employee' ? 'e' : '0'}${n.toString(16).padStart(19, '0')}`;
}

const EMPLOYEE_NAMES = [
  'Alice Schmidt',
  'Bruno Weber',
  'Carla Rossi',
  'David Novak',
  'Elena García',
  'Felix Wagner',
  'Greta Hansen',
  'Hugo Martin',
  'Ines Costa',
  'Jonas Becker',
  'Klara Horvat',
  'Lukas Meyer',
  'Marta Kowalska',
  'Nico Fischer',
  'Olivia Jansen',
  'Paul Dubois',
  'Rita Moreau',
  'Sven Lindqvist',
];

export const SEED_EMPLOYEES = EMPLOYEE_NAMES.map((name, i) => ({ id: seedId('employee', i + 1), name }));

const CUSTOMER_NAMES = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Linus Torvalds',
  'Margaret Hamilton',
  'Tim Berners-Lee',
  'Barbara Liskov',
  'Dennis Ritchie',
  'Katherine Johnson',
  'Ken Thompson',
  'Frances Allen',
  'Donald Knuth',
  'Radia Perlman',
  'Edsger Dijkstra',
  'Hedy Lamarr',
  'John McCarthy',
  'Annie Easley',
  'Guido van Rossum',
  'Shafi Goldwasser',
  'Bjarne Stroustrup',
];

const PRODUCTS = [
  { sku: 'TV-55', name: 'Television 55"', unitPriceCents: 49_900 },
  { sku: 'TV-65', name: 'Television 65"', unitPriceCents: 89_900 },
  { sku: 'LAPTOP-14', name: 'Laptop 14"', unitPriceCents: 89_900 },
  { sku: 'LAPTOP-16', name: 'Laptop 16"', unitPriceCents: 149_900 },
  { sku: 'PHONE-6', name: 'Smartphone', unitPriceCents: 69_900 },
  { sku: 'TABLET-11', name: 'Tablet 11"', unitPriceCents: 44_900 },
  { sku: 'HEADPH-NC', name: 'Noise-cancelling headphones', unitPriceCents: 29_900 },
  { sku: 'SPEAKER-BT', name: 'Bluetooth speaker', unitPriceCents: 7_999 },
  { sku: 'CONSOLE-5', name: 'Game console', unitPriceCents: 54_900 },
  { sku: 'CAM-MIRR', name: 'Mirrorless camera', unitPriceCents: 119_900 },
  { sku: 'WATCH-S', name: 'Smartwatch', unitPriceCents: 34_900 },
  { sku: 'COFFEE-EM', name: 'Espresso machine', unitPriceCents: 39_900 },
  { sku: 'VACUUM-R', name: 'Robot vacuum', unitPriceCents: 24_900 },
  { sku: 'HDMI-2', name: 'HDMI cable', unitPriceCents: 1_299 },
  { sku: 'CASE-6', name: 'Phone case', unitPriceCents: 1_999 },
  { sku: 'USB-C-65', name: 'USB-C charger 65W', unitPriceCents: 3_999 },
];

const ORDER_COUNT = 80;

/** `list[i]`, wrapping around at the end. */
function cycle<T>(list: readonly T[], i: number): T {
  const item = list[i % list.length];
  if (item === undefined) throw new Error('cycle() needs a non-empty list');
  return item;
}

/**
 * Orders built from the lists above with index arithmetic rather than randomness, so every run
 * produces the same ids and contents: 1 to 3 distinct products each, quantities 1 to 3.
 */
export const SEED_ORDERS = Array.from({ length: ORDER_COUNT }, (_, i) => {
  const customerName = cycle(CUSTOMER_NAMES, i);
  const itemCount = (i % 3) + 1;
  const lineItems = Array.from({ length: itemCount }, (_, j) => {
    const product = cycle(PRODUCTS, i * 7 + j * 5);
    return { ...product, quantity: ((i + j) % 3) + 1 };
  });
  return {
    id: seedId('order', i + 1),
    customer: {
      name: customerName,
      email: `${customerName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    },
    lineItems,
  };
});

export async function seed(prisma: PrismaClient): Promise<void> {
  // `update: {}` makes each upsert an insert-if-missing.
  for (const { id, name } of SEED_EMPLOYEES) {
    await prisma.employee.upsert({ where: { id }, create: { id, name }, update: {} });
  }
  for (const { id, customer, lineItems } of SEED_ORDERS) {
    await prisma.order.upsert({
      where: { id },
      create: { id, customer, lineItems },
      update: {},
    });
  }
}

if (import.meta.main) {
  const prisma = new PrismaClient();
  try {
    await seed(prisma);
    console.log(
      `Seeded ${String(SEED_EMPLOYEES.length)} employees and ${String(SEED_ORDERS.length)} orders.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
