import * as express from "express"
import * as path from "path"
import * as fs from "fs"
import { getFixtures } from "../../test/fixtures"
import assert from "assert"
import { build } from "estrella"

const app = express()
const port = 3000


build({
  entry: "./src/index.tsx",
  outfile: "./public/index.js",
  watch: true,
  bundle: true,
  debug: true,
  minify: false,
  sourcemap: true,
  sourcesContent: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.NODE_DEBUG": 'null',
    "global": "globalThis",
    "process.stderr.isTTY": "true",
    "process.stderr": "{}",
  },
})

app.use(express.json())

app.get("/fixtures", (_, res) => {
  res.send(getFixtures()).end()
})

app.post("/save-fixture", (req, res) => {
  const data: {
    basename: string
    content: string
  } = req.body

  fs.writeFileSync(path.resolve(__dirname, "../../fixtures", path.basename(data.basename)), data.content)

  res.send({ ok: true }).end()
})

app.use(express.static("public"))

app.listen(port, () => {
  console.log(`🌍  App listening at http://localhost:${port}`)
})
