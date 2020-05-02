/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import express from 'express';
import bodyParser from 'body-parser';
import { middleware } from '.';
import { create as dogsAndAgents } from './dogs-and-agents';

process.on('unhandledRejection', (reason: unknown) =>
  setImmediate(() => {
    console.error(reason);
    process.exit(1);
  })
);

const { apolloServer, whitelist } = dogsAndAgents();

const app = express();

app.use(bodyParser.json());

app.use(middleware(whitelist));

console.dir(whitelist, { depth: null });

apolloServer.applyMiddleware({ app });

const port = process.env.PORT ?? 3010;
app.listen(port, () => console.log(`Listening on http://localhost:${port}/graphql`));
