@echo off
:: Batch Script For Deploying MoFACTs on Windows Systems
:: Developed for IIS/University of Memphis by James Haner 
:: github: memphis-iis   dev github: @JRustyHaner
echo "MoFACTs Installer"
:: Dowlnoad dependecies, (git, vagrant)
echo "Creating Working Directory at C:\MoFACTs_Installer"
mkdir C:\MoFACTs_Installer
cd /B C:\MoFACTs_Installer
echo "Downloading Git"
start /B /wait bitsadmin /transfer myDownloadJob /download /priority normal https://github.com/git-for-windows/git/releases/download/v2.33.1.windows.1/Git-2.33.1-32-bit.exe C:\MoFACTs_Installer\git.exe
echo "Downloading Virtualbox"
start /B /wait bitsadmin /transfer myDownloadJob /download /priority normal https://download.virtualbox.org/virtualbox/6.1.28/VirtualBox-6.1.28-147628-Win.exe C:\MoFACTs_Installer\vbox.exe
echo "Downloading Vagrant"
start /B /wait bitsadmin /transfer myDownloadJob /download /priority normal https://releases.hashicorp.com/vagrant/2.2.18/vagrant_2.2.18_x86_64.msi C:\MoFACTs_Installer\vagrant.msi
:: Install dep[endencies
echo "Installing Git"
start /B /wait C:\MoFACTS_Installer\git.exe /VERYSILENT /NORESTART
echo "Installing Virtualbox"
:: start /B /wait C:\MoFACTS_Installer\vbox.exe /VERYSILENT /NORESTART
echo "Installing Vagrant"
start /B /wait msiexec /qn /i C:\MoFACTS_Installer\vagrant.msi
echo "Dependecies Installed"
:: Create working directory for mofacts
echo "Creating MoFACTs Install Directory"
mkdir C:\MoFACTs
cd /B C:\MoFACTs
:: Switch to github call below
:: "C:\Program Files (x86)\Git\bin\sh.exe" -l -i -c "http://"
"C:\Program Files (x86)\Git\bin\sh.exe" -login -i -c "/c/MoFACTs_Installer/mofacts-vagrant.sh"
exit

