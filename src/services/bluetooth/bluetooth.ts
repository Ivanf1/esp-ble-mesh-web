import crypto from "../../utils/crypto";
import pduBuilder, {
  AccessPayloadInput,
  NetworkLayerInfo,
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
  seq: 10,
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

  const accessPayloadInfo: AccessPayloadInput = {
    opCode: "8203",
    params: utils.toHex(configuration.seq, 2), // tid
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

  scanForProxyNodes(proxyPDU);
  configuration.seq++;
};

const bluetooth = {
  initialize,
};
export default bluetooth;

const scanForProxyNodes = async (proxy_pdu: string) => {
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
    console.log("> Connected: " + device.gatt?.connected);
    console.log(`> device: ${device}`);
    console.log("> Name: " + device.name);
    console.log("> Id: " + device.id);
    await connect(device, proxy_pdu);
    console.log("> Connected: " + device.gatt?.connected);
  } catch (error) {
    console.log("ERROR: " + error);
  }
};

const connect = async (device: BluetoothDevice, proxy_pdu: string) => {
  try {
    const server = await device.gatt?.connect();
    if (server) {
      console.log("Connected to " + server.device.id);
      device.addEventListener("gattserverdisconnected", onDisconnected);
      const result = await getMeshProxyDataInDataOutCharacteristics(server);
      if (result) {
        console.log("mesh characteristics are present");
        const [dataIn, _] = result;
        const proxy_pdu_bytes = utils.hexToBytes(proxy_pdu);
        const proxy_pdu_data = new Uint8Array(proxy_pdu_bytes);
        dataIn
          .writeValue(proxy_pdu_data.buffer)
          .then((_) => {
            console.log("sent proxy pdu OK");
          })
          .catch((error) => {
            alert("Error: " + error);
            console.log("Error: " + error);
            return;
          });
      }
    }
  } catch (error) {
    console.log("ERROR: could not connect - " + error);
  }
};

const getMeshProxyDataInDataOutCharacteristics = async (
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic[] | null> => {
  try {
    const proxyService = await server.getPrimaryService(MESH_PROXY_SERVICE);
    const dataIn = await proxyService.getCharacteristic(MESH_PROXY_DATA_IN);
    const dataOut = await proxyService.getCharacteristic(MESH_PROXY_DATA_OUT);
    console.log("proxy characteristics found");
    return [dataIn, dataOut];
  } catch (error) {
    console.log("proxy characteristics not found");
    console.log(error);
    return null;
  }
};

const onDisconnected = () => {
  console.log("disconnected");
};
