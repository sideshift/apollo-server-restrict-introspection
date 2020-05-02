import { create as dogsAndAgents } from './dogs-and-agents';

describe('directive', () => {
  it('should pass test vector', () => {
    const { whitelist } = dogsAndAgents();

    expect(whitelist).toEqual([
      'CacheControlScope',
      { kind: 'OBJECT', name: 'Dog', fields: ['name', 'age'] },
      { kind: 'OBJECT', name: 'Query', fields: ['dogs'] },
      { kind: 'OBJECT', name: 'Mutation', fields: ['bark'] },
    ]);
  });
});
