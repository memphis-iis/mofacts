echo MoFACTs-IIS Installer / Updater / Starter
echo Developed by IIS at The University of Memphis
echo Contact jrhaner@memphis.edu or rawhite2@memphis.edu for support
echo "Deleting Install Directory if it exists."
rm -f /c/MoFACTs_Installer
echo "Reticulating Splines."
if [ ! -d "/c/MoFACTs_Installer" ]
then 
    rm -f /c/MoFACTs_Installer
fi
echo "Downloading newest version of mofacts."
cd /c/MoFACTs
if [ ! -d "/c/MoFACTs/mofacts-ies" ] 
then
    echo "downloading MoFACTs"
    git clone https://github.com/memphis-iis/mofacts-ies.git
fi
echo "checking for updates"
cd /c/MoFACTs/mofacts-ies/
git fetch origin
echo "starting vagrant box"
vagrant up
echo "starting the browser interface in 2 minutes. Don't panic. This takes several minutes to happen. Don't touch the browser until it loads MoFACTs."
sleep 120 && start http://localhost:3000 &
vagrant ssh -c 'sh ./mofacts/mofacts-autostart.sh'  > /dev/null 2>&1
read -p "Press any key to close MoFACTs."
echo "closing mofacts server. goodbye :)"
vagrant halt