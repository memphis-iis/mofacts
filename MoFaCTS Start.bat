set PATH=%PATH%;C:\Program Files (x86)\Git\bin
cd C:\Users\ppavlik\Documents\NetBeansProjects\mofacts
vagrant halt
vagrant up
vagrant ssh -c 'cd mofacts/mofacts; ./run_meteor'
pause