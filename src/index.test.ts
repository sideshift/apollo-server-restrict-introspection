import { create as dogsAndAgents } from './dogs-and-agents';

describe('directive', () => {
  it('should pass test vector', () => {
    const { whitelist } = dogsAndAgents();

    expect(whitelist).toEqual([
      'CacheControlScope',
      { kind: 'ENUM', name: 'Size', fields: ['SMALL', 'MEDIUM', 'LARGE'] },
      { kind: 'ENUM', name: 'Breed', fields: ['POODLE', 'BULLDOG'] },
      { kind: 'ENUM', name: 'IssueType', fields: ['FLEAS', 'HEARTWORMS'] },
      { kind: 'UNION', name: 'Issue', fields: ['Fleas', 'Heartworms'] },
      { kind: 'OBJECT', name: 'Fleas', fields: ['type', 'bathed'] },
      { kind: 'OBJECT', name: 'Heartworms', fields: ['type'] },
      { kind: 'OBJECT', name: 'Dog', fields: ['name', 'age', 'breed', 'issues'] },
      { kind: 'OBJECT', name: 'Query', fields: ['dogs'] },
      { kind: 'OBJECT', name: 'Mutation', fields: ['bark'] },
    ]);
  });
});
