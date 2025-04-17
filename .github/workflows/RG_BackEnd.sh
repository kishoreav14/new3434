#!/bin/bash

# Stop on error
set -e

# Define where your project is located
DEPLOY_DIR="/root/RG_Backend"

# Update package list
#sudo apt-get update

# SSH User and Host where the application is deployed
SSH_USER="ubuntu"
SSH_HOST="$HOST"
GITHUB_TOKEN="$GIT"

# Git repository URL (use HTTPS with your personal access token)
REPO_URL="https://TTH-Dev:"$GITHUB_TOKEN"@github.com/TTH-Dev/RG_Backend.git"

# Pull the latest code on the remote machine using SSH
echo "Pulling latest changes from GitHub..."
ssh -i "~/.ssh/id_rsa" "$SSH_USER"@"$SSH_HOST" << EOF
  sudo -i
  cd $DEPLOY_DIR || exit
  git pull $REPO_URL main || exit

  # Install dependencies
  echo "Install yarn packages..."
  yarn install || exit
  echo "Install Completed"

  # Reload Daemon process
  sudo systemctl daemon-reload
  echo "Reload Daemon process Successfully!..."

  # Restart the systemd service
  sudo systemctl restart RG_Backend.service || exit
  echo "RG_Backend Service Restart Successfully!"

  # Restart the Nginx Service
  sudo systemctl restart nginx || exit
  echo "Nginx Restart Successfully!"
EOF

echo "Deployment finished successfully!!!!!"
