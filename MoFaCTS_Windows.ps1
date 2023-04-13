# Check if script is being run as administrator, otherwise ask for it
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warning "This script needs to be run as an administrator. Please run PowerShell as administrator and try again."
  Exit 1
}

# Check if Chocolatey is installed, otherwise install it
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
  Write-Host "Chocolatey is not installed. Installing Chocolatey..."
  Set-ExecutionPolicy Bypass -Scope Process -Force
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
  iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
}

# Check if Node.js 12 is installed, otherwise install it
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or ((node -v) -notlike "v12*")) {
  Write-Host "Node.js 12 is not installed. Installing Node.js 12..."
  choco install nodejs.install --version=12.22.7 -y
}

# Check if Meteor is installed, otherwise install it
if (-not (Test-Path "$env:LOCALAPPDATA\meteor\meteor.bat")) {
  Write-Host "Meteor is not installed. Installing Meteor..."
  Invoke-Expression (New-Object Net.WebClient).DownloadString('https://install.meteor.com/')
}

# Navigate to the ./mofacts folder
cd ./mofacts

#install meteor packages
meteor npm install

# Run the project
Write-Host "Running project..."
meteor run
