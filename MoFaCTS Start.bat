set PATH=%PATH%;C:\Users\ppavlik\AppData\Local\Programs\Git\usr\bin
cd C:\Users\ppavlik\Documents\NetBeansProjects\MoFaCTS
vagrant up
vagrant ssh -c 'cd mofacts/mofacts; ./run_meteor'
pause