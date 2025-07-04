// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();
    const clickMessageType = {
        clear: "clear",
        deviceManufacturer: "deviceManufacturer",
        deviceSocket: "deviceSocket",
        devicePinCount: "devicePinCount",
        deviceModel: "deviceModel",
        deviceConfiguration: "deviceConfiguration",
        save: "save",
        refresh: "refresh"
    };
    const extensionMessageType = { initialize: 1, clear: 2 };
    
    const inputFields = {
        projectName: 1,
        deviceManufacturer: 2,
        deviceSocket: 3,
        devicePinCount: 4,
        deviceModel: 5,
        deviceName: 6,
        deviceCode: 7,
        deviceConfiguration: 8,
        pinOffset: 9,
    };

    const oldState = vscode.getState() || { project: {}, pinConfigurations: [], deviceList: [] };

    let project = oldState.project;
    let pinConfigurations = oldState.pinConfigurations;
    let deviceList = oldState.deviceList;
    updateProjectView();
    

    // handle form element
    function webViewHandleClickEvent(eventSource) {
        const eventTargetId = eventSource.currentTarget.getAttribute("id");
        switch (eventTargetId) {
            case clickMessageType.clear: {
                clearInputs(Object.keys(inputFields));
                populateDropdown(document.getElementById('deviceManufacturer'), new Set(deviceList.map(de => de.manufacturer)));
                
                const mfg = document.getElementById('deviceManufacturer').value;
                populateDropdown(document.getElementById('deviceSocket'), getFilteredSocket(mfg));

                const socket = document.getElementById('deviceSocket').value;
                populateDropdown(document.getElementById('devicePinCount'), getFilteredPins(mfg,socket));

                const pinCount = document.getElementById('devicePinCount').value;
                populateDropdown(document.getElementById('deviceModel'), getFilteredModels(mfg, socket, pinCount));

                const deviceModel = document.getElementById('deviceModel').value;

                document.getElementById("deviceName").value = deviceModel;
                populateDropdown(document.getElementById('deviceConfiguration'), getFilteredConfigurations(mfg, socket, pinCount, deviceModel));                
                setDeviceDetails();
                                
                break;
            }
            case clickMessageType.deviceManufacturer: {
                const mfg = eventSource.currentTarget.value;
                clearInputs([
                    "deviceSocket",
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset", 
                    "deviceConfiguration"
                ]);
                
                populateDropdown(document.getElementById('deviceSocket'), getFilteredSocket(mfg));
                populateDropdown(document.getElementById('devicePinCount'), getFilteredPins(mfg));
                populateDropdown(document.getElementById('deviceModel'), getFilteredModels(mfg));

                break;
            }
            case clickMessageType.deviceSocket: {
                const mfg = document.getElementById('deviceManufacturer').value;
                const socket = eventSource.currentTarget.value;
                clearInputs([
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset", 
                    "deviceConfiguration"
                ]);

                populateDropdown(document.getElementById('devicePinCount'), getFilteredPins(mfg, socket));
                const pinCount = Number(document.getElementById('devicePinCount').value);
                populateDropdown(document.getElementById('deviceModel'), getFilteredModels(mfg, socket, pinCount));

                const deviceModel = document.getElementById('deviceModel').value;

                document.getElementById("deviceName").value = deviceModel;
                populateDropdown(document.getElementById('deviceConfiguration'), getFilteredConfigurations(mfg, socket, pinCount, deviceModel));                
                setDeviceDetails();

                break;             

            }
            case clickMessageType.devicePinCount: {
                clearInputs([
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset",
                    "deviceConfiguration"
                ]);
                const mfg = document.getElementById('deviceManufacturer').value;
                const socket = document.getElementById('deviceSocket').value;
                const pinCount = document.getElementById('devicePinCount').value;
                populateDropdown(document.getElementById('deviceModel'), getFilteredModels(mfg, socket, pinCount));

                const deviceModel = document.getElementById('deviceModel').value;

                document.getElementById("deviceName").value = deviceModel;
                populateDropdown(document.getElementById('deviceConfiguration'), getFilteredConfigurations(mfg, socket, pinCount, deviceModel));                
                setDeviceDetails();
                break;
            }
            case clickMessageType.deviceModel: {
                clearInputs(["deviceName", "deviceCode", "pinOffset", "deviceConfiguration"]);
                const mfg = document.getElementById('deviceManufacturer').value;
                const socket = document.getElementById('deviceSocket').value;
                const pinCount = Number(document.getElementById('devicePinCount').value);
                const deviceModel = document.getElementById('deviceModel').value;

                document.getElementById("deviceName").value = deviceModel;
                populateDropdown(document.getElementById('deviceConfiguration'), getFilteredConfigurations(mfg, socket, pinCount, deviceModel));
                setDeviceDetails();
                break;
            }

            case clickMessageType.deviceConfiguration: {
                clearInputs(["deviceCode", "pinOffset"]);
                setDeviceDetails();
                break;
            }
            // ..

            case clickMessageType.save: {
                const divProjectName = document.getElementById("projectName");
                const inputDeviceName = document.getElementById("deviceName");
                const inputDeviceSocket = document.getElementById("deviceSocket");
                const inputDeviceManufacturer = document.getElementById("deviceManufacturer");
                const inputDevicePinCount = document.getElementById("devicePinCount");
                const inputDeviceCode = document.getElementById("deviceCode");
                const inputDeviceModel = document.getElementById("deviceModel");
                const inputDeviceConfiguration = document.getElementById('deviceConfiguration');
                const inputPinOffset = document.getElementById("pinOffset") ?? 0;

                var uniqueDevice = getUniqueDevice(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value, inputDeviceName.value, inputDeviceConfiguration.value);
                
                vscode.postMessage({
                    command: "save",
                    data: Object.assign({"projectName": divProjectName.innerHTML},uniqueDevice),
                });
                vscode.setState()
                break;
            }

            case clickMessageType.refresh: {
                const divProjectName = document.getElementById("projectName");
                vscode.postMessage({
                    command:"refresh",
                    data: document.title
                });
                break;
            }
            default: {
                vscode.postMessage({
                    command:"alert",
                    text: "Unknown message received:" + message.type
                });
                break;
            }
        }
    }

    /// <*Param*> mfg - manufacturer or undefined
    function getFilteredSocket(mfg){
        return new Set(deviceList.filter(d => mfg === undefined || d.manufacturer === mfg).map(de => de.packageType));
    }

    /// <*Param*> mfg - manufacturer or undefined
    /// <*Param*> socket - socket type or undefined
    function getFilteredPins(mfg, socket){     
 
        return new Set(deviceList.filter(
            d =>  
                (mfg === undefined ||d.manufacturer === mfg) 
                && (socket === undefined || d.packageType === socket)
            )
            .map(de => de.pinCount)
            .sort((a,b) => a - b));
    }

    function getFilteredModels(mfg, socket, pinCount){
        const filteredDeviceModelLists = 
            new Set(deviceList
                .filter(d =>  (mfg === undefined ||d.manufacturer === mfg) 
                    && (socket === undefined || d.packageType === socket)
                    && (pinCount === undefined ||d.pinCount === Number(pinCount))
                )
                .map(de => de.deviceName.indexOf('|') > 0 ? (
                        de.deviceName.substring(0, de.deviceName.indexOf('|'))) : de.deviceName
                    .split(',')
                    .map( d => d.trim())
                )
                .flat()
                .filter(Boolean)
                .map(r => r.split(','))                
                .flat()
                .filter(Boolean)                
                .map( d => d.trim())
                .sort());
        return filteredDeviceModelLists;
    }

    function getFilteredConfigurations(mfg, socket, pinCount, model){
        const filteredOptions = new Set([...' ',
            ...deviceList
                .filter(d =>  
                    d.manufacturer === mfg 
                    && d.packageType === socket 
                    && d.pinCount === Number(pinCount) 
                    && d.deviceName.indexOf(model) >= 0 
                    && d.deviceOptions !== undefined
                )
                .map(de =>  
                    de.deviceOptions
                        .map( d => d.trim())
                    )
                .flat()
                .filter(Boolean)
                // .map(r => r.split(','))
                // .flat()
                // .filter(Boolean)
                .sort()
        ]) //default no options
        ;
        return filteredOptions;
    }

    function getUniqueDevice(mfg, socket, pinCount, deviceModel, deviceConfiguration){
        const device = deviceList
            .find(d =>  
                d.manufacturer === mfg 
                && d.packageType === socket 
                && d.pinCount === Number(pinCount )
                && d.deviceName.indexOf(deviceModel) >= 0 
                &&  (    
                        (deviceConfiguration === undefined || deviceConfiguration === null || deviceConfiguration.trim() === '') || 
                        (d.deviceOptions !== undefined && d.deviceOptions.indexOf(deviceConfiguration >= 0))
                    )
            );
        return Object.assign({"deviceUniqueName": deviceModel},device);
    }

    function setDeviceDetails(){
        const mfg = document.getElementById('deviceManufacturer').value;
        const socket = document.getElementById('deviceSocket').value;
        const pinCount = Number(document.getElementById('devicePinCount').value);
        const deviceModel = document.getElementById('deviceModel').value;
        const deviceConfiguration = document.getElementById('deviceConfiguration').value;

        const uniqueDevice = getUniqueDevice(mfg, socket, pinCount, deviceModel, deviceConfiguration);
        //set device name field
        document.getElementById("deviceName").value = deviceModel;
        document.getElementById("deviceCode").value = uniqueDevice.deviceCode;
        const pinConfig = pinConfigurations.find(pc => 
            pc.name === uniqueDevice.pinConfiguration && pc.deviceType === uniqueDevice.packageType && pc.pinCount === uniqueDevice.pinCount
        );
        document.getElementById("pinOffset").value = pinConfig?.pinOffset ?? 0;
    }


    // Handle messages sent from the extension to the webview
    window.addEventListener("message", (event) => {
        const message = event.data; // The json data that the extension sent
        const messageType = extensionMessageType[message.type];
       
        console.log(
            "Received message for project configuration of type " + message.type
        );
        switch (messageType) {
            case extensionMessageType.initialize: {
                clearInputs([
                    "projectName",
                    "deviceManufacturer",
                    "deviceSocket",
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset",
                ]);
                const initializeData = message.data;
                if(initializeData === undefined || initializeData === null){
                    //we did not receive any data, cannot continue, show error
                    return;
                }
                project = initializeData.project;
                pinConfigurations = initializeData.pinConfigurations;
                deviceList = initializeData.deviceList;
                updateProjectView();
                vscode.setState(initializeData);
                break;
            }
            case extensionMessageType.clear: {
                clearInputs([
                    "deviceSocket",
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset",
                ]);
                break;
            }
            default: {
                alert("Unknown message received:" + message.type);
            }
        }
    });

    function clearInputs(inputFields) {
        if (Array.isArray(inputFields)) {
            inputFields.forEach((f) => clearInput(f));
        } else {
            clearInput(inputFields);
        }
    }

    function clearInput(inputField) {
        var inputFieldElement = document.getElementById(inputField);
        if (inputFieldElement !== undefined && inputFieldElement !== null) {
            inputFieldElement.innerHTML = "";
            inputFieldElement.value = "";
        }
    }

    /**
     * @param {Array<{ value: Project }>} project
     */
    function updateProjectView() {
        const errorPanel = document.getElementById("errorPanel");
        if (project === undefined || deviceList === undefined) {
            //try to resolve
            // const divProjectName = document.getElementById("projectName");
            // vscode.postMessage({
            //     command:"refresh",
            //     data: document.title
            // });

            errorPanel.innerText = "Error loading data";
            errorPanel.style.visibility = "visible";
            const refreshButton = document.createElement('input');
            refreshButton.type='button';
            refreshButton.value = 'Refresh';
            refreshButton.id = 'refresh';
            refreshButton.addEventListener("click",webViewHandleClickEvent);
            errorPanel.appendChild(refreshButton);
            return;
        }
        errorPanel.style.visibility = "hidden";

        const projName = project?.projectName;
        const projDeviceName = project?.deviceConfiguration?.deviceUniqueName;
        const projDeviceSocket = project?.deviceConfiguration?.packageType;
        const projDeviceManufacturer =
            project?.deviceConfiguration?.manufacturer;
        const projDevicePinCount = project?.deviceConfiguration?.pinCount;
        const projDeviceCode = project?.deviceConfiguration?.deviceCode;
        const projPinOffset = project?._devicePins?.pinOffset ?? 0;

        const divProjectName = document.getElementById("projectName");
        const inputDeviceName = document.getElementById("deviceName");
        const inputDeviceSocket = document.getElementById("deviceSocket");
        const inputDeviceManufacturer = document.getElementById("deviceManufacturer");
        const inputDevicePinCount = document.getElementById("devicePinCount");
        const inputDeviceCode = document.getElementById("deviceCode");
        const inputDeviceModel = document.getElementById("deviceModel");
        const inputDeviceConfiguration = document.getElementById('deviceConfiguration');
        const inputPinOffset = document.getElementById("pinOffset") ?? 0;

        const projDeviceOptions = project?.deviceConfiguration?.deviceOptions;

        populateDropdown(inputDeviceManufacturer, new Set(deviceList.map(de => de.manufacturer)));

        populateDropdown(inputDeviceSocket, getFilteredSocket(projDeviceManufacturer));
        
        populateDropdown(inputDevicePinCount, getFilteredPins(projDeviceManufacturer, ));

        populateDropdown(inputDeviceModel, getFilteredModels(projDeviceManufacturer, projDeviceSocket, projDevicePinCount));
        
        inputDeviceName.value = projDeviceName;
        populateDropdown(inputDeviceConfiguration, getFilteredConfigurations(projDeviceManufacturer, projDeviceSocket, projDevicePinCount, projDeviceName));                
        
        divProjectName.innerHTML = projName;
        inputDeviceName.value = projDeviceName;
        inputDeviceModel.value = projDeviceName;
        inputDeviceSocket.value = projDeviceSocket;
        
        inputDeviceCode.value = projDeviceCode;
        inputPinOffset.value = projPinOffset;
        inputDevicePinCount.value = projDevicePinCount;
        inputDeviceConfiguration.value = projDeviceOptions;

        //divProjectName.addEventListener("blur",webViewHandleClickEvent);
        inputDeviceModel.addEventListener("change",webViewHandleClickEvent);
        inputDeviceManufacturer.addEventListener("change",webViewHandleClickEvent);
        inputDeviceSocket.addEventListener("change",webViewHandleClickEvent);
        inputDevicePinCount.addEventListener("change",webViewHandleClickEvent);
        inputDeviceConfiguration.addEventListener("change",webViewHandleClickEvent);

        const clearButton = document.getElementById("clear");
        clearButton.addEventListener("mouseup", webViewHandleClickEvent);

        const resetButton = document.getElementById("refresh");
        resetButton.addEventListener("mouseup", webViewHandleClickEvent);

        const saveButton = document.getElementById("save");
        saveButton.addEventListener("mouseup", webViewHandleClickEvent);

        console.log(`drew project-configurator component for ${projDeviceName}`);

        // Update the saved state
        vscode.setState({ project: project, loaded: true });
    }

    function populateDropdown(element, values){
        values.forEach(v => {
            var option = document.createElement('option');
            option.id = v;
            option.value = v;
            option.text = v;
            element.appendChild(option);
        });
        
    }

    
})();
