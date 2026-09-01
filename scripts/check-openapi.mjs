import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = join(repositoryRoot, "src", "api", "openapi.json");
const schemaArgumentIndex = globalThis.process.argv.indexOf("--schema");
const schemaPath =
  schemaArgumentIndex === -1
    ? join(repositoryRoot, "src", "api", "schema.ts")
    : resolve(
        repositoryRoot,
        globalThis.process.argv[schemaArgumentIndex + 1] ?? "",
      );
const generatorPath = join(
  repositoryRoot,
  "node_modules",
  "openapi-typescript",
  "bin",
  "cli.js",
);

const generateSchema = () =>
  new Promise((resolveGenerator, rejectGenerator) => {
    const generator = spawn(
      globalThis.process.execPath,
      [generatorPath, inputPath],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    const output = [];

    generator.stdout.on("data", (chunk) => output.push(chunk));
    generator.once("error", rejectGenerator);
    generator.once("close", (code) => {
      if (code === 0) resolveGenerator(Buffer.concat(output));
      else
        rejectGenerator(
          new Error(`openapi-typescript exited with code ${code}`),
        );
    });
  });

const [expected, actual] = await Promise.all([
  generateSchema(),
  readFile(schemaPath),
]);
if (!expected.equals(actual)) {
  globalThis.console.error(`OpenAPI schema drift detected: ${schemaPath}`);
  globalThis.process.exitCode = 1;
}
