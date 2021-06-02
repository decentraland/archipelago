
WEBAPP_SOURCES := $(wildcard test-app/**/*.ts)
WEBAPP_SOURCES_TSX := $(wildcard test-app/**/*.tsx)

#ifneq ($(CI), true)
LOCAL_ARG = --local --verbose --diagnostics # for now we don't want to fail in CI on warnings because we won't be releasing this anytime soon.
#endif

test: build
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha $(TESTARGS)

test-watch: build
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha --watch $(TESTARGS)

build:
	./node_modules/.bin/tsc -p tsconfig.json
	rm -rf node_modules/@microsoft/api-extractor/node_modules/typescript || true
	./node_modules/.bin/api-extractor run $(LOCAL_ARG) --typescript-compiler-folder ./node_modules/typescript

benchmark: build
	./node_modules/.bin/ts-node benchmark/simple.ts

node_modules:
	npm ci
	@cd test-app; npm ci

start: node_modules
	@cd test-app; ./node_modules/.bin/ts-node server/index.ts

.PHONY: build test start