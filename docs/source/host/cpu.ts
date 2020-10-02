/* ------------
     CPU.ts

     Routines for the host CPU simulation, NOT for the OS itself.
     In this manner, it's A LITTLE BIT like a hypervisor,
     in that the Document environment inside a browser is the "bare metal" (so to speak) for which we write code
     that hosts our client OS. But that analogy only goes so far, and the lines are blurred, because we are using
     TypeScript/JavaScript in both the host and client environments.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */

module TSOS {

    export class Cpu {

        constructor(
            public PC: number = 0,
            public IR: string = "00",
            public Acc: string = "00",
            public Xreg: string = "00",
            public Yreg: string = "00",
            public Zflag: number = 0,
            public isExecuting: boolean = false,
            public localPCB: ProcessControlBlock = null) {
        }

        public init(): void {
            this.PC = 0;
            this.IR = "00";
            this.Acc = "00";
            this.Xreg = "00";
            this.Yreg = "00";
            this.Zflag = 0;
            this.isExecuting = false;
            this.localPCB = null;
        }/// init

        public cycle(): void {
            _Kernel.krnTrace('CPU cycle');
            // TODO: Accumulate CPU usage and profiling statistics here.
            // Do the real work here. Be sure to set this.isExecuting appropriately.
            ///
            /// For Now just wrap the program counter
            this.PC = this.PC % MAX_SIMPLE_VOLUME_CAPACITY;

            /// Classic LMC
            var addressData: string = this.fetch(); /// Fetch()

            this.decode(addressData);///Decode() and Execute()
        }/// cycle

        /// So far it's either make a global reference
        /// or pass the reference for now
        public setLocalProcessControlBlock(newProcessControlBlock: ProcessControlBlock) {
            this.localPCB = newProcessControlBlock;
        }/// setLocalProcessControlBlock

        /// Fetch data from memory using the program counter
        public fetch() {
            /// Get Data which is already in a hex string...
            var data: string = "00";
            data = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);

            /// Put data into the instruction register... just to log what's going on right now
            /// Obviously b/c of the shared stored program concept we won't know that this is necessarily
            /// an instruction or not until it's decoded... 
            ///
            /// Hopefully I rememebr to do this cleaner...
            this.IR = data;
            this.localPCB.instructionRegister = data;

            return data;
        }///fetch

        /// Decode the instruction... and then execute
        public decode(newAddressData: string) {
            switch (newAddressData) {
                /// Load Accumulator with a constant
                case 'A9':
                    this.ldaAccConstant();
                    break;

                /// Load Accumulator from memory
                case 'AD':
                    this.ldaAccMemory();
                    break;

                /// Store the accumulator in memory
                case '8D':
                    this.staAccMemory();
                    break;

                /// Load X-register with a constant
                case 'A2':
                    this.ldaXConst();
                    break;

                /// Load X-register from memory
                case 'AE':
                    this.ldaXMemory();
                    break;

                /// Load the Y-register with a constant
                case 'A0':
                    this.ldaYConst();
                    break;

                /// Load the Y-register from memory
                case 'AC':
                    this.ldaYMemory();
                    break;

                /// Add with carry
                case '6D':
                    this.addWithCarry();
                    break;

                /// No Operation
                case 'EA':
                    this.nOp();
                    break;

                /// Break (which is really a system call)
                case '00':
                    this.break();
                    break;

                /// Compare a byte in memory to the X register
                ///
                /// Sets the Z(One) flag if equal
                case 'EC':
                    this.cpx();
                    break;

                /// Branch n bytes if z flag = 0
                case 'D0':
                    this.branchZero();
                    break;

                /// Increment the value of a byte
                case 'EE':
                    this.incrementByte();
                    break;

                /// System Call
                case 'FF':
                    this.sysCall();
                    break;

                default:
                    /// Throw error
                    // Should I crash the OS instead?
                    _StdOut.putText(`Data: ${newAddressData} could not be decoded into an instruction!`);
                    _StdOut.advanceLine();
                    _OsShell.putPrompt();
                    this.isExecuting = false;
                    break;
            }/// switch
            TSOS.Control.visualizeInstructionRegister(newAddressData);
        }///decode

        /// My Strategy:
        ///     Go literal line-by-line in a procedural fashion, this
        ///     way no fancy one-liners, it's self documenting
        ///     and hopefully this makes it impossible to mess up...
        ///
        ///     Or so I thought...

