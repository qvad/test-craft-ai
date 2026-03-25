# TestCraft AI - Makefile

.PHONY: help install build dev test clean docker-up docker-down docker-logs docker-status docker-build docker-push k8s-deploy k8s-delete k8s-status

# Default registry
REGISTRY ?= testcraft
TAG ?= latest

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
install: ## Install all dependencies
	cd apps/api && npm install
	cd packages/shared-types && npm install
	npm install

dev: ## Start development servers
	cd apps/api && npm run dev

build: ## Build all packages
	cd packages/shared-types && npm run build
	cd apps/api && npm run build

test: ## Run tests
	cd apps/api && npm test

lint: ## Run linters
	cd apps/api && npm run lint

clean: ## Clean build artifacts
	rm -rf apps/api/dist
	rm -rf packages/shared-types/dist
	rm -rf node_modules
	rm -rf apps/api/node_modules
	rm -rf packages/shared-types/node_modules

# Docker Services
docker-up: ## Start database (YugabyteDB)
	docker-compose up -d yugabyte
	@echo "Waiting for YugabyteDB to be healthy..."
	@docker-compose exec -T yugabyte sh -c 'until ysqlsh -h localhost -p 5433 -U yugabyte -c "SELECT 1" 2>/dev/null; do sleep 2; done'
	@echo "✅ Database is ready at localhost:5433"
	@echo "📊 YugabyteDB UI: http://localhost:7000"

docker-down: ## Stop all services
	docker-compose down

docker-logs: ## Show service logs
	docker-compose logs -f

docker-status: ## Show running services
	docker-compose ps

# Docker Runner Images
docker-build: ## Build all runner Docker images
	@chmod +x ./scripts/build-runners.sh
	REGISTRY=$(REGISTRY) TAG=$(TAG) ./scripts/build-runners.sh

docker-build-%: ## Build a specific runner image (e.g., docker-build-java)
	@chmod +x ./scripts/build-runners.sh
	REGISTRY=$(REGISTRY) TAG=$(TAG) ./scripts/build-runners.sh $*

docker-push: ## Push all runner images to registry
	@chmod +x ./scripts/build-runners.sh
	REGISTRY=$(REGISTRY) TAG=$(TAG) PUSH=true ./scripts/build-runners.sh

# Kubernetes - Full Stack
k8s-up: ## Deploy full stack to K8s (UI + API + DB)
	@chmod +x ./scripts/k8s-deploy-all.sh
	./scripts/k8s-deploy-all.sh

k8s-rebuild: ## Rebuild and redeploy after code changes
	@chmod +x ./scripts/k8s-rebuild.sh
	./scripts/k8s-rebuild.sh

k8s-rebuild-api: ## Rebuild only API
	@chmod +x ./scripts/k8s-rebuild.sh
	./scripts/k8s-rebuild.sh api

k8s-rebuild-ui: ## Rebuild only UI
	@chmod +x ./scripts/k8s-rebuild.sh
	./scripts/k8s-rebuild.sh ui

k8s-down: ## Delete full stack from K8s
	kubectl delete namespace testcraft --ignore-not-found

k8s-status: ## Show K8s status
	@chmod +x ./scripts/k8s-status.sh
	./scripts/k8s-status.sh

k8s-logs-api: ## Show API logs
	kubectl -n testcraft logs -f deployment/api

k8s-logs-ui: ## Show UI logs
	kubectl -n testcraft logs -f deployment/ui

k8s-logs-db: ## Show YugabyteDB logs
	kubectl -n testcraft logs -f statefulset/yugabyte

# Kubernetes - Runners (legacy)
k8s-deploy-runners: ## Deploy test runners to Kubernetes
	@chmod +x ./scripts/deploy-k8s.sh
	./scripts/deploy-k8s.sh apply

k8s-delete-runners: ## Delete runners from Kubernetes
	@chmod +x ./scripts/deploy-k8s.sh
	./scripts/deploy-k8s.sh delete

