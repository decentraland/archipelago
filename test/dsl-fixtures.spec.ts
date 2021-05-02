import glob = require("glob")
import path = require("path")
import fs = require("fs")
import { parseTestSuite } from "./runner"
import expectExport = require("expect")
import { BaseClosure } from "./dsl/stdlib"

describe("File based tests", () => {
  glob.sync(path.resolve(__dirname, `../fixtures/*.clj`), { absolute: true }).forEach(testFile)
})

function testFile(file: string) {
  const content = fs.readFileSync(file).toString()
  const suite = parseTestSuite(content)
  const closure = new BaseClosure()

  describe(path.basename(file), () => {
    it("the file has no errors", () => {
      expectExport(suite.errors.length).toEqual(0)
    })

    for (let step of suite.steps) {
      it(step.node.text.trim().replace(/\s*\r?\n\r?\s*/gm, ' '), async () => {
        await step(closure)
      })
    }
  })
}
