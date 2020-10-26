/* ------------
     Devices.ts

     Routines for the hardware simulation, NOT for our client OS itself.
     These are static because we are never going to instantiate them, because they represent the hardware.
     In this manner, it's A LITTLE BIT like a hypervisor, in that the Document environment inside a browser
     is the "bare metal" (so to speak) for which we write code that hosts our client OS.
     But that analogy only goes so far, and the lines are blurred, because we are using TypeScript/JavaScript
     in both the host and client environments.

     This (and simulation scripts) is the only place that we should see "web" code, like
     DOM manipulation and TypeScript/JavaScript event handling, and so on.  (Index.html is the only place for markup.)

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */
var TSOS;
(function (TSOS) {
    class Devices {
        constructor() {
            _hardwareClockID = -1;
        }
        //
        // Hardware/Host Clock Pulse
        //
        static hostClockPulse() {
            // Increment the hardware (host) clock.
            _OSclock++;
            // Call the kernel clock pulse event handler.
            _Kernel.krnOnCPUClockPulse();
        }
        //
        // Keyboard Interrupt, a HARDWARE Interrupt Request. (See pages 560-561 in our text book.)
        //
        static hostEnableKeyboardInterrupt() {
            // Listen for key press (keydown, actually) events in the Document
            // and call the simulation processor, which will in turn call the
            // OS interrupt handler.
            document.addEventListener("keydown", Devices.hostOnKeypress, false);
        }
        static hostDisableKeyboardInterrupt() {
            document.removeEventListener("keydown", Devices.hostOnKeypress, false);
        }
        static hostOnKeypress(event) {
            // The canvas element CAN receive focus if you give it a tab index, which we have.
            // Check that we are processing keystrokes only from the canvas's id (as set in index.html).
            if (event.target.id === "display") {
                event.preventDefault();
                // Note the pressed key code in the params (Mozilla-specific).
                ///
                /// TODO: Check to see if this will work: event.getModifierState("CapsLock")
                var params = new Array(event.which, event.shiftKey, event.ctrlKey, event.altKey);
                // Enqueue this interrupt on the kernel interrupt queue so that it gets to the Interrupt handler.
                _KernelInterruptPriorityQueue.enqueue(new TSOS.Interrupt(KEYBOARD_IRQ, params));
            }
        }
        /// 
        /// Mouse Interrupt, a HARDWARE Interrupt Request (Oh boy, here we go...)
        ///
        /// Not sure if it's "wheel" or "scroll." Still gotta do some googling...
        static hostEnabledMouseInterrupt(event) {
            /// Listen for mouse scroll (scroll up, scroll down) events in the Document
            /// and call the simultation processor, which will in turn call the
            /// OS interrupt handler... (Real original... I know).
            document.addEventListener('wheel', Devices.hostOnMouseScroll, false);
        }
        static hostDisableMouseInterrupt() {
            document.removeEventListener("wheel", Devices.hostOnKeypress, false);
        }
        static hostOnMouseScroll(event) {
            /// So, uh, copy what Alan did but look for mouse actions on the document, specifically on the canvas...
            if (event.target.id === "display") {
                event.preventDefault();
                /// Lemme do some more googling...
            }
        }
    }
    TSOS.Devices = Devices;
})(TSOS || (TSOS = {}));
//# sourceMappingURL=devices.js.map