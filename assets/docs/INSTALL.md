# These are depricated instructions. They may still be useful for troubleshooting tool-chain installtion issues.

The newer versions of VS Cupl include a walkthrough to help you install your tool chain.
Windows based installations use WSL in lue of MSYS2

---


# Installation (Linux)

## Requirements
### **Wine**
```sudo apt update```

```sudo apt install wine64```

#### Updated winetricks
```sudo winetricks --self-update```


#### Wine must have MFC42.DLL installed
```./winetricks mfc40```

```./winetricks mfc42```

### Download and copy to wine windows folder
>[Dwsbc32.ocx](assets/bin/Dwsbc32.ocx) to ~/[winePrefix]/drive_c/windows/system32

>[ftd2xx.dll](assets/bin/ftd2xx.dll) to ~/[winePrefix]/drive_c/windows/syswow64

### **Prochip 5.0.1**
Need to have Atmel ProChip (5.0.1) installed [Download ProChip 5.0.1](https://www.microchip.com/prochiplicensing/#/)
### **ATMISP**
  Need to have Atmel ATMISP (v7.3) [Download ATMISP](http://ww1.microchip.com/downloads/en/DeviceDoc/ATMISP7.zip)
  Need to have FTD2xx.dll file in ATMISP folder

### **WinCUPL**
[Download WinCUPL](https://www.microchip.com/en-us/products/fpgas-and-plds/spld-cplds/pld-design-resources)

### **Minipro**
  Used for programming jed files using TL866II programmer
```shell
sudo apt-get install build-essential pkg-config git libusb-1.0-0-dev fakeroot debhelper dpkg-dev

git clone https://gitlab.com/DavidGriffith/minipro.git

cd minipro

fakeroot dpkg-buildpackage -b -us -uc

sudo dpkg -i ../minipro_0.4-1_amd64.deb
```
---

# Installtion (Windows)
### **Prochip 5.0.1**
Need to have Atmel ProChip (5.0.1) installed [Download ProChip 5.0.1](https://www.microchip.com/prochiplicensing/#/)
### **ATMISP**
  Need to have Atmel ATMISP (v7.3) [Download ATMISP](http://ww1.microchip.com/downloads/en/DeviceDoc/ATMISP7.zip)
  Need to have FTD2xx.dll file in ATMISP folder

### **WinCUPL**
[Download WinCUPL](https://www.microchip.com/en-us/products/fpgas-and-plds/spld-cplds/pld-design-resources)

 Additional considerations for cupl
 > Register directory with fitters (in administrative command prompt)

 ```
  @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('path',\"c:\Wincupl\WinCupl\Fitters;$([Environment]::GetEnvironmentVariable('path','Machine'))\",'Machine');"
 ```
 ### **OpenOCD** 

 Download [OpenOCD](https://github.com/xpack-dev-tools/openocd-xpack/releases)
 - Download and extract to path (C:\Programs\openocd)
 - Execute in Administrative command window
 ```
 @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('path',\"C:\Programs\openocd\bin;$([Environment]::GetEnvironmentVariable('path','Machine'))\",'Machine');"
 ```
 ### **minipro** 

Download [minipro](https://gitlab.com/DavidGriffith/minipro.git)

Install MSYS2 from here: [MSYS2](https://www.msys2.org/)
### **In msys2 terminal**
```
pacman -S mingw-w64-ucrt-x86_64-gcc
pacman -S make
pacman -S pkg-config
pacman -S git
pacman -S gcc

git clone https://gitlab.com/DavidGriffith/minipro.git
cd minipro



make
```

## ***IF** make fails*

```
#fix errors preventing compilation
echo -e '#include "minipro.h" \n#include "version.h"' > version.c
echo -e '#define VERSION "0.6"\n#ifndef GIT_DATE\n\t#define GIT_DATE "01/01/2001"\n#endif\n#ifndef GIT_BRANCH\n\t#define GIT_BRANCH "main"\n#endif\n#ifndef  GIT_HASH\n\t#define GIT_HASH "blahblahblah"\n#endif' > version.h
```


cd c:\\msys64\\home\\%USERNAME%\\minipro
SETX PATH=%PATH%;%cd%;

### **In an *elevated* command prompt(NOT MSYS2)**


cd [path of where minipro build saved minipro.exe]

e.g.

```

cd c:\\msys64\\home\\%USERNAME%\\minipro

SETX PATH=%PATH%;%cd%;C:\\msys64\\usr\\bin

```
or
 ```
 @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('path',\""C:\msys64\usr\bin;C:\msys64\home\\minipro;$([Environment]::GetEnvironmentVariable('path','Machine'))\",'Machine');"
 ```
### **VS Code must be restarted after updating these paths**
---
</br>
</br>
