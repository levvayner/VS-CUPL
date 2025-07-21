import { TextDecoder } from "util";
import * as vscode from "vscode";
import { atfOutputChannel } from "../os/command";
import { PinConfiguration, pinConfigurations } from "./pin-configurations";
export enum AtmIspDeviceActionType {
    programAndVerify = 1,
    erase = 2,
    blankCheck = 3,
    verify = 4, //
    load = 5, //
    secure = 6,
    programVerifySecure = 7, //
    verifySecure = 8,
    readUES = 9,
}
export enum AtmIspDeploymentCableType {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ATDH1150USB = 0,
}

export class AtmIspDeviceAction {
    constructor(
        public deviceName: string,
        public action: AtmIspDeviceActionType,
        public deploymentCableType: AtmIspDeploymentCableType,
        public jedFile: string | undefined
    ) {}
    toString() {
        return `1 4 1 ${this.deploymentCableType}\n\n${this.deviceName}\n10\n${this.action}\n${this.jedFile}`;
    }

    public atmIspDeviceActions = Object.keys(AtmIspDeviceActionType)
        .map((key) => AtmIspDeviceActionType[key as any])
        .filter((value) => typeof value === "string") as string[];
}

export enum DeviceManufacturer {
    "atmel" = "atmel",
    "lattice" = "lattice",
    "any" = "any",
}
export enum DevicePackageType {
    "dip" = "dip",
    "plcc" = "plcc",
    "pqfp" = "pqfp",
    "tqfp" = "tqfp",
    "any" = "any",
}

export enum DeviceDeploymentType {
    "any" = "any",
    "atmisp" = "atmisp",
    "minipro" = "minipro",
    "unsupported" = "unsupported",
}

export class DeviceConfiguration {
    [key: string]: any;
    manufacturer: DeviceManufacturer = DeviceManufacturer.atmel;
    packageType: DevicePackageType = DevicePackageType.dip;
    pinCount: number = 20;
    deviceCode: string = "";
    deviceName: string = ""; // ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL | ISP:
    programmer: DeviceDeploymentType = DeviceDeploymentType.any;
    deviceUniqueName: string = "";
    deviceOptions: string[] | undefined = [];
    pinConfiguration: string | undefined;
    usesPldNameFieldForJedFile: boolean = false;
    openOCDDeviceCode: string | undefined;
}

