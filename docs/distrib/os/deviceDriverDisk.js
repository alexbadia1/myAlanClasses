/* ----------------------------------
   DeviceDriverDisk.ts

   The Kernel Disk Device Driver.

   Few Questions:
        1.) How many bytes should we reserve for"
            ~ The flag?
                -
            ~ The file name?
            ~ File creation date?
            ~ File size?
                - Our disk is 16,000 Bytes or 16 KB, so 2Bytes?
            ~
   ---------------------------------- */
var TSOS;
(function (TSOS) {
    // Extends DeviceDriver
    class DeviceDriverDisk extends TSOS.DeviceDriver {
        constructor(hiddenFilePrefix = '.', swapFilePrefix = '!', idAllocator = new IdAllocator(), dirBlock = new Partition('File Header', /// File Entries
        0, 0, 1, /// base = (0, 0, 1)
        0, 7, 7), /// new Directory
        fileDataBlock = new Partition('File Body', /// File Data
        1, 0, 0, /// base = (1, 0, 0)
        3, 7, 7), /// new Block
        formatted = false, diskBase = "000000", diskLimit = "030707") {
            /// Override the base method pointers
            /// The code below cannot run because "this" can only be accessed after calling super.
            /// super(this.krnKbdDriverEntry, this.krnKbdDispatchKeyPress);
            super();
            this.hiddenFilePrefix = hiddenFilePrefix;
            this.swapFilePrefix = swapFilePrefix;
            this.idAllocator = idAllocator;
            this.dirBlock = dirBlock;
            this.fileDataBlock = fileDataBlock;
            this.formatted = formatted;
            this.diskBase = diskBase;
            this.diskLimit = diskLimit;
            this.driverEntry = this.krnDiskDriverEntry;
            this.isr = this.krnDiskDispatchFunctions;
        } /// constructor
        krnDiskDriverEntry() {
            /// Initialization routine for this, the kernel-mode Disk Device Driver.
            this.status = "loaded";
            /// More...?
        } /// krnDiskDriverEntry
        krnDiskDispatchFunctions(params) {
            var result = '';
            var diskOperation = params[0];
            switch (diskOperation) {
                case 'create':
                    /// params[1] = filename
                    result = this.create(params[1]);
                    break;
                case 'write':
                    /// params[1][0] = filename
                    /// params[1][1] = file text
                    result = this.write(params[1][0], params[1][1]);
                    break;
                case 'read':
                    /// params[1] = filename
                    result = this.read(params[1]);
                    break;
                case 'delete':
                    /// params[1] = filename
                    result = this.deleteFile(params[1]);
                    break;
                case 'list':
                    /// params[1] = 'no-arg' || params[1] = '-l'
                    this.list(params[1]);
                    break;
                case 'defrag':
                    /// no params
                    result = this.defrag();
                    break;
                default:
                    _Kernel.krnTrace(`Failed to perform disk ${params[0]} operation`);
                    _StdOut.putText(`Failed to perform disk ${params[0]} operation`);
                    break;
            } /// switch
            /// Show results denoting the success or failure of the driver operation on disk
            if (result !== '') {
                _StdOut.putText(`${result}`);
                _StdOut.advanceLine();
                _OsShell.putPrompt();
            } /// if
            return result;
        } /// krnDiskDispatchFunctions
        ///////////////////////////////
        ////// Format Operations //////
        ///////////////////////////////
        format(type) {
            var success = false;
            switch (type) {
                case '-full':
                    success = this.fullFormat();
                    break;
                case '-quick':
                    success = this.quickFormat();
                    break;
                case 'no-arg':
                    _Disk.init();
                    this.formatted = true;
                    success = true;
                    break;
                default:
                    _Kernel.krnTrace(`Failed disk format (Type: ${type.replace('-', '').trim()})`);
                    _StdOut.putText(`Cannot perform format (Type: ${type.replace('-', '').trim()})`);
                    _StdOut.advanceLine();
                    _OsShell.putPrompt();
                    break;
            } /// switch 
            if (success) {
                _StdOut.putText(`Hard drive successfully formatted!`);
                _StdOut.advanceLine();
                _OsShell.putPrompt();
            } /// if
            TSOS.Control.updateVisualDisk();
            // else {
            //     _StdOut.putText(`Failed to format (Type: ${type.replace('-', '').trim()})`);
            //     _StdOut.advanceLine();
            //     _OsShell.putPrompt();
            // }// else
        } /// format
        fullFormat() {
            if (this.formatted) {
                /// Same as Disk.init() except skip the master boot record
                for (var trackNum = 0; trackNum < TRACK_LIMIT; ++trackNum) {
                    for (var sectorNum = 0; sectorNum < SECTOR_LIMIT; ++sectorNum) {
                        for (var blockNum = 0; blockNum < BLOCK_LIMIT; ++blockNum) {
                            _Disk.createSessionBlock(trackNum, sectorNum, blockNum);
                        } /// for
                    } /// for
                } /// for
                _Kernel.krnTrace(`Disk formatted (Type: Full Format)`);
                /// Reclaim all ID's
                this.idAllocator = new IdAllocator();
                this.formatted = true;
                return true;
            } /// if
            else {
                _Kernel.krnTrace(`Failed disk format (Type: Full Format), missing master boot record`);
                _StdOut.putText(`Full Format can only be used to REFORMAT the drive, please initially format the drive.`);
                _StdOut.advanceLine();
                _OsShell.putPrompt();
                return false;
            } /// else
        } /// fullFormat
        quickFormat() {
            /// Disk must be "fully" formatted first, otherwise, the rest of the 4-63 bytes 
            /// of data could possibly be null if '-quick' format is called as the "first" format...
            if (this.formatted) {
                /// Change the first four bytes back to 00's
                for (var trackNum = 0; trackNum < TRACK_LIMIT; ++trackNum) {
                    for (var sectorNum = 0; sectorNum < SECTOR_LIMIT; ++sectorNum) {
                        for (var blockNum = 0; blockNum < BLOCK_LIMIT; ++blockNum) {
                            var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                            /// Skip already quick formatted blocks
                            if (sessionStorage.getItem(currentKey).substring(0, 8) === "00000000") {
                                continue;
                            } /// if
                            /// Skip master boot record
                            if (trackNum === 0 && sectorNum === 0 && blockNum === 0) {
                                continue;
                            } ///if
                            /// Reset the first 8 nums to zero
                            else {
                                /// Get session value
                                var value = sessionStorage.getItem(currentKey);
                                /// Replace the first 4 bytes (8 characters) with 00's
                                value = "8000" + BLOCK_NULL_POINTER + value.substring(10, value.length);
                                /// Write the change back to the list
                                sessionStorage.setItem(currentKey, value);
                            } /// else
                        } /// for
                    } /// for
                } /// for
                /// Reclaim all ID's
                this.idAllocator = new IdAllocator();
                _Kernel.krnTrace(`Disk formatted (Type: Quick Format)`);
                this.formatted = true;
                return true;
            } /// if
            else {
                _Kernel.krnTrace(`Failed disk format (Type: Quick Format), missing master boot record`);
                _StdOut.putText(`Quick Format can only be used to REFORMAT the drive, please initially format the drive.`);
                _StdOut.advanceLine();
                _OsShell.putPrompt();
                return false;
            } /// else
        } /// quickFormat
        create(fileName = '') {
            var msg = 'File creation failed';
            /// File does not exist, nice...
            if (this.fileNameExists(fileName) === '') {
                /// Request a unique ID from the ID manager
                var newFileID = this.idAllocator.allocatePositiveID();
                /// File ID request successful, okay we're getting somwhere
                if (newFileID != -1) {
                    /// Find a free space, null if there are no available blocks O(n)
                    var availableDirKey = this.getFirstAvailableBlockFromDirectoryPartition();
                    /// Free space found in directory
                    if (availableDirKey != null) {
                        /// Find a free space, null if there are no available blocks O(n)
                        var availableFileDataKey = this.getFirstAvailableBlockFromDataPartition();
                        /// Free space found in data partition
                        if (availableFileDataKey != null) {
                            /// Preserve and deleted files being overwritten for later recovery
                            if (parseInt(this.getBlockFlag(availableDirKey), 16) > NEGATIVE_ZERO) {
                                this.preserveFileIntegrity(availableDirKey);
                            } /// if
                            if (parseInt(this.getBlockFlag(availableDirKey), 16) > NEGATIVE_ZERO) {
                                this.preserveFileIntegrity(availableFileDataKey);
                            } /// if
                            /// Write a directory entry for file
                            var fileNameInHex = this.englishToHex(fileName).toUpperCase();
                            var paddedFileNameInHex = fileNameInHex + this.dirBlock.defaultDirectoryBlockZeros.substring(fileNameInHex.length);
                            var newFileIDString = TSOS.Control.formatToHexWithPaddingTwoBytes(newFileID);
                            this.setBlockFlag(availableDirKey, newFileIDString);
                            this.setBlockForwardPointer(availableDirKey, availableFileDataKey);
                            this.setBlockDate(availableDirKey, TSOS.Control.formatToHexWithPaddingSevenBytes(_Kernel.getCurrentDateTime()));
                            this.setBlockSize(availableDirKey, '0080'); /// 128 in hexadecimal
                            this.setDirectoryBlockData(availableDirKey, paddedFileNameInHex);
                            /// Reserve the first data block for file and overwrite with 00's
                            this.setBlockFlag(availableFileDataKey, newFileIDString);
                            this.setDataBlockData(availableFileDataKey, this.dirBlock.defaultDataBlockZeros);
                            this.setBlockForwardPointer(availableFileDataKey, availableDirKey);
                            _Kernel.krnTrace('File sucessfully created!');
                            TSOS.Control.updateVisualDisk();
                            msg = `C:\\AXIOS\\${fileName} sucessfully created!`;
                        } /// if
                        /// No space in data partition
                        else {
                            _Kernel.krnTrace(`Cannot create C:\\AXIOS\\${fileName}, all file data blocks are in use!`);
                            msg = `Cannot create C:\\AXIOS\\${fileName}, all file data blocks are in use!`;
                        } /// else
                    } /// if
                    /// No space in directory
                    else {
                        _Kernel.krnTrace(`Cannot create C:\\AXIOS\\${fileName}, all file header blocks are in use!`);
                        msg = `Cannot create C:\\AXIOS\\${fileName}, all file header blocks are in use!`;
                    } /// else
                } /// if
                /// Ran out of file ID's
                else {
                    _Kernel.krnTrace(`Cannot create C:\\AXIOS\\${fileName}, ran out of ID's to allocate!`);
                    msg = `Cannot create C:\\AXIOS\\${fileName}, ran out of ID's to allocate!`;
                } /// else
            } /// if
            /// File already exists
            else {
                _Kernel.krnTrace(`Cannot create C:\\AXIOS\\${fileName}, filename is already in use!`);
                msg = `Cannot create C:\\AXIOS\\${fileName}, filename already in use!`;
            } /// else
            return msg;
        } /// create
        rename(oldFileName, newFileNameInHex) {
            var targetFileKey = this.fileNameExists(oldFileName);
            /// File found
            if (targetFileKey !== '') {
                var paddedFileNameInHex = newFileNameInHex + this.dirBlock.defaultDirectoryBlockZeros.substring(newFileNameInHex.length);
                this.setDirectoryBlockData(targetFileKey, paddedFileNameInHex);
            } /// if
            else {
                return `Cannot rename ${oldFileName}`;
            } /// else
            TSOS.Control.updateVisualDisk();
            return `${oldFileName} renamed to ${this.hexToEnglish(newFileNameInHex)}`;
        } /// rename
        list(type) {
            var isEmpty = true;
            _StdOut.advanceLine();
            /// Iterate through the directory portion of the list and print out based on the argument passed
            for (var trackNum = this.dirBlock.baseTrack; trackNum <= this.dirBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.dirBlock.baseSector; sectorNum <= this.dirBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.dirBlock.baseBlock; blockNum <= this.dirBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (!this.isAvailable(currentKey)) {
                            var fileName = this.hexToEnglish(this.getDirectoryBlockData(currentKey));
                            var fileFlag = parseInt(this.getBlockFlag(currentKey));
                            var fileSize = parseInt(this.getBlockSize(currentKey), 16);
                            var fileSizeSuffix = '';
                            var fileDate = this.getBlockDate(currentKey);
                            var hours = '01';
                            var suffix = '';
                            /// Formatting the date
                            if (!_TwentyFourHourClock) {
                                hours = parseInt(fileDate.substring(8, 10), 16) === 24 ?
                                    (parseInt(fileDate.substring(8, 10), 16) / 24).toString()
                                    : (parseInt(fileDate.substring(8, 10), 16) % 12).toString();
                                suffix = parseInt(fileDate.substring(8, 10), 16) > 12 ? ' PM' : ' AM';
                            } /// if
                            else {
                                hours = parseInt(fileDate.substring(8, 10), 16).toString();
                            } /// else
                            fileDate =
                                parseInt(fileDate.substring(0, 2), 16).toString().padStart(2, '0') + /// Month
                                    "/" + parseInt(fileDate.substring(2, 4), 16).toString() + /// Day
                                    "/" + parseInt(fileDate.substring(4, 8), 16).toString() + /// year
                                    " " + hours + /// hours
                                    ":" + parseInt(fileDate.substring(10, 12), 16).toString().padStart(2, '0') + /// Minutes
                                    ":" + parseInt(fileDate.substring(12, 14), 16).toString().padStart(2, '0') + /// seconds
                                    suffix;
                            /// Formatting file size
                            if (fileSize < 1000) {
                                fileSizeSuffix = ' Bytes';
                            } /// if
                            else if (fileSize < 1000000) {
                                fileSizeSuffix = ' KB';
                            } /// else if
                            else if (fileSize < 1000000000) {
                                fileSizeSuffix = ' MB';
                            } /// else-if
                            else if (fileSize < 1000000000000) {
                                fileSizeSuffix = ' GB';
                            } /// else-if
                            else {
                                fileSizeSuffix = ' TB';
                                /// More...? PB?
                            } /// else
                            /// Only print out hidden file if type is '-l'
                            if (fileName.startsWith(`${this.hiddenFilePrefix}`) && type === '-l' && fileFlag < NEGATIVE_ZERO) {
                                /// Print out file name
                                ///: _StdOut.putText(`${INDENT_STRING}${INDENT_STRING}${sessionStorage.getItem(currentKey).substring(8)}.txt`);
                                _StdOut.putText(`${INDENT_STRING}${INDENT_STRING}${fileName}${INDENT_STRING}${fileDate}${INDENT_STRING}${fileSize}${fileSizeSuffix}`);
                                _StdOut.advanceLine();
                                isEmpty = false;
                            } /// if
                            else if (!fileName.startsWith(`${this.hiddenFilePrefix}`) && fileFlag < NEGATIVE_ZERO) {
                                _StdOut.putText(`${INDENT_STRING}${INDENT_STRING}${fileName}${INDENT_STRING}${fileDate}${INDENT_STRING}${fileSize}${fileSizeSuffix}`);
                                _StdOut.advanceLine();
                                isEmpty = false;
                            } /// if
                        } /// if
                    } /// for
                } /// for
            } /// for
            if (isEmpty) {
                _StdOut.putText(`  No files found`);
                _StdOut.advanceLine();
            } /// if
            _OsShell.putPrompt();
        } /// list
        read(fileName) {
            var isSwapFile = this.isSwapFile(fileName);
            var targetFileKey = this.fileNameExists(fileName);
            /// File found
            if (targetFileKey !== '') {
                // _StdOut.advanceLine();
                // _StdOut.putText(`File Location: ${targetFileKey}`);
                // _StdOut.advanceLine();
                // _StdOut.putText(`File Flag/ID: ${parseInt(this.getBlockFlag(targetFileKey), 16)}`);
                // _StdOut.advanceLine();
                // _StdOut.putText(`File Header Data: ${sessionStorage.getItem(targetFileKey)}`);
                // _StdOut.advanceLine();
                var fileContents = '';
                /// Start at first file block
                var currentPointer = this.getBlockForwardPointer(targetFileKey);
                /// Keep following the links from block to block until the end of the file
                while (currentPointer !== targetFileKey) {
                    /// Since i haven't made the table yet...
                    // _StdOut.advanceLine();
                    // _StdOut.putText(`Location: ${currentPointer}`);
                    // _StdOut.advanceLine();
                    // _StdOut.putText(`Session Storage: ${sessionStorage.getItem(currentPointer)}`);
                    // _StdOut.advanceLine();
                    // _StdOut.putText(`Forward Pointer: ${this.getBlockForwardPointer(currentPointer)}`);
                    // _StdOut.advanceLine();
                    // _OsShell.putPrompt();
                    /// Translate non-swap files only
                    fileContents += isSwapFile ? this.getDataBlockData(currentPointer) : this.hexToEnglish(this.getDataBlockData(currentPointer));
                    /// get next block
                    currentPointer = this.getBlockForwardPointer(currentPointer);
                } /// while
                return fileContents;
            } /// if
            /// File does not exist
            else {
                return `Cannot access C:\\AXIOS\\${fileName}`;
                /// return `Cannot access C:\\AXIOS\\${fileName}.${isSwapFile ? 'txt' : 'swp'}`;
            } /// else 
        } /// read
        write(fileName, data) {
            var dataInHex = data;
            /// Translate non-swap files into hex
            if (!this.isSwapFile(fileName)) {
                dataInHex = this.englishToHex(data).toUpperCase();
            } /// if
            /// See if file exists again...
            var targetFileKey = this.fileNameExists(fileName);
            if (targetFileKey !== '') {
                var freeSpaceKeys = [];
                var moreSpaceFound = false;
                var fileID = parseInt(this.getBlockFlag(targetFileKey), 16);
                var currentSize = 0;
                var fileSize = parseInt(this.getBlockSize(targetFileKey), 16);
                var chunks = dataInHex.match(new RegExp('.{1,' + (2 * DATA_BLOCK_DATA_LIMIT) + '}', 'g'));
                var needMoreSpace = false;
                if ((fileSize - 64) / 64 < chunks.length) {
                    needMoreSpace = true;
                } /// if
                // _StdOut.putText(`Need more space: ${(fileSize - 64) / 64 >= chunks.length}`);
                if (needMoreSpace) {
                    freeSpaceKeys = this.getAvailableBlocksFromDataPartition(chunks.length);
                    if (freeSpaceKeys != null) {
                        moreSpaceFound = true;
                    } /// if
                } /// if
                /// Set previous key to first data block in file
                var currentOverwriteBlockKey = '';
                if (!needMoreSpace || (needMoreSpace && moreSpaceFound)) {
                    /// Begin overwritting the document
                    /// Set previous key to first data block in file
                    var previousBlockKey = targetFileKey;
                    while (chunks.length > 0 && currentSize < fileSize - 64) {
                        /// Grab next free block
                        currentOverwriteBlockKey = this.getBlockForwardPointer(previousBlockKey);
                        /// Grab next free chunk and add right hand padding
                        var currentPaddedChunk = chunks.shift().padEnd(DATA_BLOCK_DATA_LIMIT * 2, '0');
                        /// Set previous block to point to this current free block
                        /// Don't forget the previous block is now "in use" as well
                        this.setBlockForwardPointer(previousBlockKey, currentOverwriteBlockKey);
                        this.setBlockFlag(previousBlockKey, TSOS.Control.formatToHexWithPaddingTwoBytes(fileID));
                        /// Fill the currentBlock with the user data
                        /// Don't forget the current block is now "in use" as well
                        this.setDataBlockData(currentOverwriteBlockKey, this.dirBlock.defaultDataBlockZeros);
                        this.setDataBlockData(currentOverwriteBlockKey, currentPaddedChunk);
                        this.setBlockFlag(currentOverwriteBlockKey, TSOS.Control.formatToHexWithPaddingTwoBytes(fileID));
                        /// Update the previous block
                        previousBlockKey = currentOverwriteBlockKey;
                        currentSize += 64;
                    } /// while
                    /// Pick up where I left off overwritting the file and mark the rest of the file as available
                    var previousBlockKeyContinued = currentOverwriteBlockKey;
                    var temp = currentSize;
                    while (temp < fileSize - 64) {
                        /// Grab next free block
                        var tempCurrentOverwriteBlockKey = this.getBlockForwardPointer(previousBlockKeyContinued);
                        /// I will be damned if this works...
                        this.setBlockForwardPointer(previousBlockKeyContinued, BLOCK_NULL_POINTER);
                        this.setBlockFlag(tempCurrentOverwriteBlockKey, TSOS.Control.formatToHexWithPaddingTwoBytes(NEGATIVE_ZERO));
                        this.setDataBlockData(tempCurrentOverwriteBlockKey, this.dirBlock.defaultDataBlockZeros);
                        TSOS.Control.hostLog(`Reclaimed block ${tempCurrentOverwriteBlockKey}, set flag to ${TSOS.Control.formatToHexWithPaddingTwoBytes(NEGATIVE_ZERO)}`);
                        // _StdOut.putText(`Updated block ${tempCurrentOverwriteBlockKey} flag to ${Control.formatToHexWithPaddingTwoBytes(NEGATIVE_ZERO)}`);
                        // _StdOut.advanceLine();
                        previousBlockKeyContinued = tempCurrentOverwriteBlockKey;
                        temp += 64;
                    } /// while
                    if (temp === fileSize - 64) {
                        this.setBlockForwardPointer(previousBlockKeyContinued, BLOCK_NULL_POINTER);
                    } /// if
                    if (chunks.length === 0) {
                        this.setBlockForwardPointer(currentOverwriteBlockKey, targetFileKey);
                        this.setBlockSize(targetFileKey, TSOS.Control.formatToHexWithPaddingTwoBytes(currentSize + 64));
                        TSOS.Control.updateVisualDisk();
                        return (`Wrote to: C:\\AXIOS\\${fileName}`);
                    } /// if
                } /// if
                if (moreSpaceFound) {
                    /// Find the required number of blocks needed
                    var previousBlockKey = currentOverwriteBlockKey;
                    while (chunks.length > 0) {
                        /// Grab next free block
                        var currentBlockKey = freeSpaceKeys.shift();
                        if (parseInt(this.getBlockFlag(currentBlockKey), 16) > NEGATIVE_ZERO) {
                            this.preserveFileIntegrity(currentBlockKey);
                        } /// if
                        /// Grab next free chunk
                        /// Add right hand padding
                        var currentPaddedChunk = chunks.shift().padEnd(DATA_BLOCK_DATA_LIMIT * 2, '0');
                        /// Set previous block to point to this current free block
                        /// Don't forget the previous block is now "in use" as well
                        this.setBlockForwardPointer(previousBlockKey, currentBlockKey);
                        this.setBlockFlag(previousBlockKey, TSOS.Control.formatToHexWithPaddingTwoBytes(fileID));
                        /// Fill the currentBlock with the user data
                        /// Don't forget the current block is now "in use" as well
                        this.setDataBlockData(currentBlockKey, this.dirBlock.defaultDataBlockZeros);
                        this.setDataBlockData(currentBlockKey, currentPaddedChunk);
                        this.setBlockFlag(currentBlockKey, TSOS.Control.formatToHexWithPaddingTwoBytes(fileID));
                        /// Update the previous block
                        previousBlockKey = currentBlockKey;
                        currentSize += 64;
                    } /// while
                    if (chunks.length === 0) {
                        this.setBlockForwardPointer(currentBlockKey, targetFileKey);
                        this.setBlockSize(targetFileKey, TSOS.Control.formatToHexWithPaddingTwoBytes(currentSize + 64));
                        TSOS.Control.updateVisualDisk();
                        return (`Wrote to: C:\\AXIOS\\${fileName}`);
                    } /// if
                } /// if
                return `Cannot write to C:\\AXIOS\\${fileName}, not enough file data blocks available!`;
            } /// if
            /// File not found
            else {
                return `Cannot write to C:\\AXIOS\\${fileName}, file not found!`;
            } /// else
        } /// write
        deleteFile(fileName) {
            /// See if file exists...
            /// If Not:
            ///     targetFileKey === ''
            /// If Exists
            ///     targetFileKey === the sessionStorage() Key
            var targetFileKey = this.fileNameExists(fileName);
            var isSwapFile = fileName.startsWith(`${this.hiddenFilePrefix}${this.swapFilePrefix}`);
            /// File found
            if (targetFileKey !== '') {
                var msg = '';
                /// Find where file content starts...
                var currentPointer = this.getBlockForwardPointer(targetFileKey);
                /// Request for a deleted file ID
                var deletedFileID = isSwapFile ? -1 : this.idAllocator.allocateNegativeID();
                /// Recover the positive ID
                this.idAllocator.deallocatePositiveID(parseInt(this.getBlockFlag(targetFileKey), 16));
                // _StdOut.putText(`Recovered ID: ${parseInt(this.getBlockFlag(targetFileKey), 16)}`);
                // _StdOut.advanceLine();
                /// Deleted file ID successfully allocated
                if (deletedFileID != -1) {
                    msg = `Deleted C:\\AXIOS\\${fileName}`;
                    deletedFileID = TSOS.Control.formatToHexWithPaddingTwoBytes(deletedFileID);
                } /// if
                /// Ran out of deleted file ID's
                else {
                    msg = `Deleted C:\\AXIOS\\${fileName}`;
                    deletedFileID = TSOS.Control.formatToHexWithPaddingTwoBytes(NEGATIVE_ZERO);
                } /// else
                /// "Delete" by making the directory block available, hopefully this will
                /// make recovering the files easier or at least partial recovery...
                this.setBlockFlag(targetFileKey, deletedFileID);
                /// Keep following the links from block to block until the end of the file
                while (currentPointer != targetFileKey) {
                    /// Make current block available
                    this.setBlockFlag(currentPointer, deletedFileID);
                    if (deletedFileID === -1) {
                        this.setDataBlockData(currentPointer, this.dirBlock.defaultDataBlockZeros);
                    } /// if
                    /// Get next block
                    currentPointer = this.getBlockForwardPointer(currentPointer);
                } /// while
                TSOS.Control.updateVisualDisk();
                return msg;
            } /// if
            /// File NOT found
            else {
                _Kernel.krnTrace(`Cannot delete C:\\AXIOS\\${fileName}`);
                return `Cannot delete C:\\AXIOS\\${fileName}`;
            } /// else
        } /// delete
        /// Last minute sorry
        copyDirectoryFile(filename, copyFilename) {
            /// Search for deleted file in directory
            var targetFileKey = this.fileNameExists(filename);
            var copyFileNameKey = this.fileNameExists(copyFileNameKey);
            /// File found
            if (targetFileKey !== '' && copyFileNameKey === '') {
                var success = this.create(copyFilename);
                if (!success.startsWith('Cannot create')) {
                    var content = this.read(filename);
                    // _StdOut.putText(`${content}`);
                    // _StdOut.advanceLine();
                    if (!content.startsWith('Cannot access') && content.trim().replace(' ', '').length !== 0) {
                        if (!this.write(copyFilename, content).startsWith('Cannot write'))
                            return `Copied ${filename} to ${copyFilename}`;
                        else
                            return `Copied ${filename}, but no space to copy contents`;
                    } /// if
                    else {
                        return `Copied ${filename} to ${copyFilename}`;
                    }
                } /// if
                else {
                    return `Cannot copy ${filename}`;
                } /// else
            } /// if
            /// File not found
            else {
                return `Cannot copy ${filename}, not found`;
            } /// else
        } /// copyDirectoryFile
        /// Hopefully no infinite loops
        recoverDirectoryFile(deletedFileName) {
            /// Search for deleted file in directory
            var targetFileKey = this.deletedFileNameExists(deletedFileName);
            /// File found
            if (targetFileKey !== '') {
                /// Request new ID
                var newID = this.idAllocator.allocatePositiveID();
                /// Got Positive ID 
                if (newID !== -1) {
                    /// Formatted id in hex
                    var formattedNewIdInHex = TSOS.Control.formatToHexWithPaddingTwoBytes(newID);
                    /// Recover negative ID
                    this.idAllocator.deallocateNegativeID(parseInt(this.getBlockFlag(targetFileKey), 16));
                    /// Don't forget to update the file entry flag
                    this.setBlockFlag(targetFileKey, formattedNewIdInHex);
                    /// Start at first file block
                    var currentPointer = this.getBlockForwardPointer(targetFileKey);
                    /// Iterate through the file and change flags to new ID
                    while (currentPointer !== targetFileKey) {
                        /// Change flags to new ID
                        this.setBlockFlag(currentPointer, formattedNewIdInHex);
                        /// get next block
                        currentPointer = this.getBlockForwardPointer(currentPointer);
                    } /// while
                    /// Change filename to avoid duplicates
                    var defaultFileNameInHex = this.englishToHex(`undeleted-${newID}`);
                    var defaultFileNameWithPadding = defaultFileNameInHex + this.dirBlock.defaultDirectoryBlockZeros.substring(defaultFileNameInHex.length);
                    this.setDirectoryBlockData(targetFileKey, defaultFileNameWithPadding);
                    TSOS.Control.updateVisualDisk();
                    return `Recovered file ${deletedFileName}, now called: "undeleted-${newID}". `;
                } /// if
                /// Ran out of ID's
                else {
                    return `Cannot recover ${deletedFileName}, ran out of IDs!`;
                } /// else
            } /// if
            /// File not found
            else {
                return `Cannot recover ${deletedFileName}`;
            } /// else
        } /// recover
        // public recoverOrphans() {}
        getFirstAvailableBlockFromDataPartition() {
            var firstDeletedBlock = null;
            /// Only need to search the "file data" portion of the disk
            for (var trackNum = this.fileDataBlock.baseTrack; trackNum <= this.fileDataBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.fileDataBlock.baseSector; sectorNum <= this.fileDataBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.fileDataBlock.baseBlock; blockNum <= this.fileDataBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.isAvailable(currentKey)) {
                            return currentKey;
                        } /// if
                        if (firstDeletedBlock === null && parseInt(this.getBlockFlag(currentKey), 16) > NEGATIVE_ZERO) {
                            firstDeletedBlock = currentKey;
                        } /// if
                    } /// for
                } /// for
            } /// for
            if (firstDeletedBlock != null) {
                return firstDeletedBlock;
            } /// if 
            else {
                return null;
            } /// else
        } /// getFirstAvailableBlockFromDataPartition
        getFirstAvailableBlockFromDirectoryPartition() {
            var firstDeletedBlock = null;
            /// Only need to search the "file header" portion of the disk
            for (var trackNum = this.dirBlock.baseTrack; trackNum <= this.dirBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.dirBlock.baseSector; sectorNum <= this.dirBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.dirBlock.baseBlock; blockNum <= this.dirBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.isAvailable(currentKey)) {
                            return currentKey;
                        } /// if
                        if (firstDeletedBlock === null && parseInt(this.getBlockFlag(currentKey), 16) > NEGATIVE_ZERO) {
                            firstDeletedBlock = currentKey;
                        } /// if
                    } /// for
                } /// for
            } /// for
            if (firstDeletedBlock != null) {
                return firstDeletedBlock;
            } /// if 
            else {
                return null;
            } /// else
        } /// getFirstAvailableBlockFromDirectoryPartition
        getAvailableBlocksFromDirectoryPartition(numBlocksNeeded) {
            var availableBlocks = [];
            var availableDeletedBlocks = [];
            for (var trackNum = this.dirBlock.baseTrack; trackNum <= this.dirBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.dirBlock.baseSector; sectorNum <= this.dirBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.dirBlock.baseBlock; blockNum <= this.dirBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.isAvailable(currentKey)) {
                            availableBlocks.push(currentKey);
                        } /// if
                        else if (parseInt(this.getBlockFlag(currentKey), 16) > NEGATIVE_ZERO) {
                            availableDeletedBlocks.push(currentKey);
                        } /// if
                    } /// for
                } /// for
            } /// for
            if (availableBlocks.length >= numBlocksNeeded) {
                return availableBlocks;
            } /// if
            else {
                if (availableBlocks.length + availableDeletedBlocks.length >= numBlocksNeeded) {
                    while (availableDeletedBlocks.length > 0) {
                        availableBlocks.push(availableDeletedBlocks.shift());
                    } /// for
                    return availableBlocks;
                } /// if
                else {
                    return null;
                } /// else
            } /// else
        } /// getAvailableBlocksFromDirectoryPartition
        getAvailableBlocksFromDataPartition(numBlocksNeeded) {
            var availableBlocks = [];
            var availableDeletedBlocks = [];
            /// Only need to search the "file data" portion of the disk
            for (var trackNum = this.fileDataBlock.baseTrack; trackNum <= this.fileDataBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.fileDataBlock.baseSector; sectorNum <= this.fileDataBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.fileDataBlock.baseBlock; blockNum <= this.fileDataBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.isAvailable(currentKey)) {
                            availableBlocks.push(currentKey);
                        } /// if
                        else if (parseInt(this.getBlockFlag(currentKey), 16) > NEGATIVE_ZERO) {
                            availableDeletedBlocks.push(currentKey);
                        } /// if
                    } /// for
                } /// for
            } /// for
            if (availableBlocks.length >= numBlocksNeeded) {
                return availableBlocks;
            } /// if
            else {
                if (availableBlocks.length + availableDeletedBlocks.length >= numBlocksNeeded) {
                    while (availableDeletedBlocks.length > 0) {
                        availableBlocks.push(availableDeletedBlocks.shift());
                    } /// for
                    return availableBlocks;
                } /// if
                else {
                    return null;
                } /// else
            } /// else
        } /// getAvailableBlocksFromDataPartition
        fileNameExists(targetFileNameInEnglish) {
            /// Only need to search the "file names" portion of the disk
            for (var trackNum = this.dirBlock.baseTrack; trackNum <= this.dirBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.dirBlock.baseSector; sectorNum <= this.dirBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.dirBlock.baseBlock; blockNum <= this.dirBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.hexToEnglish(this.getDirectoryBlockData(currentKey)) === targetFileNameInEnglish && parseInt(this.getBlockFlag(currentKey), 16) < NEGATIVE_ZERO) {
                            return currentKey;
                        } /// if
                    } /// for
                } /// for
            } /// for
            return '';
        } /// searchDirectory
        deletedFileNameExists(targetFileNameInEnglish) {
            /// Only need to search the "file names" portion of the disk
            for (var trackNum = this.dirBlock.baseTrack; trackNum <= this.dirBlock.limitTrack; ++trackNum) {
                for (var sectorNum = this.dirBlock.baseSector; sectorNum <= this.dirBlock.limitSector; ++sectorNum) {
                    for (var blockNum = this.dirBlock.baseBlock; blockNum <= this.dirBlock.limitBlock; ++blockNum) {
                        var currentKey = `${TSOS.Control.formatToHexWithPadding(trackNum)}${TSOS.Control.formatToHexWithPadding(sectorNum)}${TSOS.Control.formatToHexWithPadding(blockNum)}`;
                        if (this.hexToEnglish(this.getDirectoryBlockData(currentKey)) === targetFileNameInEnglish && parseInt(this.getBlockFlag(currentKey), 16) > NEGATIVE_ZERO) {
                            return currentKey;
                        } /// if
                    } /// for
                } /// for
            } /// for
            return '';
        } /// searchDirectory
        defrag() {
            if (this.formatted) {
                if (!_CPU.isExecuting) {
                    if (!_SingleStepMode) {
                        TSOS.Defragment.defragment();
                        TSOS.Control.updateVisualDisk();
                    } /// if 
                    else {
                        `Cannot defragment the disk while in single step mode! Again, ran out of time for this...`;
                    } /// else
                } /// if
                else {
                    return 'Cannot defragment the disk while processes are running!';
                } /// else
            } // if
            else {
                return 'Cannot defragment an unformatted disk!';
            } /// else
            return '(Hopefully) Defragmented the disk!';
        } /// defrag
        preserveFileIntegrity(nodeToDeleteKey) {
            var previousNodeKey = this.findPreviousBlock(nodeToDeleteKey);
            /// Set current node to point to the node after the node to delete
            if (previousNodeKey != null) {
                var nodeAfterNodeToDelete = this.getBlockForwardPointer(nodeToDeleteKey);
                this.setBlockForwardPointer(previousNodeKey, nodeAfterNodeToDelete);
            } /// if
        } /// preserveDeletedFile
        findPreviousBlock(targetBlockKey) {
            var current = targetBlockKey;
            if (_krnDiskDriver.getBlockForwardPointer(targetBlockKey) === BLOCK_NULL_POINTER) {
                return null;
            } /// if
            /// Iterate through link list until we find the node that points to the node we change
            while (_krnDiskDriver.getBlockForwardPointer(current) != targetBlockKey) {
                current = _krnDiskDriver.getBlockForwardPointer(current);
            } /// while
            return current;
        } /// findPreviousBlock
        isSwapFile(fileName) {
            return fileName.startsWith('.!');
        } /// isSwapFile
        isAvailable(sessionStorageKey) {
            return this.getBlockFlag(sessionStorageKey) === '8000';
        } /// isAvailable
        setBlockFlag(sessionStorageKey, flag) {
            var success = false;
            /// Make sure flag is two bytes, so 4 string characters
            if (flag.length <= 4) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = flag + sessionStorageValue.substring(FLAG_INDEXES.end + 1);
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                success = true;
            } /// if
            return success;
        } /// setBlockFlag
        setBlockForwardPointer(sessionStorageKey, pointer) {
            var success = false;
            /// Make sure forward pointer is 3 bytes, so 6 string characters
            if (pointer.length <= 6) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = sessionStorageValue.substring(FLAG_INDEXES.start, FLAG_INDEXES.end + 1) + pointer + sessionStorageValue.substring(POINTER_INDEXES.end + 1);
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                success = true;
            } /// if
            return success;
        } /// setBlockPointer
        setBlockDate(sessionStorageKey, date) {
            var success = false;
            /// Make sure date is 8 bytes, so 16 string characters
            if (date.length <= 16) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = sessionStorageValue.substring(0, DATE_INDEXES.start) +
                    date + sessionStorageValue.substring(DATE_INDEXES.end + 1);
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                success = true;
            } /// if
            return success;
        } /// setBlockDate
        setBlockSize(sessionStorageKey, size) {
            var success = false;
            /// Make sure size is 2 bytes, so 4 string characters
            if (size.length <= 4) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = sessionStorageValue.substring(0, FILE_SIZE_INDEXES.start) +
                    size + sessionStorageValue.substring(FILE_SIZE_INDEXES.end + 1);
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                success = true;
            } /// if
            return success;
        } /// setBlockDate
        setDirectoryBlockData(sessionStorageKey, newBlockData) {
            /// Make sure data is  only 50 Bytes, so 100 string characters
            if (newBlockData.length <= 100) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = sessionStorageValue.substring(0, DIRECTORY_DATA_INDEXES.start) + newBlockData;
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                return true;
            } /// if
            return false;
        } /// getBlockData
        setDataBlockData(sessionStorageKey, newBlockData) {
            /// Make sure data is  only 59 Bytes, so 118 string characters
            if (newBlockData.length <= 118) {
                var sessionStorageValue = sessionStorage.getItem(sessionStorageKey);
                sessionStorageValue = sessionStorageValue.substring(0, DATA_DATA_INDEXES.start) + newBlockData;
                sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
                return true;
            } /// if
            return false;
        } /// getBlockData
        getBlockFlag(sessionStorageKey) {
            return sessionStorage.getItem(sessionStorageKey).substring(FLAG_INDEXES.start, FLAG_INDEXES.end + 1);
        } /// getBlockFlag
        getBlockForwardPointer(sessionStorageKey) {
            return sessionStorage.getItem(sessionStorageKey).substring(POINTER_INDEXES.start, POINTER_INDEXES.end + 1);
        } /// getBlockNextPointer
        getBlockDate(sessionStorageKey) {
            return sessionStorage.getItem(sessionStorageKey).substring(DATE_INDEXES.start, DATE_INDEXES.end + 1);
        } /// getBlockDate
        getBlockSize(sessionStorageKey) {
            return sessionStorage.getItem(sessionStorageKey).substring(FILE_SIZE_INDEXES.start, FILE_SIZE_INDEXES.end + 1);
        } /// getBlockSize
        getDirectoryBlockData(sessionStorageKey) {
            /// hmm...
            /// How do you know when a program ends in memory...
            /// return isSwapFile ? sessionStorageValue.substring(8) : sessionStorageValue.substring(8).replace('00', '');
            /// Return this for now..
            return sessionStorage.getItem(sessionStorageKey).substring(DIRECTORY_DATA_INDEXES.start, DIRECTORY_DATA_INDEXES.end + 1);
        } /// getDirectoryBlockData
        getDataBlockData(sessionStorageKey) {
            /// hmm...
            /// How do you know when a program ends in memory...
            /// return isSwapFile ? sessionStorageValue.substring(8) : sessionStorageValue.substring(8).replace('00', '');
            /// Return this for now..
            return sessionStorage.getItem(sessionStorageKey).substring(DATA_DATA_INDEXES.start, DATA_DATA_INDEXES.end + 1);
        } /// getDirectoryBlockData
        englishToHex(englishWord) {
            var englishWordInHex = '';
            for (var letter = 0; letter < englishWord.length; ++letter) {
                /// Add left 0 padding
                var paddedhexNumber = "00" + englishWord[letter].charCodeAt(0).toString(16);
                paddedhexNumber = paddedhexNumber.substr(paddedhexNumber.length - 2).toUpperCase();
                /// Get Ascii value from english letter and convert to a single hex character string
                englishWordInHex += paddedhexNumber;
            } /// for
            return englishWordInHex;
        } /// englishToHex
        hexToEnglish(hexWord) {
            var englishWord = '';
            for (var hexLetterPair = 0; hexLetterPair < hexWord.length; hexLetterPair += 2) {
                if (hexWord.substring(hexLetterPair, hexLetterPair + 2) === "00") {
                    break;
                } ///
                else {
                    englishWord += String.fromCharCode(parseInt(
                    /// Read hex digits in pairs
                    hexWord.substr(hexLetterPair, 2), 16 /// To decimal from base 16
                    ) /// parseInt
                    ); /// String.fromCharCode
                } /// else
            } /// for
            return englishWord;
        } /// hexToEnglish
    } /// class
    TSOS.DeviceDriverDisk = DeviceDriverDisk;
    class Partition {
        constructor(name, baseTrack, baseSector, baseBlock, limitTrack, limitSector, limitBlock, defaultDataBlockZeros = '', defaultDirectoryBlockZeros = '') {
            this.name = name;
            this.baseTrack = baseTrack;
            this.baseSector = baseSector;
            this.baseBlock = baseBlock;
            this.limitTrack = limitTrack;
            this.limitSector = limitSector;
            this.limitBlock = limitBlock;
            this.defaultDataBlockZeros = defaultDataBlockZeros;
            this.defaultDirectoryBlockZeros = defaultDirectoryBlockZeros;
            for (var byte = 0; byte < DATA_BLOCK_DATA_LIMIT; ++byte) {
                this.defaultDataBlockZeros += "00";
            } // for
            for (var bytes = 0; bytes < DIRECTORY_BLOCK_DATA_LIMIT; ++bytes) {
                this.defaultDirectoryBlockZeros += "00";
            } // for
        } /// constructor
    } /// Partition
    TSOS.Partition = Partition;
    class IdAllocator {
        /// Not very memory efficient, but I need an id allocator that can quickly allocate and deallocate id's
        ///
        /// Remember 1's comp and 2's comp? 
        /// I sure as hell don't, but I remember the concept...
        /// So followig that looping radix thing Gormanly taught us:
        ///     ~ Every ID <= 32,767 
        ///         - Is in use (so our positive ID's 0 <--> 32,767)
        ///     ~ Every ID > 32,769
        ///         - Is deleted (so our negative ID's also 0 <--> 32,767)
        ///         - but still needs an ID to defrag by and maintain some sort of coherency in recovery
        ///     ~ ID 32,768 is special... files that are neither created nor deleted, it's our second "0", (a.k.a -0);
        constructor(usedFilePositiveID = [], usedFileNegativeID = [], availableFilePositiveID = [], availableFileNegativeID = []) {
            this.usedFilePositiveID = usedFilePositiveID;
            this.usedFileNegativeID = usedFileNegativeID;
            this.availableFilePositiveID = availableFilePositiveID;
            this.availableFileNegativeID = availableFileNegativeID;
            /// Allocate 2 Bytes of ID's
            /// ID 0 is reserved for the master boot record
            for (var i = 1; i <= 32767; ++i) {
                this.availableFilePositiveID.push(i);
            } /// for
            /// Allocate 2 Bytes of ID's
            /// ID 0 is reserved for the master boot record
            for (var i = 32769; i <= 65535; ++i) {
                this.availableFileNegativeID.push(i);
            } /// for
        } /// constructor
        /**
         * Must be fast, since this will be called on every file creation (even swap files...)
         * Name: allocateID
         * Paramaters: none
         * Returns:
         *      1.) id ranging from 1-256
         *      2.) -1 if no id is available
         */
        allocatePositiveID() {
            var id = this.availableFilePositiveID.pop();
            this.usedFilePositiveID.push(id);
            return id === undefined ? -1 : id;
        } /// allocatePositiveID
        allocateNegativeID() {
            var id = this.availableFileNegativeID.pop();
            this.usedFileNegativeID.push(id);
            return id === undefined ? -1 : id;
        } /// allocateNegaiveID
        /**
         * Can be slower as this will be called in deletions and check disk operations...
         * Name: deallocateID
         * Paramaters: id (that will be able to be re-used)
         * Returns:
         *      1.) true
         *      2.) false
         */
        deallocatePositiveID(idToRenew) {
            var i = 0;
            var found = false;
            /// Find the id in the used ID list to move it to the available ID lis
            while (i < this.usedFilePositiveID.length && !found) {
                if (idToRenew === this.usedFilePositiveID[i]) {
                    found = true;
                    this.availableFilePositiveID.push(this.usedFilePositiveID[i]);
                    this.usedFilePositiveID.splice(i, 1);
                } /// if
                else {
                    i++;
                } /// else
            } /// while
            return found;
        } /// deallocatePositiveID
        deallocateNegativeID(idToRenew) {
            var h = 0;
            var found = false;
            while (h < this.usedFileNegativeID.length && !found) {
                if (idToRenew === this.usedFileNegativeID[h]) {
                    found = true;
                    this.availableFileNegativeID.push(this.usedFileNegativeID[h]);
                    this.usedFileNegativeID.splice(h, 1);
                } /// if
                else {
                    h++;
                } /// else
            } /// while
            return found;
        } /// deallocateNegativeID
    } /// fileIdGenerator
    TSOS.IdAllocator = IdAllocator;
})(TSOS || (TSOS = {})); /// TSOS
//# sourceMappingURL=deviceDriverDisk.js.map