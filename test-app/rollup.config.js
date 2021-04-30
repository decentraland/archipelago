import typescript from "rollup-plugin-typescript2"
import resolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"
import globals from "rollup-plugin-node-globals"
import json from "rollup-plugin-json"
import replace from "rollup-plugin-replace"
import scss from "rollup-plugin-scss"

function fixtslib() {
  return {
    name: "tslib-resolve-id",
    resolveId(source, importer) {
      if (source === "tslib.js" || source === "tslib" || source === "tslib.js?commonjs-proxy") {
        return this.resolve(require.resolve("tslib"), importer)
      }

      return null
    },
  }
}

const plugins = [
  fixtslib(),
  typescript({
    verbosity: 2,
    clean: true,
  }),
  replace({
    "process.env.NODE_ENV": '"development"',
  }),
  resolve({
    browser: true,
    preferBuiltins: false,
  }),
  commonjs({
    ignoreGlobal: true,
    include: [/node_modules/],
    namedExports: {
      react: [
        "Children",
        "Component",
        "PropTypes",
        "createElement",
        "useEffect",
        "useState",
        "useRef",
        "useContext",
        "useMemo",
        "useDebugValue",
        "useCallback",
        "useLayoutEffect",
        "PureComponent",
        "createContext",
      ],
      "prop-types": ["object", "func", "oneOfType", "node", "bool", "any", "arrayOf", "string"],
      tslib: [
        "__extends",
        "__assign",
        "__rest",
        "__decorate",
        "__param",
        "__metadata",
        "__awaiter",
        "__generator",
        "__exportStar",
        "__values",
        "__read",
        "__spread",
        "__spreadArrays",
        "__await",
        "__asyncGenerator",
        "__asyncDelegator",
        "__asyncValues",
        "__makeTemplateObject",
        "__importStar",
        "__importDefault",
        "__classPrivateFieldGet",
        "__classPrivateFieldSet",
      ],
      "node_modules/react/jsx-runtime.js": ["jsx", "jsxs"],
      "react-dom": ["render", "createPortal"],
      "react-is": ["isValidElementType", "isElement", "typeOf"],
    },
  }),
  globals({}),
  json(),
  scss(),
]

export default {
  input: "./src/index.tsx",
  context: "document",
  plugins,
  output: [
    {
      file: "./public/index.js",
      format: "iife",
      name: "test-app",
      sourcemap: true,
    },
  ],
}
