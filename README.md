# vs-cupl README
## Features

![Preview](assets/images/vs-cupl-crete-project-2.gif)

- VS Project veiwer with functionality to automate build, convert, and deploy cupl code to CPLDs.
---
- Project Management
  - Create a project
  
  - Edit ``PLD`` file

  - Import `Cupl` (.PLD files) into projects

  - Configure project - define chip to program  

  - Open multiple Projects

  - View Pin Layout and signals for CPLD

- Code assistance

  - Double click pins on chip viewer to insert snippet

  - Snippet support for all keywords

  - Intellisense for logical signal type


- Deployment
  - Output window to show all ineractions with third party software

  - Prerequisite check to ensure all tools are installed and configured

  - Supports deployment paths to TL886+ for DIP and other 24 and 28 pin CPLDs and homebrew programmer for QFP chips.

  - Compile ``PLD`` to ``jed`` format

  ![Preview](assets/images/vs-cupl-compile.gif)

  - ## For **ATF15xx** family:

    - ATMISP to convert ``jed`` to ``svf`` format

    - Program ``svf`` file to an ISP homebrew ATF1500 family chip programmer

    ![Preview](assets/images/vs-cupl-deploy-openocd.gif)

  - ## For **ATF22/G16/G20/G22/V750** families:

    -Use minipro to deploy ``jed`` file to device

---


---
### **TESTED ON A LIMITED SET OF CPLDs (ATF1504AS, g20v10)**

---
## Workspace folders

Use VS Code workspace feature to keep your projects organized.
Structure should be

 - ```/workspace``` folder - when creating a project, use this folder as your root folder.

- ```/workspace/PROJECT1``` - creating a project named PROJECT1 would create the folder

- ```/workspace/PROJECT1\PROJECT1.pld``` - creating a project named PROJECT1 would create the default cupl file

> For multiple projects, the same root folder wiil have several project folders

- ```/workspace``` 

- ```/workspace/PROJECT1```

- ```/workspace/PROJECT1\PROJECT1.pld``` 

- ```/workspace/PROJECT2```

- ```/workspace/PROJECT2\PROJECT2.pld```


Save your Code Workspace file to the workspace folder.
This folder can represent one product that has seceral chips or projects.
- ```/workspace/my-widget-project.code-workspace``` 

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


# Extension Settings

This extension contributes the following settings:

*Can be configured in File > Preferences > Settings `` |`` Extensions > VS Cupl*

* `vs-cupl.PathWine`: Set wine binary path (default: /usr/bin/wine).
* `vs-cupl.OpenOCDPath`: Set OpenOCD binary path (default: /usr/bin/openocd).
* `vs-cupl.PathMinipro`: Set minipro binary path (default: /usr/bin/minipro).
* `vs-cupl.PathWinDrive`: Set Windows C:\ path (default: /home/user1/.wine/drive_c).
* `vs-cupl.PathCupl`: Cupl executable path relative to PathWine (default: Wincupl/Shared/ for c:\\Wincupl\\Shared\\cupl.exe)
* `vs-cupl.PathATMISP`: ATMISP executable path (default: ATMEL_PLS_Tools/ATMISP/ATMISP.exe)
* `vs-cupl.PathPof2Jed`: POF2JED executable path (default: c:\POF2JED\bin\POF2JED.exe)

* `vs-cupl.WinTempPath`: Temp path on C:\ drive (default: temp)
* `vs-cupl.DebugLevel`: Show Debug Level Messages
* `vs-cupl.CuplDefinitions`: Chose CUPL definition file (.dl) to use
* `vs-cupl.RunInIntegratedTerminal`: Chose if commands are executed in integrated terminal. *This option may cause unexpected behavior. Useful for debugging

*depricated*
* `vs-cupl.SetFolder`: Set working folder each time you execute a command in a terminal session.


---

## CUPL Language and toolchain

**Read more about [Cupl](https://ece-classes.usc.edu/ee459/library/documents/CUPL_Reference.pdf)**

---
## Known Issues

 - required additional testing on windows

 - would be good to have a guide step thrugh prerequisites

 - would be good to launch prerequisite check once on first start up automatically

---


### **Homebrew programmer for ATF15xx CPLDs**

https://github.com/hackup/ATF2FT232HQ

---
## Release Notes


![Preview](assets/images/vs-cupl-chip-viewer.gif)

See [Change Log](CHANGELOG.md) for changes in each version.

---

# For developers

## Requirements
You may need to install resolve-cwd npm package
```npm install resolve-cwd```

## To start developing

```
git clone https://github.com/levvayner/ATF15xx-cupl.git
cd ATF15xx-cupl
npm install
code .
```
This will open up the project in visual studio. You can press F5 to start debugging.



## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)


## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

