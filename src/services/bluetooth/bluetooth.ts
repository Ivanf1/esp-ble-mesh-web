import crypto from "../../utils/crypto";
import utils from "../../utils/utils";

const configuration = {
  ivIndex: "12345677",
  netKey: "2C9C3BD30D717C1BAB6F20625A966245", //"7dd7364cd842ad18c17c2b820c84c3d6",
  appKey: "25170983bf8af3f02c3a44888db053ee", //"63964771734fbd76e3b40519d1d94a48",
  encryptionKey: "",
  privacyKey: "",
  networkId: "",
};

const MESH_PROXY_SERVICE = "00001828-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_IN = "00002add-0000-1000-8000-00805f9b34fb";
const MESH_PROXY_DATA_OUT = "00002ade-0000-1000-8000-00805f9b34fb";

var sar = 0;
var msg_type = 0;
// network PDU fields
var ivi = 0;
var nid = "00";
var ctl = 0;
var ttl = "07";
var seq = 460810; // 0x0x07080a
var src = "0001";
var dst = "c000"; //"C105";
var seg = 0;
var akf = 1;
var aid = "00";
var opcode;
var opparams;
var access_payload;
var transmic;
var netmic;

let A: any;
let N: any;
let hexEncryptionKey: string;
let hexPrivacyKey: string;
let hexNid: string;
let mesh_proxy_data_in: any;

var mtu = 23;

var proxy_pdu;

var msg;

const initialize = () => {
  N = utils.normaliseHex(configuration.netKey);
  const P = "00";
  A = utils.normaliseHex(configuration.appKey);

  const k2Material = crypto.k2(configuration.netKey, "00");
  console.log(k2Material.NID);
  hexEncryptionKey = k2Material.encryptionKey;
  hexPrivacyKey = k2Material.privacyKey;
  hexNid = k2Material.NID;

  configuration.networkId = crypto.k3(configuration.netKey);
  console.log(configuration.networkId);

  aid = crypto.k4(configuration.appKey);

  const I = utils.normaliseHex(configuration.ivIndex);
  const ivi = utils.leastSignificantBit(parseInt(I, 16));

  console.log(`nid: 0x${nid}`);
  console.log(`aid: 0x${aid}`);
  console.log(`encryptionKey: 0x${configuration.encryptionKey}`);
  console.log(`privacyKey: 0x${configuration.privacyKey}`);
  console.log(`networkId: 0x${configuration.networkId}`);
  console.log(`seq: 0x07080a`);
  console.log(`ivi: 0x${ivi.toString()}`);
};

const scanForProxyNodes = async () => {
  initialize();
  const options = {
    // filters: [{ services: [0x1828] }], // Mesh Proxy Service
    filters: [{ name: "ESP-BLE-MESH" }],
  };

  try {
    const device = await navigator.bluetooth.requestDevice(options);
    console.log("> Connected: " + device.gatt?.connected);
    console.log(`device: ${device}`);
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
        submitPDU();
      }
    }
  } catch (error) {
    console.log("ERROR: could not connect - " + error);
  }
  // deriveProxyPDU();
};

