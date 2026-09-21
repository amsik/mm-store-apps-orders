/**
 * Demo data: employees to pick from and a few OPEN orders. Idempotent: every record has a fixed id and is
 * only inserted when missing, so re-running never duplicates data or undoes transitions made in the demo.
 *
 * Run with `yarn workspace @app/api seed` (Node strips the types, no build step needed).
 */
import { PrismaClient } from '@prisma/client';

export const SEED_EMPLOYEES = [
  { id: '66f000000000000000000001', name: 'Alice Schmidt' },
  { id: '66f000000000000000000002', name: 'Bruno Weber' },
  { id: '66f000000000000000000003', name: 'Carla Rossi' },
  { id: '66f000000000000000000004', name: 'David Novak' },
  { id: '66f000000000000000000005', name: 'Elena García' },
] as const;

export const SEED_ORDERS = [
  {
    id: '66f000000000000000000101',
    customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
    lineItems: [
      { sku: 'TV-55', name: 'Television 55"', quantity: 1, unitPriceCents: 49_900 },
      { sku: 'HDMI-2', name: 'HDMI cable', quantity: 2, unitPriceCents: 1_299 },
    ],
  },
  {
    id: '66f000000000000000000102',
    customer: { name: 'Alan Turing', email: 'alan@example.com' },
    lineItems: [{ sku: 'LAPTOP-14', name: 'Laptop 14"', quantity: 1, unitPriceCents: 89_900 }],
  },
  {
    id: '66f000000000000000000103',
    customer: { name: 'Grace Hopper', email: 'grace@example.com' },
    lineItems: [
      { sku: 'PHONE-6', name: 'Smartphone', quantity: 1, unitPriceCents: 69_900 },
      { sku: 'CASE-6', name: 'Phone case', quantity: 1, unitPriceCents: 1_999 },
    ],
  },
] as const;

export async function seed(prisma: PrismaClient): Promise<void> {
  // `update: {}` makes each upsert an insert-if-missing.
  for (const { id, name } of SEED_EMPLOYEES) {
    await prisma.employee.upsert({ where: { id }, create: { id, name }, update: {} });
  }
  for (const { id, customer, lineItems } of SEED_ORDERS) {
    await prisma.order.upsert({
      where: { id },
      create: { id, customer, lineItems: [...lineItems] },
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
