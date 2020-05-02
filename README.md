# apollo-server-restrict-introspection

Restrict types exposed by apollo-server's introspection/playground.

## Installing

`npm install apollo-server-restrict-introspection`

## Usage

See src/demo.ts and src/index.test.ts

## Notes

- You must use `app.use(bodyParser.json())` before the middleware
- The middleware must run before apollo-server's middleware

## Author

Andreas Brekken ([@abrkn](https://twitter.com/abrkn))

## License

MIT