const areMeshProxyCharacteristicsPresent = async (server: BluetoothRemoteGATTServer) => {
  try {
    const proxyService = await server.getPrimaryService(MESH_PROXY_SERVICE);
    const dataIn = await proxyService.getCharacteristic(MESH_PROXY_DATA_IN);
    mesh_proxy_data_in = dataIn;
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

const submitPDU = async () => {
  const proxyPDU = deriveProxyPDU();
  const proxy_pdu_bytes = utils.hexToBytes(proxyPDU);
  const proxy_pdu_data = new Uint8Array(proxy_pdu_bytes);
  console.log(mesh_proxy_data_in);
  await mesh_proxy_data_in.writeValue(proxy_pdu_data.buffer);
  // await mesh_proxy_data_in.writeValue(0x0064de68e1b94ff625e575f940dc4e01a317db88358f59);
  // await mesh_proxy_data_in.writeValue(
  //   hexStringToArrayBuffer("0x0064306c068d146f43292d2365797fad7ed2b32bed9912")
  // );
  // await mesh_proxy_data_in.writeValue(new Uint8Array(23).buffer);
  // mesh_proxy_data_in
  //   .writeValue(proxy_pdu_data.buffer)
  //   .then((_: any) => {
  //     console.log("sent proxy pdu OK");
  //   })
  //   .catch((error: any) => {
  //     alert("Error: " + error);
  //     console.log("Error: " + error);
  //     return;
  //   });
};

function hexStringToArrayBuffer(hexString: string) {
  // remove the leading 0x
  hexString = hexString.replace(/^0x/, "");

  // ensure even number of characters
  if (hexString.length % 2 != 0) {
    console.log("WARNING: expecting an even number of characters in the hexString");
  }

  // check for some non-hex characters
  var bad = hexString.match(/[G-Z\s]/i);
  if (bad) {
    console.log("WARNING: found non-hex characters", bad);
  }

  // split the string into pairs of octets
  var pairs = hexString.match(/[\dA-F]{2}/gi);

  // convert the octets to integers
  var integers = pairs!.map(function (s) {
    return parseInt(s, 16);
  });

  var array = new Uint8Array(integers);
  console.log(array);

  return array.buffer;
}

interface UpperTransportPDU {
  encAccessPayload: {
    EncAccessPayload: string;
    TransMIC: string;
  };
}

const deriveProxyPDU = () => {
  const accessPayload = deriveAccessPayload();
  console.log(accessPayload);

  const upperTransportPDUObj = deriveSecureUpperTransportPDU(accessPayload);
  const upperTransportPDU =
    upperTransportPDUObj.encAccessPayload.EncAccessPayload +
    upperTransportPDUObj.encAccessPayload.TransMIC;

  console.log(`upper transport pdu ${upperTransportPDU}`);

  const lowerTransportPdu = deriveLowerTransportPdu(upperTransportPDUObj);
  console.log(`lower transport pdu ${lowerTransportPdu}`);

  const hexDst = "C000";
  const securedNetwordPDU = deriveSecureNetworkLayer(hexDst, lowerTransportPdu);
  console.log(`secured network PDU`);
  console.log(securedNetwordPDU);

  const obfuscated = obfuscateNetworkPdu(securedNetwordPDU);
  console.log(`obfuscated network PDU`);
  console.log(obfuscated);

  const finalizedNetworkPDU = finaliseNetworkPDU(
    ivi,
    hexNid,
    obfuscated.ctl_ttl_seq_src,
    securedNetwordPDU.EncDST,
    securedNetwordPDU.EncTransportPDU,
    securedNetwordPDU.NetMIC
  );
  console.log(`finalized network PDU ${finalizedNetworkPDU}`);

  const proxyPDU = finaliseProxyPdu(finalizedNetworkPDU);
  console.log(`finalized proxy PDU ${proxyPDU}`);

  if (proxyPDU.length > mtu * 2) {
    // hex chars
    alert("Segmentation required (PDU length > MTU)");
    // valid_pdu = false;
    // app.disableButton("btn_submit");
  }
  return proxyPDU;
};

const finaliseProxyPdu = (finalised_network_pdu: string) => {
  const sm = (sar << 6) | msg_type;
  let proxy_pdu = utils.intToHex(sm) + finalised_network_pdu;
  return proxy_pdu;
};

const deriveAccessPayload = () => {
  let accessPayload = "";
  accessPayload = "8203"; //set unack
  accessPayload = accessPayload + "00"; // onoff off
  accessPayload = accessPayload + "01"; // tid
  const tt = "00"; // transition time
  if (tt != "00") {
    accessPayload = accessPayload + tt;
    accessPayload = accessPayload + "00"; // delay
  }
  return accessPayload;
};

const deriveSecureUpperTransportPDU = (accessPayload: string) => {
  const appNonce = "0100" + utils.toHex(seq, 3) + src + dst + configuration.ivIndex;
  const upperTransportPDU: UpperTransportPDU = {
    encAccessPayload: crypto.meshAuthEncAccessPayload(A, appNonce, accessPayload),
  };

  return upperTransportPDU;
};

const deriveLowerTransportPdu = (upperTransportPdu: UpperTransportPDU) => {
  // seg=0 (1 bit), akf=1 (1 bit), aid (6 bits) already derived from k4
  const segInt = parseInt(seg.toString(), 16);
  const akfInt = parseInt(akf.toString(), 16);
  const aidInt = parseInt(aid, 16);
  const ltpdu1 = (segInt << 7) | (akfInt << 6) | aidInt;
  const lowerTransportPdu =
    utils.intToHex(ltpdu1) +
    upperTransportPdu.encAccessPayload.EncAccessPayload +
    upperTransportPdu.encAccessPayload.TransMIC;
  return lowerTransportPdu;
};

const deriveSecureNetworkLayer = (hexDst: string, lowerTransportPDU: string) => {
  const ctlInt = parseInt(ctl.toString(), 16);
  const ttlInt = parseInt(ttl, 16);
  const ctlTtl = ctlInt | ttlInt;
  const npdu2 = utils.intToHex(ctlTtl);
  N = utils.normaliseHex(hexEncryptionKey);
  const net_nonce = "00" + npdu2 + utils.toHex(seq, 3) + src + "0000" + configuration.ivIndex;
  const network_pdu = crypto.meshAuthEncNetwork(N, net_nonce, hexDst, lowerTransportPDU);
  return network_pdu;
};

const obfuscateNetworkPdu = (network_pdu: any) => {
  const obfuscated = crypto.obfuscate(
    network_pdu.EncDST,
    network_pdu.EncTransportPDU,
    network_pdu.NetMIC,
    ctl,
    ttl,
    utils.toHex(seq, 3),
    src,
    configuration.ivIndex,
    hexPrivacyKey
  );
  return obfuscated;
};

const finaliseNetworkPDU = (
  ivi: any,
  nid: any,
  obfuscated_ctl_ttl_seq_src: any,
  enc_dst: any,
  enc_transport_pdu: any,
  netmic: any
) => {
  const ivi_int = parseInt(ivi, 16);
  const nid_int = parseInt(nid, 16);
  const npdu1 = utils.intToHex((ivi_int << 7) | nid_int);
  const netpdu = npdu1 + obfuscated_ctl_ttl_seq_src + enc_dst + enc_transport_pdu + netmic;
  return netpdu;
};

const bluetooth = {
  scanForProxyNodes,
};

export default bluetooth;
