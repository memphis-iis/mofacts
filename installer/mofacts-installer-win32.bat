:: MoFACTs Installer/Updater/Starter
:: Developed for IIS at the University of Memphis
@echo off
cls
echo MoFACTs-IIS Installer / Updater / Starter
echo Developed by IIS at The University of Memphis
echo Contact jrhaner@memphis.edu for support
if NOT exist C:\MoFACTs_Installer\ MKDIR C:\MoFACTs_Installer
CD C:\MoFACTs_Installer
if NOT exist C:\MoFACTs\ MKDIR C:\MoFACTs
echo downloading dependency files
cd C:\MoFACTS_Installer
:downloadvbox
echo checking if virtualbox is installed
reg query HKLM\SOFTWARE\Oracle\VirtualBox|findstr -si InstallDir
if %errorlevel%==0 GOTO:downloadvagrant
echo virtualbox is installing
if NOT exist C:\MoFACTS_Installer\vbox.exe START /W bitsadmin.exe /transfer "Virtualbox" https://download.virtualbox.org/virtualbox/6.1.28/VirtualBox-6.1.28-147628-Win.exe C:\MoFACTS_Installer\vbox.exe
C:\MoFACTS_Installer\vbox.exe --silent --ignore-reboot
:downloadvagrant
echo checking if vagrant is installed
vagrant -v 
if %errorlevel%==0 GOTO:downloadgit
echo vagrant is installing
if NOT exist C:\MoFACTS_Installer\vagrant.msi START /W bitsadmin.exe /transfer "Vagrant" https://releases.hashicorp.com/vagrant/2.2.19/vagrant_2.2.19_x86_64.msi C:\MoFACTS_Installer\vagrant.msi
msiexec /qn /i C:\MoFACTS_Installer\vagrant.msi /norestart
:downloadgit
echo checking if git is installed
git --version
if %errorlevel%==0 GOTO:delete
echo git is installing
if NOT exist C:\MoFACTS_Installer\gitinstall.exe START /W bitsadmin.exe /transfer "Git" https://github.com/git-for-windows/git/releases/download/v2.33.1.windows.1/Git-2.33.1-64-bit.exe C:\MoFACTS_Installer\gitinstall.exe
gitinstall.exe /VERYSILENT
:delete
echo cleaning up
if exist *.exe del *.exe
if exist *.msi del *.msi
:runvagrant
echo copying script to shortcut
copy C:\MoFACTS_Installer\* C:\MoFACTS\
copy C:\MoFACTS_Installer\mofacts-installer-win32.bat %userprofile%\Desktop\MoFACTs-IIS.bat
echo downloading vagrant script
if NOT exist C:\MoFACTS\mofacts-vagrant.sh start /W bitsadmin transfer "vagrant install script" https://raw.githubusercontent.com/memphis-iis/mofacts-ies/postgresMigration/installer/mofacts-vagrant.sh C:\MoFACTS\mofacts-vagrant.sh
echo handing off to vagrant
start "" "%SYSTEMDRIVE%\Program Files\Git\bin\sh.exe" --login -i -c "sh /c/MoFACTs/mofacts-vagrant.sh"
exit 0