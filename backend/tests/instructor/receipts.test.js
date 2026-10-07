const { prisma, resetDb } = require('../helpers');
const { issueReceiptNumber } = require('../../src/services/cash.service');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const issue = (now) => prisma.$transaction((tx) => issueReceiptNumber(tx, now));

describe('official receipt numbers', () => {
  it('counts up within a year and restarts at 000001 in January (Manila time)', async () => {
    const lastMinuteOf2026 = new Date('2026-12-31T15:59:00Z');
    const firstMinuteOf2027 = new Date('2026-12-31T16:00:00Z');

    expect(await issue(lastMinuteOf2026)).toBe('OR-2026-000001');
    expect(await issue(lastMinuteOf2026)).toBe('OR-2026-000002');
    expect(await issue(firstMinuteOf2027)).toBe('OR-2027-000001');
    expect(await issue(lastMinuteOf2026)).toBe('OR-2026-000003');
  });

  it('gives each concurrent payment its own number', async () => {
    const now = new Date('2026-06-01T02:00:00Z');
    const numbers = await Promise.all(Array.from({ length: 8 }, () => issue(now)));

    expect(new Set(numbers).size).toBe(8);
    expect(numbers.sort()).toEqual(Array.from({ length: 8 }, (_, i) => `OR-2026-${String(i + 1).padStart(6, '0')}`));
  });

  it('returns the number when the payment transaction rolls back, leaving no gap', async () => {
    const now = new Date('2026-06-01T02:00:00Z');
    await expect(
      prisma.$transaction(async (tx) => {
        await issueReceiptNumber(tx, now);
        throw new Error('payment failed');
      }),
    ).rejects.toThrow('payment failed');

    expect(await issue(now)).toBe('OR-2026-000001');
  });
});
