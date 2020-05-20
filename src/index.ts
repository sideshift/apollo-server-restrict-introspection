/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createHash } from 'crypto';
import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLEnumValue,
} from 'graphql';
import type { NextFunction, Request, Response } from 'express';
import LRU from 'lru-cache';
import { SchemaDirectiveVisitor } from 'apollo-server-express';

enum TypeKind {
  enum = 'ENUM',
  inputObject = 'INPUT_OBJECT',
  object = 'OBJECT',
  scalar = 'SCALAR'
}

interface Field {
  name: string;
}

interface ObjectType {
  kind: TypeKind.object;
  fields: Field[];
}

interface InputObjectType {
  kind: TypeKind.inputObject;
  inputFields: Field[];
}

interface ScalarType {
  kind: TypeKind.scalar;
  fields: null;
}

interface EnumType {
  kind: TypeKind.enum;
  enumValues: Field[];
}

type Type = { name: string; } & (ObjectType | InputObjectType | ScalarType | EnumType);

/* eslint-disable no-underscore-dangle */
interface IntrospectionResponse {
  data?: {
    __schema: {
      queryType?: {
        name: string;
      };
      mutationType?: {
        name: string;
      };
      types: Type[]
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
  const responseTyped = response as IntrospectionResponse;

  const { data } = responseTyped;

  if (data === undefined) {
    return responseTyped;
  }

  return {
    ...responseTyped,
    data: {
      ...data,
      __schema: {
        ...data.__schema,
        types: data.__schema.types.reduce((prev, type) => {
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

          let fields: Field[];

          if (type.kind === TypeKind.object) {
            fields = type.fields;
          } else if (type.kind === TypeKind.inputObject) {
            fields = type.inputFields;
          } else if (type.kind === TypeKind.enum) {
            fields = type.enumValues;
          } else {
            throw new Error(`Unexpected kind ${type.kind}`);
          }

          return [
            ...prev,
            {
              ...type,
              fields: fields.filter((field) => allowedFields.includes(field.name)),
            },
          ];
        }, [] as (typeof data)['__schema']['types']),
      },
    },
  };
}

function entryName(entry: WhitelistEntry): string {
  return typeof entry === 'string' ? entry : entry.name;
}

function validateWhitelist(whitelist: Whitelist, response: IntrospectionResponse): void {
  const { data } = response;

  if (data === undefined) {
    throw new Error('data is undefined');
  }

  const schema = data.__schema;

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
      kind: TypeKind.object | TypeKind.inputObject
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
      whitelist.push({ kind: TypeKind.scalar, name: scalar.name });
    }

    visitInputObject(object: GraphQLInputObjectType): GraphQLInputObjectType | void | null {
      this.visit(object, TypeKind.inputObject);
    }

    visitObject(object: GraphQLObjectType): GraphQLObjectType | void | null {
      this.visit(object, TypeKind.object);
    }

    visitEnumValue(_object: GraphQLEnumValue): GraphQLEnumValue | void | null {}

    visitEnum(object: GraphQLEnumType): GraphQLEnumType | void | null {
      const values = object.getValues();
      const allowAllFields = this.args.fields === true;

      const fields =
        (values
          .map(value =>
            allowAllFields ||
            value.astNode?.directives?.some(directive => directive.name.value === 'introspection')
              ? value.name
              : undefined
          )
          .filter(Boolean) as string[]) ?? [];

      whitelist.push({
        kind: TypeKind.enum,
        name: object.name,
        fields,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { whitelist, IntrospectionDirective: IntrospectionDirective as any };
}

export const directiveTypeDef = `directive @introspection(
  fields: Boolean
) on OBJECT | FIELD_DEFINITION | INPUT_OBJECT | SCALAR | ENUM | ENUM_VALUE`;
