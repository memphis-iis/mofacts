#!/bin/bash
# Meteor 2.0 Upgrade - Docker Image Backup Script
# Purpose: Create a backup of the current working Docker image before upgrade
# Date: January 2025

echo "=========================================="
echo "Meteor 2.0 Upgrade - Docker Image Backup"
echo "=========================================="
echo ""

# Configuration
CURRENT_IMAGE="ppavlikmemphis/mofacts-mini:upgrades"
BACKUP_TAG="ppavlikmemphis/mofacts-mini:pre-2.0-meteor-1.12-backup"

echo "Current image: $CURRENT_IMAGE"
echo "Backup tag: $BACKUP_TAG"
echo ""

# Step 1: Pull current image
echo "Step 1: Pulling current working image..."
docker pull $CURRENT_IMAGE

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to pull current image"
    exit 1
fi
echo "✓ Current image pulled successfully"
echo ""

# Step 2: Tag as backup
echo "Step 2: Creating backup tag..."
docker tag $CURRENT_IMAGE $BACKUP_TAG

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create backup tag"
    exit 1
fi
echo "✓ Backup tag created successfully"
echo ""

# Step 3: Push backup to Docker Hub
echo "Step 3: Pushing backup to Docker Hub..."
echo "(This may take a few minutes...)"
docker push $BACKUP_TAG

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to push backup to Docker Hub"
    echo "Make sure you're logged in: docker login"
    exit 1
fi
echo "✓ Backup pushed to Docker Hub successfully"
echo ""

# Verify
echo "=========================================="
echo "Backup Complete!"
echo "=========================================="
echo ""
echo "Backup image: $BACKUP_TAG"
echo ""
echo "To verify the backup exists:"
echo "  docker images | grep pre-2.0"
echo ""
echo "To rollback if needed (on server):"
echo "  1. Edit docker-compose.yml:"
echo "     image: $BACKUP_TAG"
echo "  2. sudo docker compose pull"
echo "  3. sudo docker compose down"
echo "  4. sudo docker compose up -d"
echo ""
echo "You can now proceed with the Meteor 2.0 upgrade!"
echo "See: docs_dev/METEOR_2.0_UPGRADE_GUIDE.md"
echo ""
