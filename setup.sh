#!/bin/bash

#dependencies: git-2.43.0+, npm-10.9.2+, jq-1.7+, date-9.4+

APP_NAME=$(jq -r '.name' package.json)
APP_VERSION=$(jq -r '.version' package.json)
APP_GIT_COMMIT=$(git rev-parse HEAD)
APP_BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

APP_JSON=$(
    printf '{
        "application": "%s",
        "version": "%s",
        "commit": "%s",
        "buildTime": "%s"
    }\n' "$APP_NAME" "$APP_VERSION" "$APP_GIT_COMMIT" "$APP_BUILD_DATE"
)

echo "$APP_JSON" | jq '.' >./src/version.json
echo "[$APP_BUILD_DATE] Building application: $APP_NAME-$APP_VERSION, commit: $APP_GIT_COMMIT"
