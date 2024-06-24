#!/bin/bash


# Get Git information with descriptive messages
echo "** Retrieving Git information..."
COMMIT_ID=$(git rev-parse HEAD)
echo "  - Commit ID: $COMMIT_ID"
BUILD_TIMESTAMP=$(date +"%A %Y-%m-%d")
echo "  - Build Timestamp: $BUILD_TIMESTAMP"
BUILDER_USERNAME=$(git config user.name)
echo "  - Builder Username: $BUILDER_USERNAME"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)  # Use git rev-parse for branch name
echo "  - Branch: $CURRENT_BRANCH"
REPO_URL=$(git config --get remote.origin.url)
echo "  - Repository URL: $REPO_URL"

# Get the last 5 commit messages
COMMIT_MESSAGES=$(git log --pretty=format:"%s" -n 5 HEAD | sed 's/\n//g')

#remove newlines from commit messages
COMMIT_MESSAGES=$(echo $COMMIT_MESSAGES | tr -d '\n')

# Create a release on GitHub with datestamp (vYYYY-MM-DD-HH-MM-SS)
RELEASE_NAME="v$(date +"%Y-%m-%d-%H-%M-%S")-$CURRENT_BRANCH-autobuild"
RELEASE_BODY="Built and pushed image for branch: $CURRENT_BRANCH \n Last 5 Commit Messages: \n $COMMIT_MESSAGES"

# Construct the JSON data
echo "** Constructing JSON data..."
JSON_DATA="{
  \"commitID\": \"$COMMIT_ID\",
  \"buildTimestamp\": \"$BUILD_TIMESTAMP\",
  \"buildersUsername\": \"$BUILDER_USERNAME\",
  \"branch\": \"$CURRENT_BRANCH\",
  \"repoURL\": \"$REPO_URL\",
  \"last5commitMessages\": \"$COMMIT_MESSAGES\",
  \"releaseName\": \"$RELEASE_NAME\"
}"
echo "  - JSON Data: $JSON_DATA"

# Save the JSON data to the file
echo "** Saving JSON data to file..."
#create the private directory if it doesn't exist
mkdir -p ../private
echo "$JSON_DATA" > ../private/versionInfo.json

# Make a Session.set command with the json data in ../client/views/versionInfo.js
echo "** Making a Session.set command with the JSON data..."
echo "Session.set('versionInfo', $JSON_DATA);" > ../client/views/versionInfo.js
echo "  - Session.set command created"

# Update the docker-compose.yml tag
echo "** Updating docker-compose.yml tag... to $CURRENT_BRANCH"
sed -i "s/image: iisdevs\/mofacts-mini:main/image: iisdevs\/mofacts-mini:$CURRENT_BRANCH/g" ./docker-compose.yml
echo "  - Updated docker-compose.yml tag to $CURRENT_BRANCH"


#get the github token from the environment, if it exists
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set, please enter your GitHub token:"
  read GITHUB_TOKEN
  export GITHUB_TOKEN
fi


# Tag the commit with the release name
echo "** Tagging the commit with the release name: $RELEASE_NAME"
git tag -a $RELEASE_NAME -m "Autobuild release for branch: $CURRENT_BRANCH"
git push origin https://$BUILDER_USERNAME:$GITHUB_TOKEN.com/$REPO_URL $RELEASE_NAME
echo "  - Tagged the commit with the release name: $RELEASE_NAME"


# Create a release on GitHub
echo "** Creating a release on GitHub, Release Name: $RELEASE_NAME" 
curl -sSL -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.v3+json" -X POST https://api.github.com/repos/memphis-iis/mofacts/releases -d "{\"tag_name\": \"$RELEASE_NAME\", \"name\": \"$RELEASE_NAME\", \"body\": \"$RELEASE_BODY\"}"
echo "  - Release created on GitHub"

# Clean up the local docker cache
#ask the user if they want to clean up the local docker cache
echo "Do you want to clean up the local docker cache? (y/n)"
read CLEANUP
if [ "$CLEANUP" == "y" ]; then
  echo "** Cleaning up the local docker cache..."
  docker system prune -a
  echo "  - Local docker cache cleaned up"
fi


# Build and push the image
echo "** Building Docker image..."
docker login
docker-compose build mofacts
docker-compose push mofacts
echo "** Build and push completed for tag: $TAG"













