// @ts-check


const DevicePackageType = {
    "dip" : "dip",
    "plcc" : "plcc",
    "pqfp" : "pqfp",
    "tqfp" : "tqfp",
    "undefined" : "undefined",
  }


const PinType = {

    //GENERAL PINS
    'IN' : 'IN',   
    'OUT' : 'OUT',
    'INOUT' : 'INOUT',
    'GND' : 'GND',
    'VCC' : 'VCC',
    //CHIP CUSTOM PINS
    'CLR' : 'CLR',
    'CLK' : 'CLK',
    'PD' : 'PD',
    'OE' : 'OE',
    //JTAG
    'TDI' : 'TDI',
    'TMS' : 'TMS',
    'TCK' : 'TCK',
    'TDO' : 'TDO',
    //NOT CONNECTED
    'NC' : 'NC'

}

class Pin{
    pin;
    pinType;
}
class PinConfiguration{
    name;
    deviceType;
    pinCount;
    pins;
    pinOffset;

}

const PinLayoutOrientation = {
    horizontal : 'horizontal',
    vertical : 'vertical'
};

class ChipUIPin {x; y; w; h; id; type; orientation;}

const pinNumberingScheme = {
    DownUp : 'DownUp',
    OddEven: 'OddEven',
}

window.addEventListener('resize', () => {
    console.log("RESIZE");
    //component.selectedPin = undefined;
    component.updatePinCoordinates();
    component.drawDevice();
});

const MIN_WIDTH = 500;


class PlccChipViewComponent {
    //vscode = acquireVsCodeApi();
    debugMessages = false;
    debugUI = false;
    width  = 0;
    height = 0;
    icMargin = 0;
    layoutName ='';
    packageType = 'dip';
    pinCatalogIndex = 0;
    //icConfigurations = pinConfigurations;
    /** @type {PinConfiguration | undefined} */
    pinConfiguration = undefined;
    scheme = pinNumberingScheme.DownUp;
    

    chipHeight = 0;
    chipWidth = 0;
    chipLeft = 0;
    chipRight = 0;
    chipTop = 0;
    chipBottom = 0;
    horizontalPinWidth = 0;
    verticalPinHeight = 0;
    horizontalPinOffset = 0;
    horizontalPinHeight = 0;
    verticalPinOffset = 0;
    verticalPinWidth = 0;
    pinPerSide = 0;

    pins = [];
    previewingPin;
    selectedPin;
    use;
    
    colors = [];
    initalized = false;
   
    init() {
        this.ic = document.getElementById('ic');
        if(!this.ic){
            return;
        }

        const maxMsBetweenClicks = 250;
        var clickTimeoutId = null;
        this.ic.addEventListener("dblclick", handleDoubleClick);
        this.ic.addEventListener("click",    handleSingleClick);

        function handleSingleClick(e){ 
            clearTimeout(clickTimeoutId);  
            clickTimeoutId = setTimeout( function() { component.selectPin(e);}, maxMsBetweenClicks);            
        }
            
        function handleDoubleClick(e){ 
            clearTimeout(clickTimeoutId); 
            component.addPin(e);            
        }
       
        this.selectedPin = undefined;
        this.use = undefined;
        this.previewingPin = undefined;

        //events
        document.body.onmousemove = function(event) {
            component.previewPin(event);
        };    

        this.initalized = true;
        this.drawDevice();
        
    }

   

    previewPin(event){
        if(event === undefined){
            this.previewingPin = undefined;            
            return;
        }
        
        const pin =this.pins.find(p => p.id == event.target.id.replace("pin-",""));
        
        /* for debugging */
        // console.log(`Mouse (X,Y)): (${event.x}, ${event.y})`);
        // console.log(`Mouse Offset (X,Y): (${event.offsetX}, ${event.offsetY})`);
        // console.log(`Mouse Offset (LEFT,TOP): (${event.offsetLeft}, ${event.offsetTop})`);
        // console.log(`Client (X,Y): (${event.clientX}, ${event.clientY})`);
        // console.log(`Layer (X,Y): (${event.layerX}, ${event.layerY})`);
        // console.log(`Page (X,Y): (${event.pageX}, ${event.pageY})`);
        // console.log(`Screen (X,Y)): (${event.screenX}, ${event.screenY})`);        

        if(!pin || (event.type !== "mousemove" && event.type !== "mouseenter")){
            this.previewingPin = undefined;
            this.drawDevice();
            return;
        }

        if(this.previewingPin?.id === pin?.id){
            return;//nothing to do
        }        
       
        if(this.previewingPin){
            event.target.style.backgroundColor = this.colors.find(c => c.type === 'accent1').color;
        }
        this.previewingPin = pin.id;
        this.drawDevice();
    }

