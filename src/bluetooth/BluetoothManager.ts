import {
  MESH_PROXY_DATA_IN,
  MESH_PROXY_DATA_OUT,
  MESH_PROXY_SERVICE,
} from "../constants/bluetooth";
import { LOCAL_STORAGE_SEQ_KEY } from "../constants/storageKeys";
import { MeshNetworkConfiguration } from "./meshConfiguration.interface";
import utils from "../utils/utils";
import crypto from "./crypto";
import { ProxyPDU } from "./pduBuilder";
import pduParser, { ParsedProxyPDU } from "./pduParser";

interface BluetoothManagerProps {
  meshConfigurationServerUrl: string;
  meshConfigurationId: string;
}

class BluetoothManager {
  private meshConfigurationServerUrl: string = "";
  private meshConfigurationId: string = "";

  private ivIndex: string = "";
  private netKey: string = "";
  private appKey: string = "";
  private src: string = "";
  private seq: number = 0;

  // Derived
  private ivi: number = 0;
  private encryptionKey: string = "";
  private privacyKey: string = "";
  private NID: string = "";
  private networkId: string = "";
  private AID: string = "";

  private device: BluetoothDevice | null = null;
  private dataIn: BluetoothRemoteGATTCharacteristic | null = null;
  private dataOut: BluetoothRemoteGATTCharacteristic | null = null;

  constructor(configuration: BluetoothManagerProps) {
    this.meshConfigurationServerUrl = configuration.meshConfigurationServerUrl;
    this.meshConfigurationId = configuration.meshConfigurationId;
    this.src = "0008";
  }

  getConfiguration() {
    return {
      ivIndex: this.ivIndex,
      netKey: this.netKey,
      appKey: this.appKey,
      src: this.src,
      ivi: this.ivi,
      networkId: this.networkId,
      AID: this.AID,
      encryptionKey: this.encryptionKey,
      privacyKey: this.privacyKey,
      NID: this.NID,
    };
  }

  getCurrentSeq() {
    return this.seq;
  }

  async connect(): Promise<boolean> {
    const options: RequestDeviceOptions = {
      filters: [
        {
          name: "ESP-BLE-MESH",
        },
      ],
      optionalServices: [MESH_PROXY_SERVICE], // Required to access service later.
    };

    try {
      const device = await navigator.bluetooth.requestDevice(options);
      console.log(`> Device: ${device}`);
      console.log("> Name: " + device.name);
      console.log("> Id: " + device.id);

      this.device = device;
      const server = await this.doConnect();

      if (server) {
        console.log("Connected");

        const characteristics = await this.getMeshProxyDataInDataOutCharacteristics(server);

        if (characteristics) {
          console.log("proxy characteristics found");

          this.dataIn = characteristics[0];
          this.dataOut = characteristics[1];
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      console.log("ERROR: " + error);
      return false;
    }
  }

  disconnect() {
    if (!this.device) return;
    this.device.gatt?.disconnect();

    this.device = null;
    this.dataIn = null;
    this.dataOut = null;
  }

  sendProxyPDU(proxyPDU: ProxyPDU) {
    if (!this.dataIn) return;
    const proxyPDUBytes = utils.hexToBytes(proxyPDU);
    const proxyPDUData = new Uint8Array(proxyPDUBytes);
    try {
      this.dataIn.writeValue(proxyPDUData.buffer);
      this.seq++;
      this.updateSequenceNumberInLocalStorage();
      console.log("sent proxy pdu OK");
    } catch (error) {
      console.log("Error: " + error);
    }
  }

  registerProxyPDUNotificationCallback = async (
    callback: (parsedProxyPDU: ParsedProxyPDU) => void
  ) => {
    if (!this.dataOut) return;
    await this.dataOut.startNotifications();
    this.dataOut.addEventListener("characteristicvaluechanged", (e: Event) => {
      const parsedPDU = this.parseReceivedProxyPDU(e);
      if (parsedPDU) {
        callback(parsedPDU);
      }
    });
  };

  private parseReceivedProxyPDU = (e: Event) => {
    if (e.target) {
      const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (value) {
        return pduParser.validatePDU(
          new Uint8Array(value.buffer),
          this.privacyKey,
          this.NID,
          this.encryptionKey,
          this.appKey
        );
      }
    }
  };

  registerDisconnectedCallback(callback: (e: Event) => void) {
    if (!this.device) return;
    this.device.addEventListener("gattserverdisconnected", callback);
  }

  private async doConnect() {
    try {
      const server = await this.device!.gatt?.connect();
      // Avoid returning undefined
      return server ? server : null;
    } catch (error) {
      console.log("ERROR: could not connect - " + error);
    }
    return null;
  }

  private getMeshProxyDataInDataOutCharacteristics = async (server: BluetoothRemoteGATTServer) => {
    try {
      const proxyService = await server.getPrimaryService(MESH_PROXY_SERVICE);
      const dataIn = await proxyService.getCharacteristic(MESH_PROXY_DATA_IN);
      const dataOut = await proxyService.getCharacteristic(MESH_PROXY_DATA_OUT);
      return [dataIn, dataOut];
    } catch (error) {
      console.log("proxy characteristics not found, error: " + error);
      return null;
    }
  };

  async initialize() {
    const data = await this.retrieveMeshConfiguration();

    this.netKey = data.netKeys[0].key;
    this.appKey = data.appKeys[0].key;
    this.ivIndex = utils.toHex(data.networkExclusions[0].ivIndex, 4);

    this.ivi = utils.leastSignificantBit(parseInt(this.ivIndex, 16));

    const k2Material = crypto.k2(this.netKey, "00");
    this.encryptionKey = k2Material.encryptionKey;
    this.privacyKey = k2Material.privacyKey;
    this.NID = k2Material.NID;

    this.networkId = crypto.k3(this.netKey);

    this.AID = crypto.k4(this.appKey);

    this.seq = this.getSequenceNumberFromLocalStorage();
  }

  private async retrieveMeshConfiguration() {
    const response = await fetch(
      `${this.meshConfigurationServerUrl}?id=${this.meshConfigurationId}`
    );
    const data = await response.json();
    return data.config as MeshNetworkConfiguration;
  }

  private getSequenceNumberFromLocalStorage = () => {
    const seq = localStorage.getItem(LOCAL_STORAGE_SEQ_KEY);
    return seq ? JSON.parse(seq) : 0;
  };

  private updateSequenceNumberInLocalStorage = () => {
    localStorage.setItem(LOCAL_STORAGE_SEQ_KEY, JSON.stringify(this.seq));
  };
}

export default BluetoothManager;
