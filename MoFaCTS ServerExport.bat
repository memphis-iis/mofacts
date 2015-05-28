set PATH=%PATH%;C:\Program Files (x86)\Git\bin
cd C:\Users\ppavlik\Documents\NetBeansProjects\mofacts
vagrant up
vagrant ssh -c "cd mofacts/mofacts; meteor bundle mofacts.tar.gz; scp mofacts.tar.gz ppavlik@optimallearning.org:/var/www/mofacts"
pause