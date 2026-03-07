// Verifies the vitest framework is correctly set up.
describe('smoke', () => {
  it('framework is operational', () => {
    expect(1 + 1).toBe(2);
  });

  it('typescript types work', () => {
    const values: number[] = [1, 2, 3];
    expect(values.reduce((a, b) => a + b, 0)).toBe(6);
  });
});
