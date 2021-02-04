/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/prefer-default-export */
import { gql, ApolloServer } from 'apollo-server-express';
import { createDirective, directiveTypeDef } from '.';

export function create() {
  const { whitelist, IntrospectionDirective } = createDirective();

  const typeDefs = gql`
    ${directiveTypeDef}

    enum Size @introspection(fields: true) {
      SMALL
      MEDIUM
      LARGE
    }

    enum Breed @introspection {
      POODLE @introspection
      BULLDOG @introspection
    }
    
    enum IssueType @introspection(fields: true) {
        FLEAS
        HEARTWORMS
    }
    
    union Issue @introspection = Fleas | Heartworms
    
    type Fleas @introspection(fields: true) {
        type: IssueType!
        bathed: Boolean!
    }
    
    type Heartworms @introspection {
        type: IssueType! @introspection
        surgeryRequired: Boolean!
    }

    type Dog @introspection(fields: true) {
      name: String!
      age: Int!
      breed: Breed!
      issues: [Issue!]!
    }

    type Agent {
      name: String!
      password: String!
    }

    type Query @introspection {
      dogs: [Dog!]! @introspection

      agents: [Agent!]!
    }

    type Mutation @introspection {
      changeDogName(prevName: String!, nextName: String!): Boolean
      bark(name: String!): String! @introspection
    }
  `;

  const dogs = [
    {
      name: 'Fido',
      age: 10,
      breed: 'POODLE',
    },
    { name: 'Lassie', age: 8, breed: 'BULLDOG' },
  ];

  const agents = [
    {
      name: 'Jones',
      password: 'secret123',
    },
    {
      name: 'Smith',
      password: 'godmode',
    },
  ];

  const resolvers = {
    Query: {
      dogs: (_: unknown, _args: unknown) => dogs,
      agents: (_: unknown, _args: unknown) => agents,
    },
    Mutation: {
      changeDogName: (
        _: unknown,
        { prevName, nextName }: { prevName: string; nextName: string }
      ) => {
        const dog = dogs.find(d => d.name === prevName);
        if (!dog) {
          throw new Error('Dog not found');
        }

        dog.name = nextName;

        return null;
      },
      bark: (_: unknown, { name }: { name: string }) => {
        const dog = dogs.find(d => d.name === name);
        if (!dog) {
          throw new Error('Dog not found');
        }

        return 'Woof!';
      },
    },
    Issue: {
      __resolveType: (parent: { type: 'FLEAS' | 'HEARTWORMS' }) => {
        if (parent.type === 'FLEAS') return 'Fleas';
        if (parent.type === 'HEARTWORMS') return 'Heartworms';
        throw new Error('Undefined Issue Type');
      }
    }
  };

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    schemaDirectives: {
      introspection: IntrospectionDirective,
    },
    introspection: true,
    playground: true,
  });

  return {
    apolloServer,
    whitelist,
    typeDefs,
  };
}
