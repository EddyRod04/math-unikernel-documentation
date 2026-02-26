Quickstart Guide
================

This guide details how to set up the development environment from scratch, build the math unikernel, and run it using the project's custom shell scripts.

Phase 1: WSL Setup (Windows Users)
----------------------------------
If you are developing on Windows, you must use the Windows Subsystem for Linux (WSL) to compile the project.

1. Open PowerShell as Administrator.
2. Run the following command to install WSL and Ubuntu:
   
   .. code-block:: bash

      wsl --install

3. Restart your computer.
4. For this project we use the "Ubuntu" app from your Start Menu. Open it and create a UNIX username and password.

Phase 2: Prerequisites & Verification
-------------------------------------

1. Install System Packages
~~~~~~~~~~~~~~~~~~~~~~~~~~
Ensure your Ubuntu package manager is up to date, then install the required emulation and ISO generation tools.

.. code-block:: bash

   sudo apt update
   sudo apt install build-essential bison flex libgmp3-dev libmpc-dev libmpfr-dev texinfo \
                    xorriso mtools qemu-system-x86

2. Setup the Cross-Compiler
~~~~~~~~~~~~~~~~~~~~~~~~~~~
Ubuntu does not provide the required ``x86_64-elf-gcc`` compiler by default. We use a pre-built binary for this project. Run these commands to download it, make it executable, and permanently add it to your path:

.. code-block:: bash

   cd ~
   wget https://github.com/lordmilko/i686-elf-tools/releases/download/7.1.0/x86_64-elf-tools-linux.zip
   unzip x86_64-elf-tools-linux.zip -d ~/cross-compiler
   chmod +x ~/cross-compiler/bin/*
   echo 'export PATH="$HOME/cross-compiler/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc

3. Limine Bootloader Host Tool
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Our repository contains the internal bootloader files, but your host machine needs the ``limine`` executable utility to construct the ISO. Run this anywhere to install the tool globally:

.. code-block:: bash

   cd ~
   git clone https://github.com/limine-bootloader/limine.git --branch=v7.x-binary --depth=1
   make -C limine
   sudo cp limine/limine /usr/local/bin/

Phase 3: Build & Run Workflow
-----------------------------

First, download the source code:

.. code-block:: bash

   git clone https://github.com/lucasarabi/math-unikernel.git
   cd math-unikernel

We use a specific script-based workflow. Execute these in order:

**Step 1: Compile the Kernel**

.. code-block:: bash

   make

**Step 2: Build the ISO**
Packages the compiled kernel into a bootable image.

.. code-block:: bash

   ./build-iso.sh

**Step 3: Run in QEMU**
Launches the emulator in headless mode. Watch your terminal for the serial output from the unikernel.

.. code-block:: bash

   ./qemu.sh

**Cleaning Up**
To remove all compiled objects and the ISO file to start fresh:

.. code-block:: bash

   ./clean.sh


Troubleshooting Common Errors
-----------------------------

**make: x86_64-elf-gcc: Permission denied or Error 127**
Your cross-compiler has lost its executable permissions, or your terminal forgot the path due to a shell restart or environment change. Run these two commands in your project folder:

.. code-block:: bash

   chmod +x ~/cross-compiler/bin/*
   export PATH="$HOME/cross-compiler/bin:$PATH"