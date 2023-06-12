set PATH=%PATH%;C:\Users\ppavl\AppData\Local\Programs\Git\usr\bin
cd C:\Users\ppavl\Dropbox\Active projects\mofacts
vagrant up
vagrant ssh
cd mofacts/mofacts
meteor build ./build --architecture os.linux.x86_64
scp -i "C:/Users/ppavl/Dropbox/Documents - Academic/awsSCPkey" mofacts/build/mofacts.tar.gz ppavlik@mofacts.optimallearning.org:/var/www/mofacts



:: then go to server and deploy from mofacts
