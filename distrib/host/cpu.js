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
var TSOS;
(function (TSOS) {
    class Cpu {
        constructor(PC = 0, IR = "00", Acc = "00", Xreg = "00", Yreg = "00", Zflag = 0, isExecuting = false, 
        /// So far it's either make a global reference
        /// or pass the reference
        localPCB = null) {
            this.PC = PC;
            this.IR = IR;
            this.Acc = Acc;
            this.Xreg = Xreg;
            this.Yreg = Yreg;
            this.Zflag = Zflag;
            this.isExecuting = isExecuting;
            this.localPCB = localPCB;
        }
        init() {
            this.PC = 0;
            this.IR = "00";
            this.Acc = "00";
            this.Xreg = "00";
            this.Yreg = "00";
            this.Zflag = 0;
            this.isExecuting = false;
            this.localPCB = null;
        } /// init
        cycle() {
            /// Add delay to synchronize host log and cpu other wise the cpu just go brrrrrrrrrrrrrrr
            _Kernel.krnTrace('CPU cycle');
            // TODO: Accumulate CPU usage and profiling statistics here.
            // Do the real work here. Be sure to set this.isExecuting appropriately.
            ///
            this.PC = this.PC % MAX_SIMPLE_VOLUME_CAPACITY;
            /// Classic fetch(), decode(), execute()...
            var addressData = this.fetch();
            /// Decode and Execute using a giant switch case
            this.decode(addressData);
            /// TODO: Move definitions into Control.ts and call methods in Kernel.OnClockPulse(); or something....
            ///
            /// They are here for now cause by "program logic" this makes sense...
            /// Clearly, they do not belong here as we are trying to model a cpu as close as possible.
            this.updateVisualCpu();
            this.updatePcb();
            _MemoryAccessor.updateVisualMemory();
            // this.isExecuting = false;
            /// Call clock pulse
            // Increment the hardware (host) clock
        }
        setLocalProcessControlBlock(newProcessControlBlock) {
            this.localPCB = newProcessControlBlock;
        } /// setLocalProcessControlBlock
        /// Fetch data from memory using the program counter
        fetch() {
            /// Get Data which is already in a hex string...
            var data = "00";
            data = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Put data into the instruction register... just to log what's going on right now
            /// Obviously b/c of the shared stored program concept we won't know that this is necessarily
            /// an instruction or not until it's decoded... 
            ///
            /// Hopefully i rememebr to move this
            this.IR = data;
            this.localPCB.instructionRegister = data;
            return data;
        } ///fetch
        /// Decode the instruction...
        decode(newAddressData) {
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
                /// Sets the Z(zero) flag if equal
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
                    _StdOut.putText(`Data: ${newAddressData} could not be decoded into an instruction!`);
                    _StdOut.advanceLine();
                    _OsShell.putPrompt();
                    this.isExecuting = false;
                    break;
            } /// switch
        } ///decode
        ///
        /// Sorry, no fancy "one-liners"
        /// Going Line By Line makes this literally impossible to mess up
        /// Or so I thought...
        ///
        /// Load the accumulator with a constant.
        ldaAccConstant() {
            this.visualizeInstructionRegister('A9');
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;
            /// Read data from memory 
            ///
            /// Should already be stored in memory as Hex from Shell...
            ///
            /// Read from process control block queue
            this.Acc = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Increase the program counter to the next instruction
            ///
            /// I could probably call this after the switch case, but I rather each
            /// instruction method be stand alone.
            this.PC++;
        } /// ldaAccConstant
        /// Load the accumulator from memory.
        ldaAccMemory() {
            this.visualizeInstructionRegister('AD');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Acc = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress);
            /// Increment program counter as usual
            this.PC++;
        } /// ldaAccMem
        /// Store the accumulator in memory
        staAccMemory() {
            this.visualizeInstructionRegister('8D');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            _MemoryAccessor.write(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress, this.Acc);
            /// Increment program counter as usual
            this.PC++;
        } /// staAccMemory
        /// Load the X register with a constant
        ldaXConst() {
            this.visualizeInstructionRegister('A2');
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Xreg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Increment program counter as usual
            this.PC++;
        } /// loadXConstant
        /// Load the X register from memory
        ldaXMemory() {
            this.visualizeInstructionRegister('AE');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Xreg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress);
            /// Increment program counter as usual
            this.PC++;
        } /// LoadXMemory
        /// Load the Y register with a constant
        ldaYConst() {
            this.visualizeInstructionRegister('A0');
            /// Increase the accumulator to read data argument of the constructor
            this.PC++;
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Yreg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Increment program counter as usual
            this.PC++;
        } /// loadXConstant
        /// Load the Y register from memory
        ldaYMemory() {
            this.visualizeInstructionRegister('AC');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            this.Yreg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress);
            /// Increment program counter as usual
            this.PC++;
        } /// LoadXMemory
        /// Add with carry
        /// 
        /// Adds contents of an address to the contents of the accumulator and keeps the result in the accumulator
        addWithCarry() {
            this.visualizeInstructionRegister('6D');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually read from memory using the wrapped logical address that is also adjusted for inversion
            var numberToBeAdded = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16);
            /// Convert Numbers to decimal for addition
            var accNum = parseInt(this.Acc, 16);
            /// Add numbers
            var ans = numberToBeAdded + accNum;
            /// Conert answer back to hex string
            /// Apply to the calculator
            this.Acc = ans.toString(16);
            /// Increment program counter as usual
            this.PC++;
        } /// addWithCarry
        /// No operation
        nOp() {
            this.visualizeInstructionRegister('EA');
            this.PC++;
        } /// nOp
        /// Break
        break() {
            /// Process break as an interrupt as well.
            this.visualizeInstructionRegister('00');
            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(TERMINATE_PROCESS_IRQ, []));
            _CPU.localPCB.processState = "Terminated";
        } /// break
        /// Compare a byte in memory to the X reg EC CPX EC $0010 EC 10 00
        /// Sets the Z (zero) flag if equal...
        cpx() {
            this.visualizeInstructionRegister('EC');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Number is converted to decimal
            var memoryNum = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16);
            var xRegNum = parseInt(this.Xreg, 16);
            /// Set z flag... don't have to worry about the -stupid- conversion
            this.Zflag = xRegNum === memoryNum ? 1 : 0;
            this.PC++;
        } ///cpx
        /// Branch n bytes if Z flag = 0
        branchZero() {
            this.visualizeInstructionRegister('D0');
            /// Increment the program counter by one to read argument
            this.PC++;
            /// Get n 
            var nUnits = parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC), 16);
            /// Check if Z-flag is zero
            if (this.Zflag === 0) {
                /// No fancy stuff...
                /// I'm really trying to make this hard to mess up
                this.PC = this.PC + nUnits;
                this.PC = this.PC % MAX_SIMPLE_VOLUME_CAPACITY;
            } /// if
            /// Regardless of a succesful branch or not, just advance the program counter as usual to next instruction
            this.PC++;
        } ///branchZero
        /// Increment the value of a byte
        incrementByte() {
            this.visualizeInstructionRegister('D0');
            /// Adjust for inversion and wrapping
            var wrapAdjustedLogicalAddress = this.getWrapAdjustedLogicalAddress();
            /// Actually increment the data by one then convert back to a hex string
            var incrementedNumber = (parseInt(_MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress), 16) + 1).toString(16);
            /// Write to memory the data plus 1.
            _MemoryAccessor.write(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], wrapAdjustedLogicalAddress, incrementedNumber);
            this.PC++;
        } //incrementByte
        sysCall() {
            /// Process handling Y register as an interrupt
            if (parseInt(this.Xreg, 16) === 1) {
                _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SYS_CALL_IRQ, [1]));
            } /// if
            else if (parseInt(this.Xreg, 16) === 2) {
                _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SYS_CALL_IRQ, [2]));
            } /// else if
            this.PC++;
        } /// sysCall
        getWrapAdjustedLogicalAddress() {
            /// Read the "first" argument which is really the second
            this.PC++;
            var secondArg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Read the "second" argument which is really the first
            this.PC++;
            var firstArg = _MemoryAccessor.read(_MemoryManager.simpleVolumes[this.localPCB.volumeIndex], this.PC);
            /// Deal with the inversion
            var reversedArgs = parseInt(firstArg + secondArg, 16);
            /// I'm assuming these are logical addresses being passed in...
            ///
            /// If I remember you want a wrap around effect so use modulo then...
            /// I'll do this in the cycle() method for through protection...
            return reversedArgs;
        } /// getWrapAdjustedLogicalAddress
        //////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////// TODO: Move UI methods to Control.ts /////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        updateVisualCpu() {
            _visualCpu.rows[1].cells[0].innerHTML = this.PC;
            _visualCpu.rows[1].cells[1].innerHTML = this.IR;
            _visualCpu.rows[1].cells[2].innerHTML = this.Acc;
            _visualCpu.rows[1].cells[3].innerHTML = this.Xreg;
            _visualCpu.rows[1].cells[4].innerHTML = this.Yreg;
            _visualCpu.rows[1].cells[5].innerHTML = this.Zflag;
        } /// createVisualMemory
        updatePcb() {
            /// Process Control Block should be updated but not wiped.
            /// Should be able to see the last state of the PCB
            this.localPCB.programCounter = this.PC;
            this.localPCB.accumulator = this.Acc;
            this.localPCB.xRegister = this.Xreg;
            this.localPCB.yRegister = this.Yreg;
            this.localPCB.zFlag = this.Zflag;
            /// Visual Updates
            /// TODO: Move to Control.ts or Util.ts... It Doesn't Belong Here!!!
            _visualPcb.rows[1].cells[0].innerHTML = this.localPCB.processID;
            _visualPcb.rows[1].cells[1].innerHTML = this.localPCB.programCounter;
            _visualPcb.rows[1].cells[2].innerHTML = this.localPCB.instructionRegister;
            _visualPcb.rows[1].cells[3].innerHTML = this.localPCB.accumulator;
            _visualPcb.rows[1].cells[4].innerHTML = this.localPCB.xRegister;
            _visualPcb.rows[1].cells[5].innerHTML = this.localPCB.yRegister;
            _visualPcb.rows[1].cells[6].innerHTML = this.localPCB.zFlag;
            _visualPcb.rows[1].cells[7].innerHTML = this.localPCB.priority;
            _visualPcb.rows[1].cells[8].innerHTML = this.localPCB.processState;
            _visualPcb.rows[1].cells[9].innerHTML = `Vol ${this.localPCB.volumeIndex + 1}`;
        } /// createVisualMemory
        visualizeInstructionRegister(newInsruction) {
            /// Instruction Register
            this.IR = newInsruction;
            this.localPCB.instructionRegister = newInsruction;
        } /// visualizeInstructionRegiste
    } /// Class
    TSOS.Cpu = Cpu;
})(TSOS || (TSOS = {})); /// Module
//# sourceMappingURL=cpu.js.map