//TODO: move out into config file
export const deviceList = [
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750",
        deviceName: "ATF750C, ATF750CL, ATF750LVC, ATF750LVCL",
        programmer: "minipro",
        pinConfiguration: "v750",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750b",
        deviceName: " ATF750C, ATF750CL, ATF750LVC, ATF750LVCL",
        programmer: "minipro",
        pinConfiguration: "v750",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750c",
        deviceName: "ATF750C, ATF750CL, ATF750LVC, ATF750LVCL",
        programmer: "minipro",
        pinConfiguration: "v750",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750cppk",
        deviceName: " ATF750C, ATF750CL, ATF750LVC, ATF750LVCL",
        programmer: "minipro",
        pinConfiguration: "v750",
        deviceOptions: ["PPK"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750cext",
        deviceName: " ATF750C, ATF750CL, ATF750LVC, ATF750LVCL",
        programmer: "minipro",
        pinConfiguration: "v750",
        deviceOptions: ["powerdown"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "v750cextppk",
        deviceName: "ATF750C, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750",
        deviceOptions: ["powerdown","PPK"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750lcc",
        deviceName: "ATF750, ATF750L",
        programmer: "minipro",
        pinConfiguration: "v750c",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750blcc",
        deviceName: "ATV750B, ATV750BL",
        programmer: "minipro",
        pinConfiguration: "v750c",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750clcc",
        deviceName: "ATF750C, ATF750CL, ATF750VCL, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750c",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750cextlcc",
        deviceName: "ATF750C, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750c",
        deviceOptions: ["powerdown"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750cextppklcc",
        deviceName: "ATF750C, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750c",
        deviceOptions: ["powerdown", "PPK"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750cextlcc",
        deviceName: "ATF750C, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750c",
        deviceOptions: ["powerdown"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 28,
        deviceCode: "v750cppklcc",
        deviceName: "ATF750C, ATF750LVC",
        programmer: "minipro",
        pinConfiguration: "v750c",
        deviceOptions: ["PPK"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1500",
        deviceName: "ATF1500, ATF1500L",
        programmer: "unsupported",
        pinConfiguration: "f1500",
        usesPldNameFieldForJedFile: false,
    },
    //   {
    //     manufacturer: DeviceManufacturer.atmel,
    //     packageType: DevicePackageType.plcc,
    //     pinCount: 44,
    //     deviceCode: "f1500t",
    //     deviceName: "f1500t",
    //     programmer: "unsupported",
    //     pinConfiguration: 'f1500',
    //     usesPldNameFieldForJedFile: false
    //   },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1500a",
        deviceName: "ATF1500A, ATF1500ABV, ATF1500AL",
        programmer: "unsupported",
        pinConfiguration: "f1500",
        usesPldNameFieldForJedFile: false,
    },
    //   {
    //     manufacturer: DeviceManufacturer.atmel,
    //     packageType: DevicePackageType.plcc,
    //     pinCount: 44,
    //     deviceCode: "f1500at",
    //     deviceName: "f1500at",
    //     programmer: "unsupported",
    //     pinConfiguration: 'f1500',
    //     usesPldNameFieldForJedFile: false
    //   },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1502plcc44",
        deviceName: "ATF1502AS, ATF1502ASL, ATF1502ASV, ATF1502SE, ATF1502SEL",
        programmer: "atmisp",
        pinConfiguration: "f1502",
        openOCDDeviceCode: "150203f",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1502ispplcc44",
        deviceName:
            "ATF1502AS, ATF1502ASL, ATF1502ASV, ATF1502SE, ATF1502SEL",
        programmer: "atmisp",
        pinConfiguration: "f1502",
        openOCDDeviceCode: "150203f",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 44,
        deviceCode: "f1502tqfp44",
        deviceName: "ATF1502AS, ATF1502ASL, ATF1502ASV, ATF1502SE, ATF1502SEL",
        programmer: "atmisp",
        pinConfiguration: "f1502",
        openOCDDeviceCode: "150203f",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 44,
        deviceCode: "f1502isptqfp44",
        deviceName:
            "ATF1502AS, ATF1502ASL, ATF1502ASV, ATF1502SE, ATF1502SEL",
        programmer: "atmisp",
        pinConfiguration: "f1502",
        openOCDDeviceCode: "150203f",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1504plcc44",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        openOCDDeviceCode: "150403f"
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "f1504ispplcc44",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        openOCDDeviceCode: "150403f",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 44,
        deviceCode: "f1504tqfp44",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        openOCDDeviceCode: "151403f",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 44,
        deviceCode: "f1504isptqfp44",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        openOCDDeviceCode: "151403f",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 68,
        deviceCode: "f1504plcc68",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 68,
        deviceCode: "f1504ispplcc68",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 84,
        deviceCode: "f1504plcc84",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 84,
        deviceCode: "f1504ispplcc84",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 100,
        deviceCode: "f1504qfp100",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 100,
        deviceCode: "f1504tqfp100",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 100,
        deviceCode: "f1504ispqfp100",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 100,
        deviceCode: "f1504isptqfp100",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1504",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 84,
        deviceCode: "f1508plcc84",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 84,
        deviceCode: "f1508ispplcc84",
        deviceName: "ATF1504AS, ATF1504ASL, ATF1504ASV, ATF1504ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 100,
        deviceCode: "f1508qfp100",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 100,
        deviceCode: "f1508ispqfp100",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 100,
        deviceCode: "f1508tqfp100",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.tqfp,
        pinCount: 100,
        deviceCode: "f1508isptqfp100",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 160,
        deviceCode: "f1508pqfp160",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
        openOCDDeviceCode: "f151803f",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.pqfp,
        pinCount: 160,
        deviceCode: "f1508isppqfp160",
        deviceName: "ATF1508AS, ATF1508ASL, ATF1508ASV, ATF1508ASVL",
        programmer: "atmisp",
        pinConfiguration: "f1508",
        openOCDDeviceCode: "f151803f",
        deviceOptions: ["ISP"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 40,
        deviceCode: "v2500",
        deviceName: " ATF2500CL, ATF2500CQ, ATF2500CQL",
        programmer: "minipro",
        pinConfiguration: "v2500",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 40,
        deviceCode: "v2500c",
        deviceName: "ATF2500C, ATF2500CL, ATF2500CQ, ATF2500CQL",
        programmer: "minipro",
        pinConfiguration: "v2500",
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.dip,
        pinCount: 40,
        deviceCode: "v2500cppk",
        deviceName: "ATF2500C, ATF2500CL, ATF2500CQ, ATF2500CQL",
        programmer: "minipro",
        pinConfiguration: "v2500",
        deviceOptions: ["PPK"]
    },
    {
        manufacturer: DeviceManufacturer.atmel,
        packageType: DevicePackageType.plcc,
        pinCount: 44,
        deviceCode: "v2500cppklcc",
        deviceName: "ATF2500C, ATF2500CL, ATF2500CQ, ATF2500CQL",
        programmer: "atmisp",
        pinConfiguration: "v2500",
        deviceOptions: ["PPK"]
    },
    {
        manufacturer: DeviceManufacturer.lattice,
        packageType: DevicePackageType.dip,
        pinCount: 20,
        deviceCode: "g16v8a",
        deviceName:
            "ATF16V8B, ATF16V8BQ, ATF16V8BQL, ATF16LV8C, ATF16V8C, ATF16V8CZ",
        programmer: "minipro",
        pinsConfiguration: "16v8",
    },
    {
        manufacturer: DeviceManufacturer.lattice,
        packageType: DevicePackageType.dip,
        pinCount: 20,
        deviceCode: "g16v8cp",
        deviceName: "ATF16LV8C, ATF16V8C, ATF16V8CZ",
        programmer: "minipro",
        pinConfiguration: "16v8",
        deviceOptions: ["powerdown"]
    },
    {
        manufacturer: DeviceManufacturer.lattice,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "g20v8a",
        deviceName:
            "ATF20V8B, ATF20V8BQ, ATF20V8BQL, ATF20V8C, ATF20V8CQ, ATF20V8CQZ",
        programmer: "minipro",
        pinConfiguration: "20v8",
    },
    {
        manufacturer: DeviceManufacturer.lattice,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "g22v10",
        pinConfiguration: "22v10",
        deviceName:
            "ATF22V10B, ATF22V10BQ, ATF22V10BQL, ATF22LV10C, ATF22LV10CQZ, ATF22V10C, ATF22V10CQ, ATF22V10CQZ, ATF22V10CZ",
        programmer: "minipro",
    },
    {
        manufacturer: DeviceManufacturer.lattice,
        packageType: DevicePackageType.dip,
        pinCount: 24,
        deviceCode: "g22v10",
        deviceName: "GAL22V10C",
        programmer: "minipro",
        pinConfiguration: "22v10",
    },
] as DeviceConfiguration[];
