set PATH=%PATH%;C:\Users\ppavlik\AppData\Local\Programs\Git\usr\bin
cd C:\Users\ppavlik\Documents\NetBeansProjects\MoFaCTS
vagrant up
vagrant ssh -c "cd mofacts/mofacts; meteor build ./build --architecture os.linux.x86_64"
scp -i "C:/Users/ppavlik/Dropbox/Documents - Academic/awsSCPkey" mofacts/build/mofacts.tar.gz ppavlik@mofacts.optimallearning.org:/var/www/mofacts 
pause


:: then go to server and deploy from mofacts
