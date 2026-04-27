import { describe, expect, it } from 'vitest';
import { sanitizeFirestoreValue } from './backgroundJobs';

describe('sanitizeFirestoreValue', () => {
  it('removes undefined fields from nested Firestore payloads', () => {
    const sanitized = sanitizeFirestoreValue({
      customerName: 'Walk-in Customer',
      customerPhone: undefined,
      payload: {
        items: [
          {
            id: 'sale-1',
            footerNote: undefined,
            sourceMeta: {
              provider: 'zobaze',
              cashier: null,
              customerEmail: undefined,
            },
          },
          undefined,
        ],
      },
    });

    expect(sanitized).toEqual({
      customerName: 'Walk-in Customer',
      payload: {
        items: [
          {
            id: 'sale-1',
            sourceMeta: {
              provider: 'zobaze',
              cashier: null,
            },
          },
        ],
      },
    });
  });
});
