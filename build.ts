#!/usr/bin/env bun

import packagejson from "./package.json";
import path from "path";
import fs from "fs/promises";

const globs = packagejson.workspaces.map(
  (p) => new Bun.Glob(`${p}/package.json`),
);

const packages = (
  await Promise.all(
    globs.map((glob) =>
      Array.fromAsync(glob.scan({ cwd: __dirname, absolute: true })),
    ),
  )
)
  .flat()
  .map((p) => path.dirname(p));

await Promise.all(
  packages.map(async (p) => {
    ["es6", "commonjs"].map(async (type) => {
      await fs.writeFile(
        p + `/.swcrc.${type}.json`,
        JSON.stringify(
          {
            $schema: "https://swc.rs/schema.json",
            module: {
              type,
            },
            jsc: {
              target: "esnext",
              parser: {
                syntax: "typescript",
              },
            },
          },
          null,
          2,
        ),
      );
    });

    await fs.writeFile(
      p + "/tsconfig.build.json",
      JSON.stringify(
        {
          extends: "./tsconfig.json",
          compilerOptions: {
            allowJs: false,
            noEmit: false,
            isolatedDeclarations: true,
            emitDeclarationOnly: true,
            declaration: true,
            outDir: "types",
          },
          include: ["src"],
          exclude: ["*.test.*"],
        },
        null,
        2,
      ),
    );

    await Bun.$`
        cd ${p}
        cp ${__dirname}/tsconfig.json ./tsconfig.json
        rm -rf ./dist ./types
        bunx tsc -p ./tsconfig.build.json
        bunx swc ./src --config-file .swcrc.commonjs.json --out-dir ./dist/cjs --ignore '**/*.test.ts' --strip-leading-paths
        bunx swc ./src --config-file .swcrc.es6.json --out-dir ./dist/mjs --ignore '**/*.test.ts' --strip-leading-paths
    `;

    await Promise.all(
      ["cjs", "mjs"].map(async (type) => {
        await fs.writeFile(
          p + `/dist/${type}/package.json`,
          JSON.stringify(
            {
              type: type === "cjs" ? "commonjs" : "module",
            },
            null,
            2,
          ),
        );
      }),
    );
    const pkgJson = JSON.parse(await fs.readFile(p + "/package.json", "utf-8"));
    Object.assign(pkgJson, {
      main: "dist/cjs/index.js",
      module: "dist/mjs/index.js",
      exports: {
        ".": {
          import: "./dist/mjs/index.js",
          require: "./dist/cjs/index.js",
          types: "./types/index.d.ts",
        },
      },
      types: "./types/index.d.ts",
      publishConfig: {
        access: "public",
      },
    });
    await fs.writeFile(p + "/package.json", JSON.stringify(pkgJson, null, 2));
  }),
);

console.log('Successfully built packages');
