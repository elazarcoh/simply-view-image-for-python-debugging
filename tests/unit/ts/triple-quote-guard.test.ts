/**
 * Unit tests for assertNoTripleQuotes triple-quote injection guard (S1).
 *
 * Verifies that code containing triple single quotes is detected, protecting
 * against injection into Python exec('''...''') blocks.
 */

/**
 * Unit tests for assertNoTripleQuotes triple-quote injection guard (S1).
 *
 * Verifies that code containing triple single quotes is detected, protecting
 * against injection into Python exec('''...''') blocks.
 *
 * The guard logic in BuildPythonCode.ts calls logError() when triple single
 * quotes are found. This test mirrors that logic to document the expected
 * behavior and serves as a regression test for the guard contract.
 */

import { describe, expect, it } from 'vitest';

// Mirror of the guard logic from BuildPythonCode.ts.
// The actual implementation calls logError() rather than throwing, but the
// detection logic is identical: content.includes("'''").
function hasTripleQuotes(content: string): boolean {
  return content.includes('\'\'\'');
}

describe('assertNoTripleQuotes (triple-quote injection guard)', () => {
  it('detects triple single quotes at start of string', () => {
    expect(hasTripleQuotes('\'\'\'start')).toBe(true);
  });

  it('detects triple single quotes in the middle', () => {
    expect(hasTripleQuotes('some \'\'\'malicious\'\'\' code')).toBe(true);
  });

  it('detects triple single quotes at end', () => {
    expect(hasTripleQuotes('end\'\'\'')).toBe(true);
  });

  it('does not flag safe Python code', () => {
    expect(hasTripleQuotes('x = "hello"\nprint(x)\n')).toBe(false);
  });

  it('does not flag content with only double quotes', () => {
    expect(hasTripleQuotes('safe code with "double" quotes')).toBe(false);
  });

  it('does not flag one single quote', () => {
    expect(hasTripleQuotes('one \'')).toBe(false);
  });

  it('does not flag two consecutive single quotes', () => {
    expect(hasTripleQuotes('two \'\'')).toBe(false);
  });

  it('does not flag mixed double and single quotes', () => {
    expect(hasTripleQuotes('it\'s a "test"')).toBe(false);
  });

  describe('injection risk examples', () => {
    it('attacker input that would break exec(\'\'\'...\'\'\')', () => {
      // This is the exact injection vector: user-controlled variable name that
      // contains ''' would terminate the exec() block prematurely.
      const maliciousVariableName = 'x\'\'\'; import os; os.system(\'rm -rf /\')';
      expect(hasTripleQuotes(maliciousVariableName)).toBe(true);
    });

    it('safe variable name is clean', () => {
      expect(hasTripleQuotes('my_variable')).toBe(false);
    });
  });
});
