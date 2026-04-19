#!/bin/bash

echo "Checking if Vercel build should proceed..."

# Exit 1 = proceed with build, Exit 0 = skip build
# https://vercel.com/docs/projects/overview#ignored-build-step

check_diff() {
  git diff HEAD^ HEAD --quiet -- "$@"
}

# Check website folder
if ! check_diff ./website; then
  echo "Changes detected in website/ — proceeding with build."
  exit 1
fi

# Check Vercel config
if ! check_diff ./vercel.json; then
  echo "Changes detected in vercel.json — proceeding with build."
  exit 1
fi

echo "No relevant changes detected — skipping build."
exit 0
