import {
  MESH_PROVISIONING_DATA_IN,
  MESH_PROVISIONING_DATA_OUT,
  MESH_PROVISIONING_SERVICE,
  MESH_PROXY_DATA_IN,
  MESH_PROXY_DATA_OUT,
  MESH_PROXY_SERVICE,
} from "../constants/bluetooth";
import { LOCAL_STORAGE_SEQ_KEY } from "../constants/storageKeys";
import { MeshNetworkConfiguration } from "./meshConfiguration.interface";
import utils from "../utils/utils";
import crypto from "./crypto";
import pduParser, { ProxyPDU } from "./pduParser";
import { MessageType } from "./pduBuilder";

const TAG = "BLUETOOTH MANAGER";

type ProxyPDUNotificationCallback = (parsedProxyPDU: ProxyPDU) => void;
type ConnectionType = "provisioning" | "proxy";
interface ServiceAndCharacteristics {
  service: string;
  dataIn: string;
  dataOut: string;
}
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

  private proxyPDUNotificationCallbacks: Map<MessageType, ProxyPDUNotificationCallback[]>;
  private serviceAndCharacteristicsForConnectionType: Map<
    ConnectionType,
    ServiceAndCharacteristics
  >;

  constructor(configuration: BluetoothManagerProps) {
    this.meshConfigurationServerUrl = configuration.meshConfigurationServerUrl;
    this.meshConfigurationId = configuration.meshConfigurationId;
    this.src = "0008";
    this.proxyPDUNotificationCallbacks = new Map();
    this.serviceAndCharacteristicsForConnectionType = new Map();
    this.serviceAndCharacteristicsForConnectionType.set("provisioning", {
      service: MESH_PROVISIONING_SERVICE,
      dataIn: MESH_PROVISIONING_DATA_IN,
      dataOut: MESH_PROVISIONING_DATA_OUT,
    });
    this.serviceAndCharacteristicsForConnectionType.set("proxy", {
      service: MESH_PROXY_SERVICE,
      dataIn: MESH_PROXY_DATA_IN,
      dataOut: MESH_PROXY_DATA_OUT,
    });
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

  async connect(connectionType: ConnectionType) {
    const serviceAndCharacteristicsUUID =
      this.serviceAndCharacteristicsForConnectionType.get(connectionType);
    if (!serviceAndCharacteristicsUUID) return;

    const options: RequestDeviceOptions = {
      filters: [
        {
          name: "ESP-BLE-MESH",
        },
      ],
      optionalServices: [serviceAndCharacteristicsUUID.service], // Required to access service later.
    };

    try {
      const device = await navigator.bluetooth.requestDevice(options);
      if (!device) return false;

      console.log(`${TAG}: device: ` + device);
      console.log(`${TAG}: name: ${device.name}`);
      console.log(`${TAG}: id: ${device.id}`);

      const server = await this.doConnect();
      if (!server) return false;

      console.log(`${TAG}: connected`);

      const characteristics = await this.getDataInDataOutCharacteristics(
        serviceAndCharacteristicsUUID.service,
        serviceAndCharacteristicsUUID.dataIn,
        serviceAndCharacteristicsUUID.dataOut,
        server
      );
      if (!characteristics) return false;

      console.log(`${TAG}: characteristics found`);

      this.device = device;
      this.dataIn = characteristics[0];
      this.dataOut = characteristics[1];

      await this.dataOut.startNotifications();
      this.dataOut.addEventListener("characteristicvaluechanged", (e) =>
        this.proxyPDUNotificationDispatcher(e)
      );

      return true;
    } catch (error) {
      console.log(`${TAG}: connection error: ` + error);
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

  sendProxyPDU(proxyPDU: string) {
    if (!this.dataIn) return;
    const proxyPDUBytes = utils.hexToBytes(proxyPDU);
    const proxyPDUData = new Uint8Array(proxyPDUBytes);
    try {
      this.dataIn.writeValue(proxyPDUData.buffer);
      this.seq++;
      this.updateSequenceNumberInLocalStorage();
      console.log(`${TAG}: sent proxy pdu OK`);
    } catch (error) {
      console.log(`${TAG}: sending proxy pdu error: ` + error);
    }
  }

  registerProxyPDUNotificationCallback = (
    callback: ProxyPDUNotificationCallback,
    messageType: MessageType
  ) => {
    let cbs = this.proxyPDUNotificationCallbacks.get(messageType);
    if (cbs) {
      this.proxyPDUNotificationCallbacks.set(messageType, [...cbs, callback]);
    } else {
      this.proxyPDUNotificationCallbacks.set(messageType, [callback]);
    }
  };

  private proxyPDUNotificationDispatcher(e: Event) {
    const parsedPDU = this.parseReceivedProxyPDU(e);
    if (!parsedPDU) return;

    const cbs = this.proxyPDUNotificationCallbacks.get(parsedPDU.messageType);
    if (cbs) {
      cbs.forEach((cb) => cb(parsedPDU));
    }
  }

  private parseReceivedProxyPDU(e: Event) {
    if (!e.target) return;
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value;

    if (value) {
      return pduParser.validatePDU(new Uint8Array(value.buffer));
    }
  }

  registerDisconnectedCallback(callback: (e: Event) => void) {
    if (!this.device) return;
    this.device.addEventListener("gattserverdisconnected", callback);
  }

  private async doConnect() {
    try {
      const server = await this.device!.gatt?.connect();
      return server;
    } catch (error) {
      console.log(`${TAG}: connection error: ` + error);
    }
  }

  private async getDataInDataOutCharacteristics(
    serviceUUID: string,
    dataInUUID: string,
    dataOutUUID: string,
    server: BluetoothRemoteGATTServer
  ) {
    try {
      const provisioningService = await server.getPrimaryService(serviceUUID);
      const dataIn = await provisioningService.getCharacteristic(dataInUUID);
      const dataOut = await provisioningService.getCharacteristic(dataOutUUID);
      return [dataIn, dataOut];
    } catch (error) {
      console.log(`${TAG}: characteristics not found, error: ` + error);
      return null;
    }
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