k8s-logs-%: ## Show logs for a language runner (e.g., k8s-logs-java)
	@chmod +x ./scripts/deploy-k8s.sh
	./scripts/deploy-k8s.sh logs $*

# Testing
test-runner-%: ## Test a specific language runner locally
	@echo "Testing $(*)  runner..."
	docker run --rm -i $(REGISTRY)/runner-$(*):$(TAG) < tests/samples/$(*).txt

# Full deployment
deploy: docker-build k8s-deploy ## Full deployment (build images + deploy to k8s)
	@echo "Deployment complete!"

# Development with kind/minikube
kind-load: docker-build ## Load images into kind cluster
	@for lang in java python csharp javascript typescript go rust ruby php kotlin; do \
		kind load docker-image $(REGISTRY)/runner-$$lang:$(TAG) || true; \
	done

minikube-load: docker-build ## Load images into minikube
	@eval $$(minikube docker-env) && $(MAKE) docker-build

# Node Type Testing
test-smoke: ## Run smoke tests for node types
	npm run test:smoke

test-nodes: ## Run all node type tests
	npm run test:full

test-samplers: ## Run sampler node tests (HTTP, JDBC, etc.)
	npm run test:samplers

test-controllers: ## Run controller node tests
	npm run test:controllers

test-assertions: ## Run assertion node tests
	npm run test:assertions

test-http: ## Run HTTP request tests only
	npm run test:http

# K8s Test Runner
k8s-test: k8s-rebuild-api ## Run tests against K8s deployment
	@echo "Running node tests against K8s deployment..."
	API_URL=http://testcraft.local/api/v1 npm run test:full

k8s-test-smoke: ## Quick smoke test against K8s
	API_URL=http://testcraft.local/api/v1 npm run test:smoke

# Production Builds
build-all: build-ui build-api build-cli ## Build all components for production

build-ui: ## Build Angular UI for production
	npm run build -- --configuration=production

build-api: ## Build API for production
	cd apps/api && npm run build

build-cli: ## Build CLI tool
	cd apps/cli && npm install && npm run build

# CLI
cli-run: ## Run CLI in development mode
	cd apps/cli && npm run dev -- run tests/sample-plan.json

cli-install: ## Install CLI globally (requires build first)
	cd apps/cli && npm link

# Release
release-docker: docker-build docker-push ## Build and push Docker images

release-npm: build-cli ## Publish CLI to npm
	cd packages/cli && npm publish --access public

release: release-docker ## Full release (Docker images)
	@echo "Release complete!"

# RAG Operations
rag-export: ## Export RAG knowledge base
	curl -s http://localhost:3000/api/v1/ai/rag/export > rag-backup.json
	@echo "Exported to rag-backup.json"

rag-import: ## Import RAG knowledge base from rag-backup.json
	curl -X POST -H "Content-Type: application/json" \
		-d @rag-backup.json \
		"http://localhost:3000/api/v1/ai/rag/import?overwrite=true"

rag-stats: ## Show RAG statistics
	curl -s http://localhost:3000/api/v1/ai/rag/stats | python3 -m json.tool

# CI/CD
ci-test: ## Run all tests for CI
	cd apps/api && npm test -- --run
	npm run test -- --no-watch --browsers=ChromeHeadless || true

ci-lint: ## Run linters for CI
	cd apps/api && npm run lint || true

ci-build: build-api build-ui ## Build for CI

# Health Checks
health-check: ## Check all services health
	@echo "Checking API..."
	@curl -s http://localhost:3000/health || echo "API not responding"
	@echo "\nChecking YugabyteDB..."
	@docker-compose exec -T yugabyte ysqlsh -h localhost -p 5433 -U yugabyte -c "SELECT 1" 2>/dev/null || echo "DB not responding"

# Utilities
logs: ## Show all logs
	docker-compose logs -f api yugabyte

format: ## Format code
	npx prettier --write "src/**/*.ts" "apps/**/*.ts"

version: ## Show versions
	@echo "Node: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@echo "Docker: $$(docker --version)"
	@echo "kubectl: $$(kubectl version --client --short 2>/dev/null || echo 'not installed')"
