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
    const extensionMessageType = { error: 0, initialize: 1, clear: 2 };
    
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
    let showPendingChanges = false;

    const divProjectName = document.getElementById("projectName");
    const inputDeviceName = document.getElementById("deviceName");
    const inputDeviceSocket = document.getElementById("deviceSocket");
    const inputDeviceManufacturer = document.getElementById("deviceManufacturer");
    const inputDevicePinCount = document.getElementById("devicePinCount");
    const inputDeviceCode = document.getElementById("deviceCode");
    const inputDeviceModel = document.getElementById("deviceModel");
    const inputDeviceConfiguration = document.getElementById("deviceConfiguration");
    const inputPinOffset = document.getElementById("pinOffset") ?? 0;

    const pendingChangesLabel = document.getElementById("pendingChanges");
    const clearButton = document.getElementById("clear");
    const resetButton = document.getElementById("refresh");
    const saveButton = document.getElementById("save");

    // handle form element
    function webViewHandleClickEvent(eventSource) {
        //verify vscode is bound
        if(vscode === undefined){
            vscode = acquireVsCodeApi();
            registerExtensionListner();
        }
        const eventTargetId = eventSource.currentTarget.getAttribute("id");
        switch (eventTargetId) {
            case clickMessageType.clear: {
                clearInputs(Object.keys(inputFields));
                populateDropdown(inputDeviceManufacturer, new Set(deviceList.map(de => de.manufacturer)));
                populateForm();
                //updateBackendState();
                break;
            }
            case clickMessageType.deviceManufacturer: {
                clearInputs([
                    "deviceSocket",
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset", 
                    "deviceConfiguration"
                ]);
                populateForm(inputDeviceManufacturer.value);
                updateBackendState(Object.keys(inputFields).find(k => inputFields[k] === inputFields.deviceManufacturer), inputDeviceManufacturer.value);
                break;
            }
            case clickMessageType.deviceSocket: {
                clearInputs([
                    "devicePinCount",
                    "deviceModel",
                    "deviceName",
                    "deviceCode",
                    "pinOffset", 
                    "deviceConfiguration"
                ]);

                populateForm(null, inputDeviceSocket.value);   
                updateBackendState(Object.keys(inputFields).find(k => inputFields[k] === inputFields.deviceSocket), inputDeviceSocket.value);
                
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
                populateForm(null, null, inputDevicePinCount.value); 
                updateBackendState(Object.keys(inputFields).find(k => inputFields[k] === inputFields.devicePinCount), inputDevicePinCount.value);
                break;
            }
            case clickMessageType.deviceModel: {
                clearInputs(["deviceName", "deviceCode", "pinOffset", "deviceConfiguration"]);                
                populateForm(null, null, null,inputDeviceModel.value);
                updateBackendState(Object.keys(inputFields).find(k => inputFields[k] === inputFields.deviceModel), inputDeviceModel.value);
                break;
            }

            case clickMessageType.deviceConfiguration: {
                clearInputs(["deviceCode", "pinOffset"]);
                populateForm(null, null, null,null, inputDeviceConfiguration.value);
                updateBackendState(Object.keys(inputFields).find(k => inputFields[k] === inputFields.deviceConfiguration), inputDeviceConfiguration.value);
                break;
            }
            // ..

            case clickMessageType.save: {
                var uniqueDevice = getUniqueDevice(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value, inputDeviceModel.value, inputDeviceConfiguration.value);
                
                vscode.postMessage({
                    type: "save",
                    data: Object.assign({"projectName": divProjectName.innerHTML},uniqueDevice),
                });
                project.device = uniqueDevice;
                //vscode.setState()
                break;
            }

            case clickMessageType.refresh: {
                vscode.postMessage({
                    type:"refresh",
                    data: document.title
                });
                return;
            }
            default: {
                vscode.postMessage({
                    type:"alert",
                    text: "Unknown message received:" + message.type
                });
                return;
            }
        }
        //check if changes exist, if so, show pending changes label
        const projDeviceName = project?.device?.deviceUniqueName;
        const projDeviceCode = project?.device?.deviceCode;       
        
        
        showPendingChanges = (projDeviceName !== inputDeviceName.value || projDeviceCode !== inputDeviceCode.value);
        pendingChangesLabel.style.display = showPendingChanges ? 'block' : 'none';
    }
    function registerExtensionListner(){
        // Handle messages sent from the extension to the webview
        window.addEventListener("message", (event) => {
            const message = event.data; // The json data that the extension sent
            const messageType = extensionMessageType[message.type];

                
            console.log(
                "Received message for project configuration of type " + message.type
            );
            switch (messageType) {
                case extensionMessageType.initialize: {
                    clearInputs(Object.keys(inputFields));
                    const initializeData = message.body;
                    if(initializeData === undefined || initializeData === null){
                        //we did not receive any data, cannot continue, show error
                        return;
                    }
                    project = initializeData.project;
                    pinConfigurations = initializeData.pinConfigurations;
                    deviceList = initializeData.deviceList;
                    showPendingChanges = false;
                    divProjectName.innerHTML = project.projectName;
                    updateProjectView();                
                    vscode.setState(initializeData);
                    break;
                }
                case extensionMessageType.getFileData:{
                    var uniqueDevice = getUniqueDevice(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value, inputDeviceModel.value, inputDeviceConfiguration.value);
                    
                return Object.assign({"projectName": divProjectName.innerHTML},uniqueDevice);
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
                case 'error':
                    showError(message.text);
                    break;
                default: {
                    alert("Unknown message received:" + message.type);
                }
            }
        });
    }
    

    function updateProjectView() {
        const errorPanel = document.getElementById("errorPanel");
        if (project === undefined || deviceList === undefined) {  
            showError("Error loading data", {id: 'refresh', value: 'Refresh'});
            return;
        }
        errorPanel.style.visibility = "hidden";    

        populateDropdown(inputDeviceManufacturer, new Set(deviceList.map(de => de.manufacturer)));
        populateForm(project?.deviceConfiguration?.manufacturer, project?.deviceConfiguration?.packageType, project?.deviceConfiguration?.pinCount , project?.deviceConfiguration?.deviceUniqueName,  project?.deviceConfiguration?.deviceOptions ?? []);         

        wireEvent(inputDeviceModel,"change");
        wireEvent(inputDeviceManufacturer,"change");
        wireEvent(inputDeviceSocket,"change");
        wireEvent(inputDevicePinCount,"change");
        wireEvent(inputDeviceConfiguration,"change");

        wireEvent(clearButton,"mouseup");
        wireEvent(resetButton,"mouseup");
        wireEvent(saveButton,"mouseup");

        pendingChangesLabel.style.display = showPendingChanges ? 'block' : 'none';
        console.log(`drew project-configurator component for ${project?.deviceConfiguration?.deviceUniqueName}`);
        setDeviceDetails();
        // Update the saved state
        vscode.setState({ project: project, loaded: true });
    }

    function wireEvent(element, event){
        if(element !== undefined && event !== undefined)
        {
            element.addEventListener(event, webViewHandleClickEvent);
        }
    }

    function showError(message, action){
        errorPanel.innerText = message;
        errorPanel.style.visibility = "visible";
        if(action !== undefined && action !== null){
            const refreshButton = document.createElement('input');
            refreshButton.type='button';
            refreshButton.value = action.value;
            refreshButton.id = action.id; 
            refreshButton.addEventListener("click",webViewHandleClickEvent);
            errorPanel.appendChild(refreshButton);
        }
    }

    function populateForm(...args ){        
        if(args.length === 0 || args[0] === undefined){
            inputDeviceManufacturer.value = '';
        }
        if(args.length > 0 && args[0] !== undefined && args[0] !== null){            
            populateDropdown(inputDeviceSocket, getFilteredSocket(inputDeviceManufacturer.value));
        }
        if(args.length <= 1 || args[1] === undefined){
            inputDeviceSocket.value = '';
        }
        if(args.length > 1 && args[1] !== undefined && args[1] !== null){
            inputDeviceSocket.value = args[1]; 
            populateDropdown(inputDevicePinCount, getFilteredPins(inputDeviceManufacturer.value,inputDeviceSocket.value));
        }
        if(args.length <= 2 || args.length > 2 && args[2] === undefined){
            inputDevicePinCount.value ='';
        }
        if(args.length > 2 && args[2] !== undefined && args[2] !== null){
            inputDevicePinCount.value = args[2];
            populateDropdown(inputDeviceModel, getFilteredModels(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value));            
        }
        if(args.length <= 3 ||  args[3] === undefined){
            inputDeviceModel.value =  '';
        }            
        if(args.length > 3 && args[3] !== undefined && args[3] !== null){
            inputDeviceModel.value =  args[3];
            populateDropdown(inputDeviceConfiguration, getFilteredConfigurations(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value, inputDeviceModel.value));             
        }
        if(args.length <= 4 || args[4] === undefined){
            inputDeviceConfiguration.value = '';
        }
        if(args.length > 4 && args[4] !== undefined && args[4] !== null){    
            inputDeviceConfiguration.value = args[4].length === 0 ? '(default)' : args[4];        
            //if(args[4].length > 0){                
                setDeviceDetails();
            //}
        }
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

    function updateBackendState(field, value){
        vscode.postMessage({
            type: "update",
            data: {id: field, value},
        });
        // var uniqueDevice = getUniqueDevice(inputDeviceManufacturer.value, inputDeviceSocket.value, inputDevicePinCount.value, inputDeviceModel.value, inputDeviceConfiguration.value);
        // if(uniqueDevice !== undefined){
        //     vscode.postMessage({
        //         type: "update",
        //         data: Object.assign({"projectName": divProjectName.innerHTML},uniqueDevice),
        //     });
        // }

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
        const filteredOptions = new Set([...['(default)'],
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
                .filter(Boolean)                
                .map(r => Array.isArray(r) && r.length > 1 ? [r] : r)
                .flat(1)
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
                        (deviceConfiguration === undefined || deviceConfiguration === null || deviceConfiguration.trim() === '' || deviceConfiguration.trim() === '(default)' && (d.deviceOptions === undefined || d.deviceOptions.length === 0)) || 
                        (d.deviceOptions !== undefined && d.deviceOptions.every(dc => deviceConfiguration.split(',').includes(dc)))
                    )
            );
        return Object.assign({"deviceUniqueName": deviceModel},device);
    }

    function setDeviceDetails(){      
        const uniqueDevice = getUniqueDevice(inputDeviceManufacturer.value, inputDeviceSocket.value, Number(inputDevicePinCount.value), inputDeviceModel.value, inputDeviceConfiguration.value);
        //set device name field
        inputDeviceName.value = inputDeviceModel.value;
        inputDeviceCode.value = uniqueDevice.deviceCode;        
        const pinConfig = pinConfigurations.find(pc => 
            pc !== null && pc.name === uniqueDevice.pinConfiguration && pc.deviceType === uniqueDevice.packageType && pc.pinCount === uniqueDevice.pinCount
        );
        inputPinOffset.value = pinConfig?.pinOffset ?? 0;
    }
    registerExtensionListner();
    vscode.postMessage({ type: 'ready' });
    
})();