    selectPin(event){
        if(event === undefined){
            this.selectedPin = undefined;
            this.use = undefined;
            return;
        }
        const pin =this.pins.find(p => p.id == event.target.id.replace("pin-",""));
        
        //if(pin){
            vscode.postMessage({
                type: 'selectPin',
                pin: pin
            });
        //}
        this.selectedPin = pin?.id;
        this.drawDevice();
        return pin;
    }

    addPin(event){
        const pin =this.pins.find(p => p.id == event.target.id.replace("pin-",""));
        //const pin = this.getPinAtCoord(event.offsetX, event.offsetY);
        
        if(pin){
            vscode.postMessage({
                type: 'addPin',
                pin: pin
            });
        }
       
        this.selectedPin = pin;
        return pin;
    }

    addPinFromList(pin){
        
        
        if(pin){
            vscode.postMessage({
                type: 'addPin',
                pin: pin
            });
        }
       
        this.selectedPin = pin;
        return pin;
    }


    drawDevice(){
        if(!component.initalized){
            console.log('Draw Device: not initialized - intializing');
            component.init();
        }
        if(this.pinConfiguration === undefined){
            return;
        }
        this.updateDeviceCooridnates();
        this.pins = [];
        
        /*               DIP IC                                              PLCC, TQFP, PQFP layout
                    +------------------------+           +--------------------------------------+
                    | Text Info ...          |           | Text Info ...                        |
                    | Legend ....            |           | Legend ....                          |
                    |   legend cont...       |           |   legend cont...                     |
                    +------------------------+           +--------------------------------------+
                    | +----------margin---+  |           | +----------margin-----------------+  |
                    | |      IC DRAWING   |  |           | |      IC DRAWING                 |  |
                    | |                   |  |           | |    40 39 38 37 36 35...         |  |
                    | |   +-----+         |  |           | |   +-------------------+         |  |
                    | |  1|     | 20      |  |           | |  1|                   | 29      |  |
                    | |  2|     | 19      |  |           | |  2|                   | 28      |  |
                    | |  3|     | 18      |  |           | |  3|                   | 27      |  |
                    | |  4|     | 17      |  |           | |  4|                   | 26      |  |
                    | |...|     | ...     |  |           | |...|                   | ...     |  |
                    | |   +-----+         |  |           | |   +-------------------+         |  |
                    | |                   |  |           | |    11 12 13 14 15 16...         |  |
                    | |                   |  |           | |                                 |  |
                    | +----------margin---+  |           | +----------margin-----------------+  |
                    +------------------------+           +--------------------------------------+
        */
         
        this.updatePinCoordinates();

        if( this.colors.length === 0){
            setTimeout(this.drawDevice, 300);
            return;
        }
        this.drawIC();   
        this.drawUse();
        console.log('drawDevice called');
    }