        /// Load the accumulator with a constant.
        public ldaAccConstant() {
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;

            /// Read data from memory 
            ///
            /// Should already be stored in memory as Hex from Shell...
            ///
            /// Read from process control block queue
            this.Acc = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC), 16));

            /// Increase the program counter to the next instruction
            ///
            /// I could probably call this after the switch case, but I rather each
            /// instruction method be stand alone.
            this.PC++;
        }/// ldaAccConstant


        /// Load the accumulator from memory.
        public ldaAccMemory() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this. Acc = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16));

            /// Increment program counter as usual
            this.PC++;
        }/// ldaAccMem


        /// Store the accumulator in memory
        public staAccMemory() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// This would be too long of a one liner to do
            var formattedHex = TSOS.Control.formatToHexWithPadding(parseInt(this.Acc, 16));

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            _MemoryAccessor.write(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress, formattedHex);

            /// Increment program counter as usual
            this.PC++;
        }/// staAccMemory

        /// Load the X register with a constant
        public ldaXConst() {
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Xreg = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC), 16));

            /// Increment program counter as usual
            this.PC++;
        }/// loadXConstant

        /// Load the X register from memory
        public ldaXMemory() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Xreg = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16));

            /// Increment program counter as usual
            this.PC++;
        }/// LoadXMemory

        /// Load the Y register with a constant
        public ldaYConst() {
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Yreg = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC), 16));

            /// Increment program counter as usual
            this.PC++;
        }/// loadXConstant

        /// Load the Y register from memory
        public ldaYMemory() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Yreg = TSOS.Control.formatToHexWithPadding(parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16));

            /// Increment program counter as usual
            this.PC++;
        }/// LoadXMemory


        /// Add with carry
        /// 
        /// Adds contents of an address to the contents of the accumulator and keeps the result in the accumulator
        public addWithCarry() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            var numberToBeAdded: number = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16);

            /// Convert Numbers to decimal for addition
            var accNum: number = parseInt(this.Acc, 16);

            /// Add numbers
            var ans: number = numberToBeAdded + accNum;

            /// Conert answer back to hex string

            /// Apply to the calculator
            /// Remeber to formatt though
            this.Acc = TSOS.Control.formatToHexWithPadding(ans);

            /// Increment program counter as usual
            this.PC++;
        }/// addWithCarry

        /// No operation
        public nOp() {this.PC++; }/// nOp

        /// Break
        public break() {
            /// Process break as an interrupt as well.
            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(TERMINATE_PROCESS_IRQ, []));

            _CPU.localPCB.processState = "Terminated";
        }/// break
        
        /// Compare a byte in memory to the X reg EC CPX EC $0010 EC 10 00
        /// Sets the Z (zero) flag if equal...
        public cpx() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Number is converted to decimal
            var memoryNum: number = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16);
            var xRegNum: number = parseInt(this.Xreg, 16);

            /// Set z flag... don't have to worry about the -stupid- conversion
            this.Zflag = xRegNum === memoryNum ? 1 : 0;

            this.PC++;
        }///cpx


        /// Branch n bytes if Z flag = 0
        branchZero() {
            /// Increment the program counter by one to read argument
            this.PC++;

            /// Get n units to branch by
            var nUnits: number = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC), 16);

            /// Check if Z-flag is zero
            if (this.Zflag === 0) {
                /// No fancy stuff...
                /// I'm really trying to make this hard to mess up
                this.PC = this.PC + nUnits;

                this.PC = this.PC % MAX_SIMPLE_VOLUME_CAPACITY;
            }/// if

            /// Regardless of a succesful branch or not, just advance the program counter as usual to next instruction
            this.PC++;
        }///branchZero

        /// Increment the value of a byte
        incrementByte() {
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress: number = this.getWrapAdjustedLogicalAddress();

            /// Actually increment the data by one
            var incrementedNumber: number = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16) + 1;

            /// Reformat to Hex
            var paddedFormattedIncrementedNumber: string = TSOS.Control.formatToHexWithPadding(incrementedNumber);

            /// Write to memory the data plus 1.
            _MemoryAccessor.write(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress, paddedFormattedIncrementedNumber);
            
            this.PC++;
        }//incrementByte

        public sysCall () {
            /// Process handling Y register as an interrupt
            if (parseInt(this.Xreg, 16) === 1) {
                _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SYS_CALL_IRQ, [1]));
            }/// if
            else if (parseInt(this.Xreg, 16) === 2) {
                _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SYS_CALL_IRQ, [2]));
            }/// else if
            this.PC++;
        }/// sysCall

        public getWrapAdjustedLogicalAddress () {

             /// Read the "first" argument which is really the second
             this.PC++;
             var secondArg: string = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
 
             /// Read the "second" argument which is really the first
             this.PC++;
             var firstArg: string = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
 
             /// Deal with the inversion
             var reversedArgs: number = parseInt(firstArg + secondArg, 16);
 
             /// I'm assuming these are logical addresses being passed in...
             ///
             /// If I remember you want a wrap around effect so use modulo then...
             /// I'll do this in the cycle() method for through protection...
             return reversedArgs;
        }/// getWrapAdjustedLogicalAddress
    }/// Class
}/// Module