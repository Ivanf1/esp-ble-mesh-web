import {
  MESH_PROVISIONING_DATA_IN,
  MESH_PROVISIONING_DATA_OUT,
  MESH_PROVISIONING_SERVICE,
  MESH_PROXY_DATA_IN,
  MESH_PROXY_DATA_OUT,
  MESH_PROXY_SERVICE,
} from "../constants/bluetooth";
import utils from "../utils/utils";
import { MessageType } from "./pduBuilder";
import MeshConfigurationManager from "./MeshConfigurationManager";
import PDUParser, { ProxyPDU } from "./PduParser";

const TAG = "BLUETOOTH MANAGER";

type ProxyPDUNotificationCallback = (parsedProxyPDU: ProxyPDU) => void;
type ConnectionType = "provisioning" | "proxy";
interface ServiceAndCharacteristics {
  service: string;
  dataIn: string;
  dataOut: string;
}

interface BluetoothManagerProps {
  meshConfigurationManager: MeshConfigurationManager;
}
class BluetoothManager {
  private meshConfigurationManager: MeshConfigurationManager;
  private pduParser: PDUParser;

  private device: BluetoothDevice | null = null;
  private dataIn: BluetoothRemoteGATTCharacteristic | null = null;
  private dataOut: BluetoothRemoteGATTCharacteristic | null = null;

  private proxyPDUNotificationCallbacks: Map<MessageType, ProxyPDUNotificationCallback[]>;
  private serviceAndCharacteristicsForConnectionType: Map<
    ConnectionType,
    ServiceAndCharacteristics
  >;

  constructor(configuration: BluetoothManagerProps) {
    this.meshConfigurationManager = configuration.meshConfigurationManager;
    this.pduParser = PDUParser.getInstance(configuration.meshConfigurationManager);

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

  public async connect(connectionType: ConnectionType) {
    const serviceAndCharacteristicsUUID =
      this.serviceAndCharacteristicsForConnectionType.get(connectionType);
    if (!serviceAndCharacteristicsUUID) return;

    const options: RequestDeviceOptions = {
      filters: [{ name: "ESP-BLE-MESH" }],
      optionalServices: [serviceAndCharacteristicsUUID.service], // Required to access service later.
    };

    try {
      const device = await navigator.bluetooth.requestDevice(options);
      if (!device) return false;

      console.log(`${TAG}: device: ` + device);
      console.log(`${TAG}: name: ${device.name}`);
      console.log(`${TAG}: id: ${device.id}`);

      const server = await this.doConnect(device);
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

  public disconnect() {
    if (!this.device) return;
    this.device.gatt?.disconnect();

    this.device = null;
    this.dataIn = null;
    this.dataOut = null;
  }

  public sendProxyPDU(proxyPDU: string) {
    if (!this.dataIn) return;
    const proxyPDUBytes = utils.hexToBytes(proxyPDU);
    const proxyPDUData = new Uint8Array(proxyPDUBytes);
    try {
      this.dataIn.writeValue(proxyPDUData.buffer);
      this.meshConfigurationManager.updateSeq();
      console.log(`${TAG}: sent proxy pdu OK`);
    } catch (error) {
      console.log(`${TAG}: sending proxy pdu error: ` + error);
    }
  }

  public registerProxyPDUNotificationCallback = (
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

  public registerDisconnectedCallback(callback: (e: Event) => void) {
    if (!this.device) return;
    this.device.addEventListener("gattserverdisconnected", callback);
  }

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
      return this.pduParser.parsePDU(new Uint8Array(value.buffer));
    }
  }

  private async doConnect(device: BluetoothDevice) {
    try {
      const server = await device.gatt?.connect();
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
}

export default BluetoothManager;
