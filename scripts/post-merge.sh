#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Database migrations are an explicit release step; merging must not change data.
