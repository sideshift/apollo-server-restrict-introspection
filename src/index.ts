/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createHash } from 'crypto';
import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLScalarType,
} from 'graphql';
import type { NextFunction, Request, Response } from 'express';
import LRU from 'lru-cache';
import { SchemaDirectiveVisitor } from 'apollo-server-express';

/* eslint-disable no-underscore-dangle */
interface IntrospectionResponse {
  data: {
    __schema: {
      queryType?: {
        name: string;
      };
      mutationType?: {
        name: string;
      };
      types: {
        kind: string;
        name: string;
        fields:
          | {
              name: string;
            }[]
          | null;
        inputFields:
          | {
              name: string;
            }[]
          | null;
      }[];
    };
  };
}

export type WhitelistEntry =
  | {
      kind?: string;
      name: string;
      fields?: string[];
    }
  | string;

export type Whitelist = WhitelistEntry[];

export function withWhitelist(whitelist: Whitelist, response: unknown): IntrospectionResponse {
  // require('fs').writeFileSync(__dirname + '/../res.json', JSON.stringify(response, null, 2));
  // return response as IntrospectionResponse;

  const responseTyped = response as IntrospectionResponse;

  return {
    ...responseTyped,
    data: {
      ...responseTyped.data,
      __schema: {
        ...responseTyped.data.__schema,
        types: responseTyped.data.__schema.types.reduce((prev, type) => {
          const entry = whitelist.find((_) => {
            if (typeof _ === 'string') {
              return _ === type.name;
            }

            return _.name === type.name && (_.kind === undefined || _.kind === type.kind);
          });

          if (!entry) {
            return prev;
          }

          const allowedFields = typeof entry === 'string' ? undefined : entry.fields;

          if (!allowedFields) {
            return [...prev, type];
          }

          const fields = type.fields || type.inputFields;

          return [
            ...prev,
            {
              ...type,
              fields: fields!.filter((field) => allowedFields.includes(field.name)),
            },
          ];
        }, [] as IntrospectionResponse['data']['__schema']['types']),
      },
    },
  };
}

function entryName(entry: WhitelistEntry): string {
  return typeof entry === 'string' ? entry : entry.name;
}

function validateWhitelist(whitelist: Whitelist, response: IntrospectionResponse): void {
  const schema = response.data.__schema;

  if (schema.queryType !== undefined && !whitelist.some((entry) => entryName(entry) === 'Query')) {
    throw new Error(`When schema defines a queryType, whitelist must contain "Query"`);
  }

  if (
    schema.mutationType !== undefined &&
    !whitelist.some((entry) => entryName(entry) === 'Mutation')
  ) {
    throw new Error(`When schema defines a mutationType, whitelist must contain "Mutation"`);
  }
}

export function middleware(whitelist: Whitelist) {
  const cache = new LRU<string, IntrospectionResponse>(10);

  return function whitelistMiddleware(req: Request, res: Response, next: NextFunction) {
    const isIntrospection = req.body?.operationName === 'IntrospectionQuery';

    if (!isIntrospection) {
      next();
      return;
    }

    const { send } = res;

    // Prevent infinite recursion
    let sent = false;

    res.send = function sendWithWhitelist(bodyRaw: string): Response {
      if (sent) {
        send.call(this, bodyRaw);
        return res;
      }

      const hash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

      const cached = cache.get(hash);

      if (cached !== undefined) {
        sent = true;
        send.call(this, cached);
        return res;
      }

      const body: IntrospectionResponse = JSON.parse(bodyRaw);

      validateWhitelist(whitelist, body);

      const result = withWhitelist(whitelist, body);

      cache.set(hash, result);
      sent = true;

      send.call(this, result);

      return res;
    };

    next();
  };
}

export function createDirective() {
  const whitelist: Whitelist = ['CacheControlScope'];

  class IntrospectionDirective extends SchemaDirectiveVisitor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public visitFieldDefinition(_field: GraphQLField<any, any>) {}

    private visit(
      object: GraphQLInputObjectType | GraphQLObjectType,
      kind: 'OBJECT' | 'INPUT_OBJECT'
    ) {
      const fields = object.getFields();
      const allowAllFields = this.args.fields === true;

      whitelist.push({
        kind,
        name: object.name,

        fields:
          (Object.keys(fields)
            .map((name) =>
              allowAllFields ||
              fields[name].astNode?.directives?.some(
                (directive) => directive.name.value === 'introspection'
              )
                ? name
                : undefined
            )
            .filter(Boolean) as string[]) ?? [],
      });
    }

    visitScalar(scalar: GraphQLScalarType): GraphQLScalarType | void | null {
      whitelist.push({ kind: 'SCALAR', name: scalar.name });
    }

    visitInputObject(object: GraphQLInputObjectType): GraphQLInputObjectType | void | null {
      this.visit(object, 'INPUT_OBJECT');
    }

    visitObject(object: GraphQLObjectType): GraphQLObjectType | void | null {
      this.visit(object, 'OBJECT');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { whitelist, IntrospectionDirective: IntrospectionDirective as any };
}
