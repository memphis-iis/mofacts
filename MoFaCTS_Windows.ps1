  # Check if the script is running as admin and re-launch it as admin if it's not
  if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
      Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoExit', '-Command', $PSCommandPath)
      exit
  }

  # Check if WSL2 is installed and install it if not
  if (!(Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux).State -eq 'Enabled') {
      Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
      Write-Host "Please restart your computer and run this script again."
      return
  }

  # Check if Ubuntu 20.04 is installed and install it if not
  $ubuntuAppName = "CanonicalGroupLimited.Ubuntu20.04onWindows"
  if (-not (Get-AppxPackage -Name $ubuntuAppName -ErrorAction SilentlyContinue)) {
      Invoke-WebRequest -Uri https://aka.ms/wslubuntu2004 -OutFile Ubuntu.appx -UseBasicParsing
      Add-AppxPackage .\Ubuntu.appx
      Remove-Item .\Ubuntu.appx
  }

  # Open a new PowerShell instance and execute the script inside the Ubuntu shell
  $wslPath = (Get-AppxPackage -Name $ubuntuAppName).InstallLocation + "\ubuntu2004.exe"
  Start-Process $wslPath -ArgumentList "pwsh.exe -NoExit -Command `"$($PSCommandPath -replace "'", "''")`"" -Wait


  
  # Inside the Ubuntu shell, install Docker
  bash -c "curl -fsSL https://get.docker.com -o get-docker.sh"
  bash -c "sudo sh get-docker.sh"
  bash -c "sudo service docker start"

  # Install Docker Compose
  bash -c "sudo apt-get install -y libffi-dev libssl-dev"

  # Inside the Ubuntu shell, install Node.js 12.x
  bash -c "curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -"
  bash -c "sudo apt-get install -y nodejs"

  # Inside the Ubuntu shell, install Meteor 1.12.x with npm
  bash -c "sudo npm install -g meteor@1.12"

  # Inside the Ubuntu shell, install Meteor Up and Mup Docker Deploy using npm
  bash -c "sudo npm install -g mup mup-docker-deploy"

  #use wslpath to convert the scripts path to the Linux path  
  $wslpath = bash.exe -c "wslpath -u '$(Get-Location)'"

  #mount the windows wsl path to the Linux path /mofacts
  bash -c "sudo mkdir /mofacts"
  bash -c "sudo mount --bind $wslpath /mofacts"
  
  #use bash to cd to /mofacts/mofacts and run docker build and docker-compose up
  bash -c "cd /mofacts/mofacts && sudo docker build -t mofacts ."
