
WEBAPP_SOURCES := $(wildcard test-app/**/*.ts)
WEBAPP_SOURCES_TSX := $(wildcard test-app/**/*.tsx)

ifneq ($(CI), true)
LOCAL_ARG = --local --verbose --diagnostics
endif

test:
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha

test-watch:
	TS_NODE_PROJECT=test/tsconfig.json ./node_modules/.bin/mocha --watch

build:
	./node_modules/.bin/tsc -p tsconfig.json
	rm -rf node_modules/@microsoft/api-extractor/node_modules/typescript || true
	./node_modules/.bin/api-extractor run $(LOCAL_ARG) --typescript-compiler-folder ./node_modules/typescript

node_modules:
	npm ci
	@cd test-app; npm ci

start: node_modules
	@cd test-app; ./node_modules/.bin/ts-node server/index.ts

.PHONY: build test start