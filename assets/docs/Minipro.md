# Minipro Installation

Minipro is a tool to program many different PLDs using TL866II programmer.
- It requires MSYS2 or WSL (Windows Subsystem for Linux) to be installed on Windows. 
- It can be used to program .jed files to many PLDs.

## To install Minipro, follow these steps

```shell
sudo apt-get install build-essential pkg-config git libusb-1.0-0-dev fakeroot debhelper dpkg-dev

git clone https://gitlab.com/DavidGriffith/minipro.git

cd minipro

fakeroot dpkg-buildpackage -b -us -uc

sudo dpkg -i ../minipro_0.4-1_amd64.deb
```

_Read more on [Github](https://gitlab.com/DavidGriffith/minipro)_
