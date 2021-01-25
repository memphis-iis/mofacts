REM This file will always be for test machines as we assume development is done in a linux environment
echo on

if DEFINED VBOX_MSI_INSTALL_PATH (
  SET "VBoxManage=%VBOX_MSI_INSTALL_PATH%\VBoxManage.exe"
) ELSE (
  SET "VBoxManage=%VBOX_INSTALL_PATH%\VBoxManage.exe"
)

:createVM
echo "Creating Docker VM"
SET "mofactsDirectory=%CD%/mofacts"
docker-machine create --driver virtualbox --virtualbox-memory 4096 --virtualbox-share-folder "%mofactsDirectory%:mofacts" default
echo "Docker VM created"
EXIT /B 0


:startVM
echo "Starting Docker VM";
docker-machine start default;
echo "Docker VM started";
EXIT /B 0

:mountHostFiles
echo "Mounting mofacts files";
docker-machine ssh default "mkdir -p /home/docker/mofacts; mkdir -p /home/docker/data; sudo mount -t vboxsf mofacts /home/docker/mofacts;";
EXIT /B 0

:forwardPort {
echo "Fowarding port 3000";
FOR /F "tokens=* USEBACKQ" %%F IN (`VBoxManage showvminfo default | findstr "tcp-port3000"`) DO (
    SET portRuleExists=%%F
)
if "%portRuleExists%"=="" (
    "%VBoxManage%" controlvm "default" natpf1 "tcp-port3000,tcp,0.0.0.0,3000,,3000";
)
EXIT /B 0

:setUpTestVM
FOR /F "tokens=* USEBACKQ" %%F IN (`docker-machine status 2^>^&1`) DO (
    SET machineStatus=%%F
)

echo "%machineStatus%" | >nul findstr /i /r ".*command not found.*" || ( echo "docker-machine command not found, did you install Docker Toolbox?" & exit )
echo "%machineStatus%" | >nul findstr /i /r ".*Error.*" || ( echo "Docker VM not set up yet" & createVM & SET VM_NOT_RUNNING=1 )
echo "%machineStatus%" | >nul findstr /i /r ".*Stopped.*" || ( echo "Docker VM stopped" & startVM & SET VM_NOT_RUNNING=1 )
if "%VM_NOT_RUNNING%"=="1" (
    echo "Docker VM created and running"
)

call :mountHostFiles

call :forwardPort
EXIT /B 0

:runMofacts
echo "Starting up mofacts";
docker-compose up --build -d "$targetService" && docker-compose logs -f "$targetService";
EXIT /B 0

if "$1"=="" (
  echo "Usage: $0 [--dev|--prod1|--prod2] <up|down>"
  exit
)

echo "Test environment, running mofacts with docker-machine";

IF "%1"=="up" (
    call :setUpTestVM
    #Set env vars so that docker-compose command redirects to docker-machine VM
    eval $(docker-machine env default); 
    
    call :runMofacts
) ELSE IF "%1"=="down" (
    #Set env vars so that docker-compose command redirects to docker-machine VM
    eval $(docker-machine env default);

    docker-compose stop;

    docker-machine stop default;
) ELSE (
    echo "invalid option"
)

echo "Done"