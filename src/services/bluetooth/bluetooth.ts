import crypto from "../../utils/crypto";
import pduBuilder, {
  AccessPayloadInput,
  NetworkLayerInfo,
  ProxyPDU,
  UpperTransportPDUInfo,
} from "../../utils/pduBuilder";
import utils from "../../utils/utils";

const configuration = {
  ivIndex: "00000000",
  ivi: 0,
  netKey: "2C9C3BD30D717C1BAB6F20625A966245",
  appKey: "25170983bf8af3f02c3a44888db053ee",
  encryptionKey: "",
  privacyKey: "",
  NID: "",
  networkId: "",
  AID: "",
  seq: 12,
};

const MESH_PROXY_SERVICE = "00001828-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_IN = "00002add-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_OUT = "00002ade-0000-1000-8000-00805f9b34fb";

const initialize = () => {
  const k2Material = crypto.k2(configuration.netKey, "00");
  configuration.encryptionKey = k2Material.encryptionKey;
  configuration.privacyKey = k2Material.privacyKey;
  configuration.NID = k2Material.NID;

  configuration.networkId = crypto.k3(configuration.netKey);

  configuration.AID = crypto.k4(configuration.appKey);

  configuration.ivi = utils.leastSignificantBit(parseInt(configuration.ivIndex, 16));
};

const makeProxyPDU = (onOff: boolean): ProxyPDU => {
  const val = onOff ? "01" : "00";
  const accessPayloadInfo: AccessPayloadInput = {
    opCode: "8203",
    params: val + utils.toHex(configuration.seq, 1), // tid
  };

  const upperTransportPDUInfo: UpperTransportPDUInfo = {
    appKey: configuration.appKey,
    dst: "c000",
    ivIndex: configuration.ivIndex,
    seq: configuration.seq,
    src: "0008",
  };

  const networkLayerInfo: NetworkLayerInfo = {
    dst: "c000",
    encryptionKey: configuration.encryptionKey,
    ivIndex: configuration.ivIndex,
    seq: configuration.seq,
    src: "0008",
    ttl: "07",
  };

  const proxyPDU = pduBuilder.makeProxyPDU(
    accessPayloadInfo,
    upperTransportPDUInfo,
    networkLayerInfo,
    configuration.AID,
    configuration.privacyKey,
    configuration.ivi,
    configuration.NID
  );

  console.log(proxyPDU);

  return proxyPDU;
};

const sendProxyPDU = (proxyPDU: ProxyPDU, proxyDataIn: BluetoothRemoteGATTCharacteristic) => {
  const proxyPDUBytes = utils.hexToBytes(proxyPDU);
  const proxyPDUData = new Uint8Array(proxyPDUBytes);
  try {
    proxyDataIn.writeValue(proxyPDUData.buffer);
    console.log("sent proxy pdu OK");
    configuration.seq++;
  } catch (error) {
    console.log("Error: " + error);
  }
};

const scanForProxyNode = async () => {
  const options = {
    filters: [
      {
        name: "ESP-BLE-MESH",
        optionalServices: [0x1828], // Mesh Proxy Service
      },
    ],
  };

  try {
    const device = await navigator.bluetooth.requestDevice(options);
    console.log(`> Device: ${device}`);
    console.log("> Name: " + device.name);
    console.log("> Id: " + device.id);
    return device;
  } catch (error) {
    console.log("ERROR: " + error);
  }
};

const connect = async (device: BluetoothDevice) => {
  try {
    const server = await device.gatt?.connect();
    // Avoid returning undefined
    return server ? server : null;
  } catch (error) {
    console.log("ERROR: could not connect - " + error);
  }
  return null;
};

const getMeshProxyDataInDataOutCharacteristics = async (server: BluetoothRemoteGATTServer) => {
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

const onDisconnected = () => {
  console.log("disconnected");
};

const bluetooth = {
  initialize,
  connect,
  getMeshProxyDataInDataOutCharacteristics,
  scanForProxyNode,
  makeProxyPDU,
  sendProxyPDU,
};

export default bluetooth;
