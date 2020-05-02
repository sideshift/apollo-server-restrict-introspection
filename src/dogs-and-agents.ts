/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/prefer-default-export */
import { gql, ApolloServer } from 'apollo-server-express';
import { createDirective } from '.';

export function create() {
  const { whitelist, IntrospectionDirective } = createDirective();

  const typeDefs = gql`
    directive @introspection(fields: Boolean) on OBJECT | FIELD_DEFINITION | INPUT_OBJECT | SCALAR

    type Dog @introspection(fields: true) {
      name: String!
      age: Int!
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
    },
    { name: 'Lassie', age: 8 },
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