    drawIC(){
          if(this.pinConfiguration === undefined){
            return;
        }
        //draw IC
        //create div that is large enough to cover the are of the ic;
        
        let chipDiv = document.getElementById('chip');
        if(chipDiv === undefined || chipDiv === null){
            chipDiv = document.createElement('div');
            chipDiv.id = 'chip';
            document.body.appendChild(chipDiv);
             //this.colors.find(c => c.type === 'foreground').color;
        }
        let icDiv = document.getElementById('ic');
        if(icDiv === null || icDiv === undefined){
            icDiv = document.createElement('div');
            chipDiv.appendChild(icDiv);            
        } else{
            icDiv.innerHTML = '';
        }
        
        icDiv.style.height = `${this.chipHeight}px`;
        icDiv.style.left = `${this.horizontalPinWidth + this.horizontalPinOffset}px`;
        icDiv.style.top = `${this.verticalPinHeight + this.verticalPinOffset}px`;
        icDiv.style.width = `${this.chipWidth}px`;

        if(this.pinPerSide !== this.pinConfiguration.pinCount / 2){
            icDiv.style.width = `${this.chipWidth + (this.horizontalPinWidth/2)}px`;
            icDiv.style.height = `${this.chipHeight + (this.verticalPinHeight/2)}px`;            
        }
        icDiv.style.position = 'fixed';
        icDiv.style.backgroundColor = this.colors.find(c => c.type === 'background').color;
        icDiv.style.borderColor = this.colors.find(c => c.type === 'accent2').color;
        icDiv.id = 'ic';
      
        chipDiv.appendChild(icDiv);

        this.calculatePinPositions();
        this.drawPins();

        //draw orientation indicator
        const indicatorDiv = document.createElement('div');
        indicatorDiv.style.left = `${(this.chipLeft + this.chipLeft/10) + + this.horizontalPinOffset}px`;
        indicatorDiv.style.top = `${(this.chipTop + this.chipTop/10) + + this.verticalPinOffset}px`;
        indicatorDiv.style.width = `${this.chipWidth / 20}px`; //keep both same -- circle
        indicatorDiv.style.height = `${this.chipWidth / 20}px`;
        indicatorDiv.style.borderRadius = '50%';
        indicatorDiv.style.backgroundColor = this.colors.find(c => c.type === 'accent3').color;
        indicatorDiv.style.borderColor = this.colors.find(c => c.type === 'background').color;
        indicatorDiv.style.position = 'fixed';

        icDiv.appendChild(indicatorDiv);

        
        
        /*
            chip has 5px padding
            take height of chip, offset from top and bottom by 5% total.
            top to bottom = x number of pins consisting of pinCount*horizontalPinHeight + (pinCount-1*pinSpace)

        */

    }

    drawUse(){
        const icElement = document.getElementById('ic');
        const pin = this.pins.find(p => p.id === this.selectedPin);
        if(pin === undefined){
            return;
        }
        const useLabel = document.createElement('div');
        useLabel.className = 'use-label';
        let useText = `<div class='header'>Pin Details</div> <div>Pin ${this.selectedPin}<br>Use: ${this.use ?? 'Unassigned'}<br>Type: ${pin.type}<div>`;
        useLabel.innerHTML = useText;
        icElement?.appendChild(useLabel);
    }
   
