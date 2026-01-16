import { describe, it, expect } from 'vitest';
import { DevArkError } from '../../src/utils/errors';

describe('Simple Test', () => {
  it('should create DevArkError', () => {
    const error = new DevArkError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
  });
});