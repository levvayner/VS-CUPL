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

// pinConfigurations

// function getDevicePins(name, pinCount, packageType){
//     let pins;
//     try{
//         pins = pinConfigurations.find(d => d && d.name === name && d.pinCount === pinCount && d.deviceType === packageType );
//     }
//     catch(err){
//         console.log(`Error searching device pinmap: ${err.message}`);
//     }
//     return pins;
// } 

const PinNumberingScheme = {
    DownUp : 'DownUp',
    OddEven: 'OddEven',
}

window.addEventListener('resize', () => {
    console.log("RESIZE");
    component.selectedPin = undefined;
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
    scheme = PinNumberingScheme.DownUp;
    

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
    ctx;
    colors = [];
   
    init() {
        //const ic = document.getElementById("ic");
        this.ic = document.getElementById('ic');
        if(!this.ic){
            return;
        }
        this.ic.onmousemove = function(event) {
            component.previewPin(event);
        };

        

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
        // @ts-ignore
        if(this.ic.getContext){
            // @ts-ignore
            this.ctx = this.ic.getContext('2d');
        }
        this.selectedPin = undefined;
        this.previewingPin = undefined;
        this.drawDevice();
    }

    getPinAtCoord(x,y){
        const testX = x / devicePixelRatio * .98; //not sure why but have to offset after moving into vscode
        const testY = y / devicePixelRatio * .98;
        const pin = this.pins.find(p => p.x <= testX  && testX <= p.x + p.w && p.y <= testY  && testY <= p.y + p.h );
        if(this.debugUI){
            //since preview and selected pin are englarged now, must redraw device
            console.log('-'.repeat(30));
            console.log(`Testing (X,Y)): (${testX}, ${testY})`);
            
            if(pin !== undefined){
                console.log(`Pin (X, Y) (W, H)): (${pin.x}, ${pin.y}) (${pin.w}, ${pin.h})`);
            }
            console.log('-'.repeat(30));
        }
        return pin;
        
    }

    previewPin(event){
        if(event === undefined){
            this.previewingPin = undefined;            
            return;
        }
        const pin = this.getPinAtCoord(event.offsetX, event.offsetY);
        
        /* for debugging */
        console.log(`Mouse (X,Y)): (${event.x}, ${event.y})`);
        console.log(`Mouse Offset (X,Y): (${event.offsetX}, ${event.offsetY})`);
        console.log(`Mouse Offset (LEFT,TOP): (${event.offsetLeft}, ${event.offsetTop})`);
        console.log(`Client (X,Y): (${event.clientX}, ${event.clientY})`);
        console.log(`Layer (X,Y): (${event.layerX}, ${event.layerY})`);
        console.log(`Page (X,Y): (${event.pageX}, ${event.pageY})`);
        console.log(`Screen (X,Y)): (${event.screenX}, ${event.screenY})`);        

        if(!pin){
            this.previewingPin = undefined;
            //this.ctx.clearRect(130,typeYCoord - 18,130,120);
            this.drawDevice();
            return;
        }

        if(this.previewingPin?.id === pin?.id){
            return;//nothing to do
        }        
       
        if(this.previewingPin){
            this.ctx.fillStyle = this.colors.find(c => c.type === 'accent1').color;
        }
        this.previewingPin = pin.id;
        this.drawDevice();

        if(this.debugUI){
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Mouse Coords: (${(event.offsetX / devicePixelRatio).toFixed(0)}, ${(event.offsetY / devicePixelRatio).toFixed(0)})`,0,this.height - 40,150);
            this.ctx.fillText(`Pin Coords: (${pin.x.toFixed(0)}, ${pin.y.toFixed(0)}) width: ${pin.w.toFixed(0)} height: ${pin.h.toFixed(0)}`, 160, this.height - 40,260);
        }        
    }

    selectPin(event){
        if(event === undefined){
            this.selectedPin = undefined;
            return;
        }
        const pin = this.getPinAtCoord(event.offsetX, event.offsetY);
        
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
        
        const pin = this.getPinAtCoord(event.offsetX, event.offsetY);
        
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
        if(this.pinConfiguration === undefined){
            return;
        }
        this.updateDeviceCooridnates();
        this.pins = [];
        
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
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
        if(this.debugMessages)
        {
            this.drawHeader();
        }        
        this.updatePinCoordinates();

        if( this.colors.length === 0){
            setTimeout(this.drawDevice, 300);
            return;
        }
        
        //draw IC
        this.ctx.fillStyle = this.colors.find(c => c.type === 'background').color;
        if(this.pinConfiguration.deviceType === DevicePackageType.plcc){
            this.ctx.fillRect(this.chipLeft - .75*this.horizontalPinWidth,this.chipTop - .75*this.verticalPinHeight,this.chipWidth + 1.5*this.horizontalPinWidth ,this.chipHeight +  1.5*this.verticalPinHeight);
        } else{
            this.ctx.fillRect(this.chipLeft,this.chipTop,this.chipWidth,this.chipHeight);
        }
        this.ctx.strokeStyle = this.ctx.fillStyle = this.colors.find(c => c.type === 'accent2').color;
        if(this.pinConfiguration.deviceType === DevicePackageType.plcc){
            this.ctx.strokeRect(this.chipLeft - .75*this.horizontalPinWidth,this.chipTop - .75*this.verticalPinHeight,this.chipWidth + 1.5*this.horizontalPinWidth ,this.chipHeight +  1.5*this.verticalPinHeight);
        }
        else{
            this.ctx.strokeRect(this.chipLeft,this.chipTop,this.chipWidth,this.chipHeight);
        }
        this.calculatePinPositions();
        this.drawPins();

        this.ctx.beginPath();
        this.ctx.fillStyle = this.colors.find(c => c.type === 'accent3').color;
        this.ctx.arc(this.chipLeft + this.chipWidth/10, this.chipTop +  + this.chipWidth/10, this.chipWidth / 20, 0,2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.strokeStyle = this.colors.find(c => c.type === 'background').color;
        this.ctx.arc(this.chipLeft + this.chipWidth/10, this.chipTop +  + this.chipWidth/10, this.chipWidth / 20, 0,2 * Math.PI);
        this.ctx.stroke();
        
        /*
            chip has 5px padding
            take height of chip, offset from top and bottom by 5% total.
            top to bottom = x number of pins consisting of pinCount*horizontalPinHeight + (pinCount-1*pinSpace)

        */

        if(this.debugUI){
            //border bounds
            this.ctx.strokeStyle ='#f11';
            this.ctx.strokeRect(0,0,this.width, this.height);
            //chip bounds
            this.ctx.strokeStyle ='#1f1';
            this.ctx.strokeRect(this.chipLeft,this.chipTop,this.chipWidth, this.chipHeight);
        }

        console.log('drawDevice called');
        
        

    }
    drawHeader(){
        const fontSize = 14;
        const paragraphWidth = 140;
        this.ctx.fillStyle = this.colors.find(c => c.type === 'foreground').color;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.fillText(`Canvas height: ${this.height}`,0,fontSize+2,100);
        this.ctx.fillText(`Canvas width: ${this.width}`,0,(fontSize+2) * 2,100);

        this.ctx.fillText(`Chip height: ${this.chipHeight.toFixed(0)}`,0,(fontSize+2) * 3,100);
        this.ctx.fillText(`Chip margin: ${this.icMargin.toFixed(0)}`,0,(fontSize+2) * 4,100);
        this.ctx.fillText(`Pin count: ${this.pinConfiguration?.pinCount.toFixed(0)}`,0,(fontSize+2) * 5,100);
        this.ctx.fillText(`Pixel Ratio: ${window.devicePixelRatio}`,0,(fontSize+2) * 6,100);

        
        this.ctx.fillText(`Horizontal Pin height: ${this.horizontalPinHeight.toFixed(0)}`,paragraphWidth,(fontSize+2),100);
        this.ctx.fillText(`Horizontal Pin width: ${this.horizontalPinWidth.toFixed(0)}`,paragraphWidth,(fontSize+2) * 2,100);
        this.ctx.fillText(`Horizontal Pin offset: ${this.horizontalPinOffset.toFixed(0)}`,paragraphWidth,(fontSize+2) * 3,100);

        this.ctx.fillText(`Vertical Pin height: ${this.verticalPinHeight.toFixed(0)}`,paragraphWidth*2,(fontSize+2) * 1,100);
        this.ctx.fillText(`Vertical Pin width: ${this.verticalPinWidth.toFixed(0)}`,paragraphWidth*2,(fontSize+2) * 2,100);
        this.ctx.fillText(`Vertical Pin offset: ${this.verticalPinOffset.toFixed(0)}`,paragraphWidth*2,(fontSize+2) * 3,100);

        this.ctx.fillText(`Catalog Index: ${this.pinCatalogIndex.toFixed(0)}`,paragraphWidth*3,(fontSize+2) * 1,100);
        this.ctx.fillText(`Name: ${this.pinConfiguration?.name}`,paragraphWidth*3,(fontSize+2) * 2,100);
        this.ctx.fillText(`Package: ${this.pinConfiguration?.deviceType}`,paragraphWidth*3,(fontSize+2) * 3,100);            
        
    }
    updateDeviceCooridnates(){

        if(!this.ic || this.pinConfiguration === undefined){
            return;
        }

        this.height = window.innerHeight / window.devicePixelRatio - 50;
        this.width  = window.innerWidth / window.devicePixelRatio - 50;
        if(!this.height || !this.width){
            return;
        }
       
        this.ic.setAttribute('height', this.height.toFixed(0));
        this.ic.setAttribute('width', this.width.toFixed(0));

        const headerHeight = this.debugMessages ? .2*this.height : 0;
        const icRenderPanelHeight = this.height - headerHeight;
        const icRenderPanelWidth = this.width;

        this.icMargin = icRenderPanelWidth / 50;
        if(icRenderPanelHeight / 50 < this.icMargin){
            this.icMargin = icRenderPanelHeight / 50;
        }        

        this.horizontalPinWidth = this.icMargin + icRenderPanelWidth/20 < 40  ?  this.icMargin + icRenderPanelWidth/20 : 40;
        this.verticalPinHeight = this.icMargin + icRenderPanelHeight/ 20 < 40 ? this.icMargin + icRenderPanelHeight/ 20 : 40;

        if(this.verticalPinHeight > this.horizontalPinWidth){
            this.verticalPinHeight = this.horizontalPinWidth;
        }
        if(this.horizontalPinWidth > this.verticalPinHeight){
            this.horizontalPinWidth = this.verticalPinHeight;
        }

        //standardize chip sizes
        let chipHeight = icRenderPanelHeight - (2*this.icMargin) - (2*this.verticalPinHeight);
        let chipWidth = this.pinConfiguration.deviceType === DevicePackageType.dip ?
         icRenderPanelWidth < MIN_WIDTH ? icRenderPanelWidth *.75 : icRenderPanelWidth > 500 ? 500 * .75 : icRenderPanelWidth :
        (icRenderPanelWidth- (2*this.icMargin) - (2*this.horizontalPinWidth) > chipHeight )? 
            chipHeight :
            icRenderPanelWidth- (2*this.icMargin) - (2*this.horizontalPinWidth);

        
        if(chipWidth < chipHeight && this.pinConfiguration.deviceType !== DevicePackageType.dip){
            chipHeight = chipWidth;
        }
        // if(chipHeight > chipWidth){
        //     chipHeight = chipWidth;
        // }
        // console.log(`Set chip dimetnions to ${chipWidth} x ${chipHeight}`);
        this.chipHeight = chipHeight;
        this.chipWidth = chipWidth;        

        this.chipLeft = this.horizontalPinWidth + this.icMargin;
        this.chipRight = this.chipWidth + this.horizontalPinWidth + this.icMargin;
        this.chipTop = headerHeight + this.horizontalPinWidth + this.icMargin;
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
                this.scheme === PinNumberingScheme.DownUp ? (idx + 1) : idx * 2 + 1 :
                idx + 1 + this.pinConfiguration.pinOffset;
            const rightNum = this.pinConfiguration.deviceType === DevicePackageType.dip ? 
                this.scheme === PinNumberingScheme.DownUp ? this.pinConfiguration.pinCount - idx : this.pinConfiguration.pinCount - (idx * 2 - 1) :
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
        this.drawPin(previewPin, false, true);
        this.drawPin(selectedPin, true, false);
    }

    drawPin(pin, selected = false, preview = false){
        let fontSize = this.width < 300 ? 8 : this.width < 600 ? 9 : this.width < 900 ? 10 : this.width < 1200 ? 11 : 12 ;
        if(selected || preview){
            fontSize = fontSize + 3;
        }
        this.ctx.font = `${fontSize}px Arial`;
        /*  FILL  */
        let style = this.colors.find(c => c.type === 'background').color;
        if(pin === undefined){
            return;
        }
        
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
        this.ctx.fillStyle = selected ? this.colors.find(c => c.type === 'theme1').color :
            /*preview ? this.colors.find(c => c.type === 'theme2').color :  */ style;
        this.ctx.strokeStyle = this.colors.find(c => c.type === 'accent1').color;
        const x = selected || preview ? pin.x - 6 : pin.x;
        const y = selected || preview ? pin.y - 6 : pin.y;
        const w = selected || preview ? pin.w + 12 : pin.w;
        const h = selected || preview ? pin.h + 12 : pin.h;
        
        this.ctx.fillRect(x, y, w, h);
        this.ctx.strokeRect(x, y, w, h);
        
        this.ctx.fillStyle = this.colors.find(c => c.type === 'foreground').color;
        if(pin.orientation === PinLayoutOrientation.horizontal){
            
            this.ctx.fillText(pin.id.toFixed(0), pin.x + (this.horizontalPinWidth * .3), pin.y + pin.h / 2 + fontSize/2);
        } else {
            this.ctx.save();
            this.ctx.translate(0, 0);
            this.ctx.rotate(-Math.PI * 2 / 4);
            this.ctx.fillText(pin.id.toFixed(0),-pin.y - (pin.h * .5), pin.x + (pin.w * .5) + fontSize/2);
            this.ctx.rotate(Math.PI * 2 / 4);
            this.ctx.restore();
        }
    }
    
    setDevice(configuration){
        this.selectedPin = undefined;
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



