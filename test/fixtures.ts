import glob = require("glob")
import path = require("path")
import fs = require("fs")

export function getFixtures() {
  return glob.sync(path.resolve(__dirname, `../fixtures/*.clj`), { absolute: true }).map(($) => {
    return {
      path: $,
      basename: path.basename($),
      content: fs.readFileSync($).toString(),
    }
  })
}
