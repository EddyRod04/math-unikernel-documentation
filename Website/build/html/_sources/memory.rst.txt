=================
MEMORY MANAGEMENT
=================

pmm.c (Physical Memory Manager)
-------------------------------
Overview
~~~~~~~~
The Physical Memory Manager (PMM) is responsible for keeping track of the actual, raw hardware RAM available to the system. It uses a bitmap data structure to represent the entire physical memory space, where each bit corresponds to a single 4KB frame of memory. If a bit is 1, the frame is in use; if it is 0, the frame is free. The PMM does not deal with virtual addresses or CPU protections; its sole job is to parse the hardware memory map provided by the bootloader, reserve spaces that are occupied by hardware (like the bootloader or the kernel itself), and hand out contiguous blocks of free RAM when requested by higher-level systems.

System Integration & Initialization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The PMM is initialized in the main kernel boot sequence immediately after the GDT and IDT. It relies heavily on the limine_memmap_response passed directly from the bootloader to understand the hardware layout. During pmm_init(), the kernel scans the memory map to find the highest usable physical address and calculates how large the bitmap needs to be. It then searches for the first available block of memory large enough to hold this bitmap and places it there. By default, the entire bitmap is initialized to 0xFF (fully used/locked), and then the PMM explicitly iterates through the usable sections of the memory map to "free" the valid frames.

API Reference
~~~~~~~~~~~~~
**Macros**

* ``PMM_INIT_SUCCESS``: Evaluates to 8 (1<<3). Returned upon successful initialization of the physical bitmap.

**Data Structures**

* ``struct pmm_context``: The global state container for the physical memory subsystem.
    * Fields:
    * ``uint8_t* bitmap``: A pointer to the dynamically placed bitmap array.
    * ``uint64_t bitmap_size``: The total size of the bitmap in bytes.
    * ``uint64_t total_frames``: The total number of 4KB physical frames tracked by the system.
    * ``uint64_t free_frames``: A running counter of currently available frames.

**Functions**

* ``uint8_t pmm_init(struct limine_memmap_response* response)``: Parses the bootloader's memory map to locate available RAM, sizes and places the bitmap structure, and marks all usable and bootloader-reclaimable memory as free. Returns: PMM_INIT_SUCCESS.
* ``uint64_t pmm_alloc()``: Scans the bitmap using a "first fit" algorithm to find the first available single 4KB frame. It flips the corresponding bit to claim it. Returns: The 64-bit physical address of the allocated 4KB frame (or 0 if out of memory).
* ``uint64_t pmm_alloc_2mb()``: Scans the bitmap to find 64 contiguous free 4KB frames (which equates to exactly 2MB of memory) aligned to a 2MB boundary. Returns: The physical address of the 2MB block.
* ``void pmm_free(uint64_t phys_addr) / void pmm_free_2mb(uint64_t phys_addr)``: Converts the given physical address into a frame index and flips the corresponding bit(s) in the bitmap back to 0, freeing the memory for future use. Ensures the address is properly aligned to 4KB (0xfff) or 2MB (0x200000), respectively.

vmm.c (Virtual Memory Manager)
------------------------------
Overview
~~~~~~~~
The Virtual Memory Manager (VMM) creates the illusion of a clean, continuous memory space for software to run in, isolating the CPU from the fragmented reality of physical RAM. It implements standard x86-64 4-level paging (PML4, PDPT, PD, PT) to translate 64-bit virtual addresses into the physical addresses managed by the PMM. In this unikernel, the VMM is crucial because it implements the Higher Half Direct Map (HHDM) architecture and supports 2MB "Huge Pages". Huge pages drastically reduce Translation Lookaside Buffer (TLB) misses, providing a massive performance boost for the mathematically intensive, data-heavy workloads this system executes.

System Integration & Initialization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
The VMM is initialized immediately after the PMM, as it requires the PMM to allocate physical frames for its page tables. During vmm_init(), the kernel constructs the root PML4 table. It identically maps the lowest 4MB of memory (for legacy hardware access), the kernel and its modules, and maps all usable memory into the Higher Half using the HHDM offset provided by Limine. Finally, it writes the physical address of the PML4 table into the CPU's CR3 control register, activating the new paging structure.

Application Example
~~~~~~~~~~~~~~~~~~~
The vmm_alloc_huge_page function is directly exposed via the kernel_api_t interface, allowing external payloads to allocate contiguous 2MB blocks of memory for their math operations.

.. code-block:: c

    #include "headers/kernel_api.h"
    // Example of a payload using the API to get memory
    void math_workload() {    
        kernel_api_t* api = (kernel_api_t*)KERNEL_API_ADDRESS;        
        // Allocate 4 MB of memory (two 2MB huge pages) with Read/Write flags    
        float* massive_matrix = api->alloc_huge_page(2, VMM_PRESENT | VMM_WRITEABLE);        
        // ... perform calculations ...
    }

API Reference
~~~~~~~~~~~~~
**Macros**

* ``Flags``: Standard paging attributes such as VMM_PRESENT (1<<0), VMM_WRITEABLE (1<<1), and VMM_HUGE (1<<7) used to dictate the access rights of a given page.

**Data Structures**

* ``typedef uint64_t pt_entry_t``: A 64-bit page table entry containing the physical address of the next table or memory frame, combined with access flags.
* ``page_table_t``: An array of 512 pt_entry_ts, strictly aligned to a 4KB boundary, representing a single level in the paging hierarchy.
* ``struct vmm_context``: Holds the root of the paging hierarchy.
    * Fields:
    * ``page_table_t* pml4_virt``: The virtual address of the top-level PML4 table.
    * ``uintptr_t pml4_phys``: The physical address of the PML4 table, designed to be loaded into the CR3 register.

**Functions**

* ``uint8_t vmm_init(struct limine_kernel_address_response* kernel_addr_response, struct limine_memmap_response* memmap_response)``: Sets up the root page tables, maps the kernel code, maps the framebuffer, and implements the Higher Half Direct Map (HHDM) before loading the CR3 register. Returns: VMM_INIT_SUCCESS.
* ``void vmm_map_virt_to_phys(uint64_t virt_addr, uint64_t phys_addr, uint64_t flags)``: Traverses the 4-level paging hierarchy (allocating new intermediate tables via the PMM if they don't exist) to link a specific 4KB virtual address to a physical frame, applying the requested access flags. Uses invlpg to flush the CPU cache for that address.
* ``void* vmm_alloc_huge_page(uint64_t num_pages, uint64_t flags)``: The premier memory allocation function for the unikernel. It requests properly aligned 2MB blocks from the PMM and maps them directly into the Page Directory (bypassing the Page Table level entirely) using the VMM_HUGE flag. It zeroes out the memory to prevent data leaks and increments the global virtual address tracker. Returns: A void* pointer to the newly allocated block of virtual memory.