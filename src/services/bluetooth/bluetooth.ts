import crypto from "../../utils/crypto";
import utils from "../../utils/utils";

const configuration = {
  ivIndex: "00000000",
  // netKey: "2C9C3BD30D717C1BAB6F20625A966245", //"7dd7364cd842ad18c17c2b820c84c3d6",
  netKey: "f7a2a44f8e8a8029064f173ddc1e2b00", // from documentation sample. sec 8.1.
  // appKey: "25170983bf8af3f02c3a44888db053ee", //"63964771734fbd76e3b40519d1d94a48",
  appKey: "3216d1509884b533248541792b877f98", // from documentation sample. sec 8.1.
  encryptionKey: "",
  privacyKey: "",
  networkId: "",
};

const MESH_PROXY_SERVICE = "00001828-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_IN = "00002add-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_OUT = "00002ade-0000-1000-8000-00805f9b34fb";

const initialize = () => {
  crypto.s1("smk2");
};

const bluetooth = {
  initialize,
};
export default bluetooth;

const scanForProxyNodes = async () => {
  const options = {
    // filters: [{ services: [0x1828] }], // Mesh Proxy Service
    filters: [{ name: "ESP-BLE-MESH" }],
  };

  try {
    const device = await navigator.bluetooth.requestDevice(options);
    console.log("> Connected: " + device.gatt?.connected);
    console.log(`> device: ${device}`);
    console.log("> Name: " + device.name);
    console.log("> Id: " + device.id);
    await connect(device);
    console.log("> Connected: " + device.gatt?.connected);
  } catch (error) {
    console.log("ERROR: " + error);
  }
};

const connect = async (device: BluetoothDevice) => {
  try {
    const server = await device.gatt?.connect();
    if (server) {
      console.log("Connected to " + server.device.id);
      device.addEventListener("gattserverdisconnected", onDisconnected);
      if (await areMeshProxyCharacteristicsPresent(server)) {
        console.log("mesh characteristics are present");
      }
    }
  } catch (error) {
    console.log("ERROR: could not connect - " + error);
  }
};

const areMeshProxyCharacteristicsPresent = async (server: BluetoothRemoteGATTServer) => {
  try {
    const proxyService = await server.getPrimaryService(MESH_PROXY_SERVICE);
    const dataIn = await proxyService.getCharacteristic(MESH_PROXY_DATA_IN);
    await proxyService.getCharacteristic(MESH_PROXY_DATA_OUT);
    console.log("proxy characteristics found");
    return true;
  } catch (error) {
    console.log("proxy characteristics not found");
    return false;
  }
};

const onDisconnected = () => {
  console.log("disconnected");
};
