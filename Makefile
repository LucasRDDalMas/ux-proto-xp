SHELL := /bin/bash

.PHONY: sources

sources:
	@node cli/src/runtime/sources.js
