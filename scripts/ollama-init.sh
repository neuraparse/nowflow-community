#!/bin/bash
# Ollama Model Initialization Script
# Downloads required embedding model on first start

set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
EMBEDDING_MODEL="nomic-embed-text"

echo "=== Ollama Model Initialization ==="
echo "Host: $OLLAMA_HOST"
echo "Model: $EMBEDDING_MODEL"

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
    echo "Ollama is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts - waiting..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "ERROR: Ollama not ready after $max_attempts attempts"
  exit 1
fi

# Check if model already exists
echo "Checking if $EMBEDDING_MODEL is already downloaded..."
if curl -s "$OLLAMA_HOST/api/tags" | grep -q "$EMBEDDING_MODEL"; then
  echo "Model $EMBEDDING_MODEL already exists!"
else
  echo "Downloading $EMBEDDING_MODEL model..."
  curl -s "$OLLAMA_HOST/api/pull" -d "{\"name\": \"$EMBEDDING_MODEL\"}" | while read -r line; do
    status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$status" ]; then
      echo "  $status"
    fi
  done
  echo "Model $EMBEDDING_MODEL downloaded successfully!"
fi

# Verify model is available
echo "Verifying model..."
if curl -s "$OLLAMA_HOST/api/tags" | grep -q "$EMBEDDING_MODEL"; then
  echo "✅ $EMBEDDING_MODEL is ready for embedding generation"
else
  echo "❌ ERROR: Model verification failed"
  exit 1
fi

echo "=== Ollama initialization complete ==="
