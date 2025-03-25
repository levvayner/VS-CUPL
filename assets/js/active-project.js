// @ts-nocheck

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { project: {} };
    
    
    let project = oldState.project;
    updateProjectView();

    // document.querySelector('.selectPin').addEventListener('click', () => {
    //     selectPin();
    // });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'setProject':
            {
                updateProjectView(message.project);                    
                break;
            }    
            case 'clearProject':
            {
                updateProjectView(undefined);
                break;
            }                 

        }
    });
    
    /**
     * @param {Array<{ value: Project }>} project
     */
    function updateProjectView(project) {   
        const panel = document.getElementById('active-project-panel');
        if(project === undefined){
            panel.style.visibility = 'hidden';
            return;
        }     
        panel.style.visibility = 'visible';
        
        const projName = project?.projectName;
        const projDeviceName = project?.deviceConfiguration?.deviceUniqueName;
        const projDevicePackageType = project?.deviceConfiguration?.packageType;
        const projDeviceManufacturer = project?.deviceConfiguration?.manufacturer;
        const projDeviceCode = project?.deviceConfiguration?.deviceCode;
        const projPinOffset = project?._devicePins?.pinOffset ?? 0;

        const divProjName = document.getElementsByClassName('project-name')[0];
        const divProjDeviceName = document.getElementsByClassName('project-device-name')[0];
        const divProjDevicePackageType = document.getElementsByClassName('project-socket')[0];
        const divProjDeviceManufacturer = document.getElementsByClassName('project-manufacturer')[0];
        const divProjDeviceCode = document.getElementsByClassName('project-device-code')[0];
        const divProjPinOffset = document.getElementsByClassName('project-pin-offset')[0]?? 0;

        divProjName.textContent = projName;
        divProjDeviceName.textContent = projDeviceName;
        divProjDevicePackageType.textContent = projDevicePackageType;
        divProjDeviceManufacturer.textContent = projDeviceManufacturer;
        divProjDeviceCode.textContent = projDeviceCode;
        divProjPinOffset.textContent = projPinOffset;

        const button = document.getElementById('configure-project-button');
        button.addEventListener('mouseup',onConfigureClicked);

        console.log(`drew active-project component for ${projDeviceName}`);
        

        // Update the saved state
        vscode.setState({ project: project });
    }

   
    function onConfigureClicked() {
        vscode.postMessage({ type: 'configureProject' });
    }
   

}());