    updateDeviceCooridnates(){

        if(!this.ic || this.pinConfiguration === undefined){
            return;
        }

        this.height = window.innerHeight ;//* window.devicePixelRatio;
        this.width  = window.innerWidth ;//* window.devicePixelRatio;
        if(!this.height || !this.width){
            return;
        }
        if(this.pinPerSide === this.pinConfiguration.pinCount / 2){
            
        }
        else{
            if(this.height > this.width){
                this.height = this.width;
            } else if(this.width > this.height){
                this.width = this.height;
            }
        }
       
        this.ic.setAttribute('height', this.height.toFixed(0));
        this.ic.setAttribute('width', this.width.toFixed(0));

        
        const icRenderPanelHeight = this.height;
        const icRenderPanelWidth = this.width;
        this.icMargin = 10;
        // this.icMargin = icRenderPanelWidth / 50;
        // if(icRenderPanelHeight / 50 < this.icMargin){
        //     this.icMargin = icRenderPanelHeight / 50;
        // }        

        this.horizontalPinWidth = this.icMargin + icRenderPanelWidth/20 < 40  ?  this.icMargin + icRenderPanelWidth/20 : 40;
        this.verticalPinHeight = this.icMargin + icRenderPanelHeight/ 20 < 40 ? this.icMargin + icRenderPanelHeight/ 20 : 40;

        if(this.verticalPinHeight > this.horizontalPinWidth){
            this.verticalPinHeight = this.horizontalPinWidth;
        }
        if(this.horizontalPinWidth > this.verticalPinHeight){
            this.horizontalPinWidth = this.verticalPinHeight;
        }

        //standardize chip sizes
        let chipHeight = icRenderPanelHeight - (2*this.icMargin);
        let chipWidth = this.pinConfiguration.deviceType === DevicePackageType.dip ?
         icRenderPanelWidth - (this.icMargin *2) - (this.horizontalPinWidth * 2) :
        (icRenderPanelWidth- (2*this.icMargin) - (2*this.horizontalPinWidth) > chipHeight )? 
            chipHeight :
            icRenderPanelWidth- (2*this.icMargin) - (2*this.horizontalPinWidth);

        
        if(chipWidth < chipHeight && this.pinConfiguration.deviceType !== DevicePackageType.dip){
            chipHeight = chipWidth;
        }else{
            chipHeight = chipHeight - this.verticalPinHeight;
        }
        // if(chipHeight > chipWidth){
        //     chipHeight = chipWidth;
        // }
        // console.log(`Set chip dimetnions to ${chipWidth} x ${chipHeight}`);
        this.chipHeight = chipHeight;
        this.chipWidth = chipWidth;        

        this.chipLeft = this.horizontalPinWidth + this.icMargin;
        this.chipRight = this.chipWidth + this.horizontalPinWidth + this.icMargin;
        this.chipTop = this.horizontalPinWidth + this.icMargin;
        this.chipBottom = this.chipTop + this.chipHeight;
    }

    updatePinCoordinates(){
        if(!this.ic || this.pinConfiguration === undefined){
            return;
        }
        this.pinPerSide = this.pinConfiguration.deviceType === DevicePackageType.dip ?  this.pinConfiguration.pinCount / 2 : this.pinConfiguration.pinCount / 4;
        
        this.horizontalPinOffset = this.chipHeight / (2*this.pinConfiguration.pinCount + 1);
        this.horizontalPinHeight = ((this.chipHeight - 2*this.horizontalPinOffset) / this.pinPerSide) - this.horizontalPinOffset;
        this.verticalPinOffset = this.chipWidth / (2*this.pinConfiguration.pinCount + 1);
        this.verticalPinWidth = ((this.chipWidth - 2*this.verticalPinOffset) / this.pinPerSide) - this.verticalPinOffset;
    }
    
    calculatePinPositions() {
        if(!this.ic || this.pinConfiguration === undefined){
            return;
        }
        
        const leftPinLeft = this.chipLeft - this.horizontalPinWidth;
        const topPinTop = this.chipTop - this.verticalPinHeight;
        const pinTopOffset = this.chipTop + this.horizontalPinOffset;
        if(this.pinConfiguration.pinOffset === undefined) {this.pinConfiguration.pinOffset = 0; }
        
        for (let idx = 0; idx < this.pinPerSide; idx++) {

            const leftNum = this.pinConfiguration.deviceType === DevicePackageType.dip ? 
                this.scheme === pinNumberingScheme.DownUp ? (idx + 1) : idx * 2 + 1 :
                idx + 1 + this.pinConfiguration.pinOffset;
            const rightNum = this.pinConfiguration.deviceType === DevicePackageType.dip ? 
                this.scheme === pinNumberingScheme.DownUp ? this.pinConfiguration.pinCount - idx : this.pinConfiguration.pinCount - (idx * 2 - 1) :
                this.pinConfiguration.pinCount / 4 * 3 - idx + this.pinConfiguration.pinOffset;
            var topNum = this.pinConfiguration.pinCount - idx + this.pinConfiguration.pinOffset;
            const bottomNum = idx + 1 + this.pinConfiguration.pinCount / 4 + this.pinConfiguration.pinOffset;

            if(topNum > this.pinConfiguration.pinCount){
                topNum -= this.pinConfiguration.pinCount;
            }
            
            this.pins.push({ x: leftPinLeft, y: pinTopOffset + idx * (this.horizontalPinHeight + this.horizontalPinOffset), w: this.horizontalPinWidth, h: this.horizontalPinHeight, id: leftNum , type:this.pinConfiguration.pins[leftNum - 1].pinType, orientation: PinLayoutOrientation.horizontal });
            this.pins.push({ x: this.chipRight, y: pinTopOffset + idx * (this.horizontalPinHeight + this.horizontalPinOffset), w: this.horizontalPinWidth, h: this.horizontalPinHeight, id: rightNum , type:this.pinConfiguration.pins[rightNum - 1].pinType, orientation: PinLayoutOrientation.horizontal });
            if(this.pinConfiguration.deviceType !== DevicePackageType.dip){
                this.pins.push({ x: this.chipLeft + this.verticalPinOffset + idx * (this.verticalPinWidth + this.verticalPinOffset), y: topPinTop, w: this.verticalPinWidth, h: this.verticalPinHeight, id: topNum , type:this.pinConfiguration.pins[topNum - 1].pinType, orientation: PinLayoutOrientation.vertical });
                this.pins.push({ x: this.chipLeft + this.verticalPinOffset + idx * (this.verticalPinWidth + this.verticalPinOffset), y: this.chipBottom, w: this.verticalPinWidth, h: this.verticalPinHeight, id: bottomNum , type:this.pinConfiguration.pins[bottomNum - 1].pinType, orientation: PinLayoutOrientation.vertical });
            }
        }
    }
    
