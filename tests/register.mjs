// Lets `node --test` run the app's TypeScript libs with Node's built-in type
// stripping (Node >= 22.18): maps "@/x" to src/x and adds the ".ts" extension
// to extensionless relative imports. No extra packages.
import { register } from "node:module";
register("./resolve-ts.mjs", import.meta.url);
