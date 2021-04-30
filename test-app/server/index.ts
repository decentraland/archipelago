import * as express from "express"
import * as rollup from "rollup"
import * as path from "path"
const loadConfigFile = require("rollup/dist/loadConfigFile")

const app = express()
const port = 3000

// load the config file next to the current script;
// the provided config object has the same effect as passing "--format es"
// on the command line and will override the format of all outputs
loadConfigFile(path.resolve(__dirname, "../rollup.config.js"), { format: "es" }).then(async ({ options, warnings }: any) => {
  // "warnings" wraps the default `onwarn` handler passed by the CLI.
  // This prints all warnings up to this point:
  console.log(`We currently have ${warnings.count} warnings`)

  // This prints all deferred warnings
  warnings.flush()

  // You can also pass this directly to "rollup.watch"
  rollup.watch(options)
})

app.use(express.static("public"))

app.listen(port, () => {
  console.log(`🌍  App listening at http://localhost:${port}`)
})