    drawPins() {            
        for (let idx = 0; idx < this.pins.length; idx++) {    
            if(this.pins[idx].id === this.selectedPin || this.pins[idx].id === this.previewingPin){
                continue;
            }
            this.drawPin(this.pins[idx], false, false);
        }
        //now draw selected/preview on top
        const previewPin = this.pins.find(p => p.id === this.previewingPin);
        const selectedPin = this.pins.find(p => p.id === this.selectedPin);
        if(previewPin !== undefined){
            this.drawPin(previewPin, false, true);
        }
        if(selectedPin !== undefined){
            this.drawPin(selectedPin, true, false);
        }
    }

    drawPin(pin, selected = false, preview = false){
        const icDiv = document.getElementById('ic');
        if(icDiv === null){
            return;
        }
        const fontSize = this.width < 300 ? 10 : this.width < 600 ? 12 : this.width < 900 ? 14 : this.width < 1200 ? 16 : 18 ;
        const pinDiv = document.createElement('div');

        pinDiv.className = 'pin';
        if(pin === undefined){
            console.log('undefined pin');
            return;
        }
        pinDiv.id = `pin-${pin.id}`;
        if(selected || preview){
            pinDiv.style.fontSize = `${fontSize + 3}px` ;
        } else{
            pinDiv.style.fontSize = `${fontSize}px` ;        
        }

        /*  FILL  */
        let style = this.colors.find(c => c.type === 'background').color;
        
        /*  STOKE  */
        switch(pin.type[0]){
            
            case PinType.GND:
                style = this.colors.find(c => c.type === 'pinGND').color;
            break;
            case PinType.VCC:
                style = this.colors.find(c => c.type === 'pinVCC').color;
            break;
            case PinType.IN:
                style = this.colors.find(c => c.type === 'pinIN').color;
            break;
            case PinType.INOUT:
                style = this.colors.find(c => c.type === 'pinINOUT').color;
            break;
            case PinType.OUT:
                style = this.colors.find(c => c.type === 'pinOUT').color;
            break;
            case PinType.OE:
                style = this.colors.find(c => c.type === 'pinOE').color;
            break;
            case PinType.CLR:
                style = this.colors.find(c => c.type === 'pinCLR').color;
            break;
            case PinType.CLK:
                style =this.colors.find(c => c.type === 'pinCLK').color;
            break;
            case PinType.PD:
                style = this.colors.find(c => c.type === 'pinPD').color;
            break;
            case PinType.TCK:
                style = this.colors.find(c => c.type === 'pinTCK').color;;
                break;
            case PinType.TDI:
                style = this.colors.find(c => c.type === 'pinTDI').color;
            break;
            case PinType.TDO:
                style = this.colors.find(c => c.type === 'pinTDO').color;
            break;
            case PinType.TMS:
                style = this.colors.find(c => c.type === 'pinTMS').color;
            break;
            case PinType.NC:
                style = this.colors.find(c => c.type === 'pinNC').color;
            break;
        }
        pinDiv.style.backgroundColor = `${ style}`;
        pinDiv.style.borderColor = `${ this.colors.find(c => c.type === 'accent1').color}`;

        if(selected){
            pinDiv.style.borderColor = this.colors.find(c => c.type === 'accent2').color;
            pinDiv.style.borderWidth = `5px`;
        }

        const x = selected || preview ? pin.x - 6 : pin.x;
        const y = selected || preview ? pin.y - 6 : pin.y;
        const w = selected || preview ? pin.w + 12 : pin.w;
        const h = selected || preview ? pin.h + 12 : pin.h;
        pinDiv.style.left = `${x.toFixed(0)}px`;
        pinDiv.style.top = `${y.toFixed(0)}px`;
        pinDiv.style.width = `${w.toFixed(0)}px`;
        pinDiv.style.height = `${h.toFixed(0)}px`;
        pinDiv.style.lineHeight = `${h.toFixed(0)}px`;

        pinDiv.innerHTML = pin.id;
        if(pin.orientation === PinLayoutOrientation.horizontal){            
            pinDiv.style.width = `${w.toFixed(0)}px`;
            pinDiv.style.height = `${h.toFixed(0)}px`;
            pinDiv.style.lineHeight = `${h.toFixed(0)}px`;
        } else{
            pinDiv.style.transform = 'rotate(270deg)';
            pinDiv.style.width = `${h.toFixed(0)}px`;
            pinDiv.style.height = `${w.toFixed(0)}px`;
            pinDiv.style.lineHeight = `${w.toFixed(0)}px`;
        }

        // //events
        // pinDiv.onmouseenter = function(event) {
        //     component.previewPin(event);
        // };       
        pinDiv.onmouseout = function(event){
            component.previewPin(event);
        };
        
        icDiv.appendChild(pinDiv);        
     
    }
    
