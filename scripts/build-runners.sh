#!/bin/bash
set -e

# Build all runner Docker images
# Usage: ./scripts/build-runners.sh [language]

REGISTRY="${REGISTRY:-testcraft}"
TAG="${TAG:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

LANGUAGES=(java python csharp javascript typescript go rust ruby php kotlin)

build_image() {
    local lang=$1
    echo "=========================================="
    echo "Building ${lang} runner image..."
    echo "=========================================="

    docker build \
        -t "${REGISTRY}/runner-${lang}:${TAG}" \
        -f "${PROJECT_ROOT}/docker/runners/${lang}/Dockerfile" \
        "${PROJECT_ROOT}/docker/runners/${lang}"

    echo "Successfully built ${REGISTRY}/runner-${lang}:${TAG}"
}

push_image() {
    local lang=$1
    echo "Pushing ${REGISTRY}/runner-${lang}:${TAG}..."
    docker push "${REGISTRY}/runner-${lang}:${TAG}"
}

# If a specific language is provided, build only that
if [ -n "$1" ]; then
    if [[ " ${LANGUAGES[*]} " =~ " $1 " ]]; then
        build_image "$1"
        if [ "$PUSH" = "true" ]; then
            push_image "$1"
        fi
    else
        echo "Unknown language: $1"
        echo "Supported languages: ${LANGUAGES[*]}"
        exit 1
    fi
else
    # Build all images
    for lang in "${LANGUAGES[@]}"; do
        build_image "$lang"
    done

    if [ "$PUSH" = "true" ]; then
        for lang in "${LANGUAGES[@]}"; do
            push_image "$lang"
        done
    fi
fi

echo ""
echo "=========================================="
echo "Build complete!"
echo "=========================================="
echo ""
echo "To push images to registry, run:"
echo "  PUSH=true ./scripts/build-runners.sh"
echo ""
echo "To use a different registry:"
echo "  REGISTRY=your-registry ./scripts/build-runners.sh"
