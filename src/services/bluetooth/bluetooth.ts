import {
  CONFIGURATION_API,
  MESH_PROXY_DATA_IN,
  MESH_PROXY_DATA_OUT,
  MESH_PROXY_SERVICE,
} from "../../constants/bluetooth";
import { LOCAL_STORAGE_SEQ_KEY } from "../../constants/storageKeys";
import crypto from "../../utils/crypto";
import pduBuilder, {
  AccessPayloadInput,
  NetworkLayerInfo,
  ProxyPDU,
  UpperTransportPDUInfo,
} from "../../utils/pduBuilder";
import pduParser, { ParsedProxyPDU } from "../../utils/pduParsers";
import utils from "../../utils/utils";
import { MeshNetworkConfiguration } from "./meshConfiguration.interface";

const getSequenceNumberFromLocalStorage = () => {
  const seq = localStorage.getItem(LOCAL_STORAGE_SEQ_KEY);
  return seq ? JSON.parse(seq) : 0;
};

const updateSequenceNumberInLocalStorage = (seq: number) => {
  localStorage.setItem(LOCAL_STORAGE_SEQ_KEY, JSON.stringify(seq));
};

const configuration = {
  ivIndex: "",
  ivi: 0,
  netKey: "",
  appKey: "",
  encryptionKey: "",
  privacyKey: "",
  NID: "",
  networkId: "",
  AID: "",
  seq: getSequenceNumberFromLocalStorage(),
};

const initialize = async () => {
  const data = await retrieveConfiguration();
  console.log(data);

  configuration.netKey = data.netKeys[0].key;
  configuration.appKey = data.appKeys[0].key;
  configuration.ivIndex = utils.toHex(data.networkExclusions[0].ivIndex, 4);
  configuration.ivi = utils.leastSignificantBit(parseInt(configuration.ivIndex, 16));

  const k2Material = crypto.k2(configuration.netKey, "00");
  configuration.encryptionKey = k2Material.encryptionKey;
  configuration.privacyKey = k2Material.privacyKey;
  configuration.NID = k2Material.NID;

  configuration.networkId = crypto.k3(configuration.netKey);

  configuration.AID = crypto.k4(configuration.appKey);
};

const retrieveConfiguration = async () => {
  const response = await fetch(`${CONFIGURATION_API}?id=1`);
  const data = await response.json();
  return data.config as MeshNetworkConfiguration;
};

const makeProxyPDU = (onOff: boolean): ProxyPDU => {
  const val = onOff ? "01" : "00";
  const accessPayloadInfo: AccessPayloadInput = {
    opCode: "8202",
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
    updateSequenceNumberInLocalStorage(configuration.seq);
  } catch (error) {
    console.log("Error: " + error);
  }
};

const registerProxyPDUNotificationCallback = async (
  proxyDataOut: BluetoothRemoteGATTCharacteristic,
  callback: (parsedProxyPDU: ParsedProxyPDU) => void
) => {
  await proxyDataOut.startNotifications();
  proxyDataOut.addEventListener("characteristicvaluechanged", (e: Event) => {
    const parsedPDU = parseReceivedProxyPDU(e);
    if (parsedPDU) {
      callback(parsedPDU);
    }
  });
};

const parseReceivedProxyPDU = (e: Event) => {
  if (e.target) {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) {
      return pduParser.validatePDU(
        new Uint8Array(value.buffer),
        configuration.privacyKey,
        configuration.NID,
        configuration.encryptionKey,
        configuration.appKey
      );
    }
  }
};

const scanForProxyNode = async () => {
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

const bluetooth = {
  initialize,
  connect,
  getMeshProxyDataInDataOutCharacteristics,
  scanForProxyNode,
  makeProxyPDU,
  sendProxyPDU,
  registerProxyPDUNotificationCallback,
};

export default bluetooth;
