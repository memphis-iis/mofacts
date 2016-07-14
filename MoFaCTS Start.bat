set PATH=%PATH%;C:\Users\ppavl\AppData\Local\Programs\Git\usr\bin
cd C:\Users\ppavl\Documents\NetBeansProjects\mofacts
vagrant up
vagrant ssh -c 'cd mofacts/mofacts; ./run_meteor'
pause