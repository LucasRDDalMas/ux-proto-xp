SHELL := /bin/bash

PROJECTS_DIR := projects

PROJECT_ROOT_REPO := $(PROJECTS_DIR)/project-root-repo
PROTO_MONOREPO_REPO := $(PROJECTS_DIR)/proto-monorepo-repo

PROJECT_ROOT_URL := https://github.com/LucasRDDalMas/project-root.git
PROTO_MONOREPO_URL := https://github.com/LucasRDDalMas/proto-monorepo.git

.PHONY: sources source-project-root source-proto-monorepo

sources: source-project-root source-proto-monorepo
	@echo "All source repos are ready under $(PROJECTS_DIR)/"

source-project-root:
	@mkdir -p $(PROJECTS_DIR)
	@if [ -d "$(PROJECT_ROOT_REPO)/.git" ]; then \
		echo "Updating $(PROJECT_ROOT_REPO)"; \
		branch=$$(git -C $(PROJECT_ROOT_REPO) rev-parse --abbrev-ref HEAD); \
		if [ "$$branch" = "HEAD" ]; then branch=main; fi; \
		git -C $(PROJECT_ROOT_REPO) fetch origin; \
		git -C $(PROJECT_ROOT_REPO) pull --ff-only origin $$branch; \
	elif [ -d "$(PROJECT_ROOT_REPO)" ]; then \
		echo "Error: $(PROJECT_ROOT_REPO) exists but is not a Git repo."; \
		exit 1; \
	else \
		echo "Cloning $(PROJECT_ROOT_URL) -> $(PROJECT_ROOT_REPO)"; \
		git clone $(PROJECT_ROOT_URL) $(PROJECT_ROOT_REPO); \
	fi

source-proto-monorepo:
	@mkdir -p $(PROJECTS_DIR)
	@if [ -d "$(PROTO_MONOREPO_REPO)/.git" ]; then \
		echo "Updating $(PROTO_MONOREPO_REPO)"; \
		branch=$$(git -C $(PROTO_MONOREPO_REPO) rev-parse --abbrev-ref HEAD); \
		if [ "$$branch" = "HEAD" ]; then branch=main; fi; \
		git -C $(PROTO_MONOREPO_REPO) fetch origin; \
		git -C $(PROTO_MONOREPO_REPO) pull --ff-only origin $$branch; \
	elif [ -d "$(PROTO_MONOREPO_REPO)" ]; then \
		echo "Error: $(PROTO_MONOREPO_REPO) exists but is not a Git repo."; \
		exit 1; \
	else \
		echo "Cloning $(PROTO_MONOREPO_URL) -> $(PROTO_MONOREPO_REPO)"; \
		git clone $(PROTO_MONOREPO_URL) $(PROTO_MONOREPO_REPO); \
	fi
