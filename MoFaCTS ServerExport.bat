set PATH=%PATH%;C:\Program Files (x86)\Git\bin
cd C:\Users\ppavlik\Documents\NetBeansProjects\mofacts\mofacts
vagrant up
vagrant ssh -c "cd mofacts/mofacts; meteor build ./build --architecture os.linux.x86_64"
scp build/mofacts.tar.gz ppavlik@optimallearning.org:/var/www/mofacts
pause


:: then go to server and deploy from mofacts
