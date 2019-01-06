import commonjs from "rollup-plugin-commonjs";
import json from "rollup-plugin-json";
import nodeResolve from 'rollup-plugin-node-resolve';
import typescript from "rollup-plugin-typescript2";

import pkg from "./package.json";

const globals = {
  "@counterfactual/cf.js": "cfjs",
  "eventemitter3": "EventEmitter",
  "ethers/constants": "ethers.constants",
  "ethers/errors": "ethers.errors",
  "ethers/utils": "ethers.utils",
  "ethers/wallet": "ethers.wallet",
  "firebase": "firebase",
  "uuid": "uuid"
}

const bundledDependencies = new Set([
  "@counterfactual/machine",
  "@counterfactual/types",
  "typescript-memoize"
])

const external = [
  ...(Object.keys(pkg.dependencies || {})).filter(dependency => {
    return !bundledDependencies.has(dependency)
  }),
  ...(Object.keys(pkg.peerDependencies || {})).filter(dependency => {
    return !bundledDependencies.has(dependency)
  }),
];

console.log("external");
console.log(external);

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        sourcemap: true,
        format: "cjs",
        globals: globals
      },
      {
        file: pkg.iife,
        sourcemap: true,
        name: "window",
        format: "iife",
        extend: true,
        globals: globals
      }
    ],
    sourceMap: true,
    external: external,
    plugins: [
      commonjs({
        namedExports: {
          "../../node_modules/typescript-memoize/dist/memoize-decorator.js": ["Memoize"]
        }
      }),
      json({ compact: true }),
      nodeResolve({
        only: [...bundledDependencies]
      }),
      typescript({
        tsconfig: "tsconfig.rollup.json"
      }),
    ]
  }
];
