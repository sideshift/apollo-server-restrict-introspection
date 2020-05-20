import { create as dogsAndAgents } from './dogs-and-agents';

describe('directive', () => {
  it('should pass test vector', () => {
    const { whitelist } = dogsAndAgents();

    expect(whitelist).toEqual([
      'CacheControlScope',
      { kind: 'ENUM', name: 'Size', fields: ['SMALL', 'MEDIUM', 'LARGE'] },
      { kind: 'ENUM', name: 'Breed', fields: ['POODLE', 'BULLDOG'] },
      { kind: 'OBJECT', name: 'Dog', fields: ['name', 'age', 'breed'] },
      { kind: 'OBJECT', name: 'Query', fields: ['dogs'] },
      { kind: 'OBJECT', name: 'Mutation', fields: ['bark'] },
    ]);
  });
});