    setDevice(configuration){
        if(!component.initalized){
            component.init();
        }
        // this.selectedPin = undefined;
        // this.use = undefined;
        if(configuration){
            component.pinConfiguration = configuration;
        }
        console.log(configuration ? `Set Device ${configuration.name}` : 'Cleared Device');
        this.drawDevice();
    }
}
// @ts-ignore
const vscode = acquireVsCodeApi();


const component = new PlccChipViewComponent();
// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	
    
    component.init();

	// const pinView = /** @type {HTMLCanvasElement} */ (document.querySelector('.pinView'));

	const errorContainer = document.createElement('div');
	document.body.appendChild(errorContainer);
	errorContainer.className = 'error';
	errorContainer.style.display = 'none';

	
	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
        console.log(`Received Message ${event.type}`);
		switch (message.type) {
            case 'selectedPin':
				component.selectedPin = message.pin.pin;
                component.drawDevice();
				vscode.setState({selectedPin: component.selectedPin});
                break;
			case 'selectPin':
				component.selectedPin = message.pin.pin;
                component.use = message.pin.use;
                component.drawDevice();
				vscode.setState({selectedPin: component.selectedPin});
                
                
                break;
            case 'previewPin':
                component.previewingPin = message.pin?.pin;
                component.drawDevice();
                vscode.setState({previewingPin: component.previewingPin});    
				break;
            case 'setDevice':
                component.setDevice(message.device);
                vscode.setState({device: message.device.name, pinCount: message.device.pinCount, packageType: message.device.deviceType, topLeftPinOffset: message.device.pinOffset});
                break;

            case 'clearDevice':
                component.selectPin(undefined);
                component.pinConfiguration = undefined;
                component.drawDevice();
                break;
            case 'colors':
                console.log(message.colors);
                component.colors = message.colors;
                component.drawDevice();
                break;
		}
	});

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		component.setDevice(state.device);
	}
}());



