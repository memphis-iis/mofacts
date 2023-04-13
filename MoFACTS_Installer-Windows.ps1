# Check if Chocolatey is installed
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Chocolatey is not installed. Installing..."
    Set-ExecutionPolicy Bypass -Scope Process -Force;
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
}

# Set the name of your Meteor app
$appName = "mofacts"

# Set the version of Node.js to use
$nodeVersion = "12"

# Check if Meteor is installed
if (-not (Get-Command meteor -ErrorAction SilentlyContinue)) {
    Write-Host "Meteor is not installed. Installing..."
    & "choco.exe" install meteor -y
}

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed. Installing..."
    & "choco.exe" install docker-desktop -y
}

# Navigate to the root directory of your Meteor app
cd ".\mofacts"

# Install the necessary Meteor packages
meteor npm install

# Set the Node.js version to use
meteor npm install --save-dev node@12

# Build the Meteor app
meteor build --architecture=os.linux.x86_64 ../build

# Extract the contents of the .tar.gz file
tar -xzf ../build/$appName.tar.gz -C ../build

# Build the Docker image
docker build -t $appName:latest ../build

# Run the Docker container
docker run -p 3000:3000 $appName:latest &

# Launch the app in the default browser
Start-Process -FilePath "http://localhost:3000"