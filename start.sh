#!/bin/bash
# Start the SIS dev server with environment variables loaded
cd "$(dirname "$0")"
export $(cat .env.local | xargs)
npx next dev --port 3001
