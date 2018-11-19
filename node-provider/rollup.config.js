import typescript from "rollup-plugin-typescript2";
import json from "rollup-plugin-json";

import pkg from "./package.json";
const globals = {
};

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        sourcemap: true,
        format: "cjs",
        globals: globals
      }
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ],
    plugins: [
      typescript({
        typescript: require("typescript")
      }),
      json({ compact: true })
    ]
  }
];
