import {
  MakeUpperTransportPDUParams,
  MakeLowerTransportPDUParams,
  MakeSecureNetworkLayerParams,
  ObfuscateNetworkPDUInput,
  FinalizeNetworkPDUInput,
  MessageType,
} from "../pduBuilder";
import pduBuilder from "../pduBuilder";
import utils from "../../utils/utils";
import MeshConfigurationManager from "../MeshConfigurationManager";
import BluetoothManager from "../BluetoothManager";

enum OpCode {
  GET = "8201",
  SET = "8202",
  SET_UNACK = "8203",
}
interface GenericOnOffClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class GenericOnOffClient {
  private static ctl: string = "0";
  private static defaultTtl: string = "07";
  private static nonceType: "network" = "network";

  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  constructor(configuration: GenericOnOffClientProps) {
    this.bluetoothManager = configuration.bluetoothManager;
    this.meshConfigurationManager = configuration.meshConfigurationManager;
  }

  public sendSetMessage(on: boolean, dst: string, ttl?: string) {
    this.sendMessage(OpCode.SET, on, dst, ttl);
  }
  public sendSetUnackMessage(on: boolean, dst: string, ttl?: string) {
    this.sendMessage(OpCode.SET_UNACK, on, dst, ttl);
  }

  private sendMessage(opCode: OpCode, on: boolean, dst: string, ttl?: string) {
    const seq = this.meshConfigurationManager.getSeq();
    const src = this.meshConfigurationManager.getProvisionerUnicastAddress();
    const ivIndex = this.meshConfigurationManager.getIvIndex();

    const params = (on ? "01" : "00") + utils.toHex(seq, 1);
    const accessPayload = pduBuilder.makeAccessPayload(opCode, params);

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: src,
      dst: dst,
      ivIndex: ivIndex,
      key: this.meshConfigurationManager.getAppKey(),
      accessPayload,
      keyType: "app",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: true,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: dst,
      lowerTransportPDU,
      ctl: GenericOnOffClient.ctl,
      ttl: ttl ?? GenericOnOffClient.defaultTtl,
      seq: seq,
      src: src,
      ivIndex: ivIndex,
      nonceType: GenericOnOffClient.nonceType,
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: GenericOnOffClient.ctl,
      ttl: ttl ?? GenericOnOffClient.defaultTtl,
      seq: seq,
      src: src,
      ivIndex: ivIndex,
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscated = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParams);

    const finalizedNetworkPDUInputParams: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
      obfuscated_ctl_ttl_seq_src: obfuscated.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDU.EncDST,
      encTransportPdu: securedNetworkPDU.EncTransportPDU,
      netmic: securedNetworkPDU.NetMIC,
    };
    const finalizedNetworkPDU = pduBuilder.finalizeNetworkPDU(finalizedNetworkPDUInputParams);

    const proxyPDU = pduBuilder.finalizeProxyPDU(finalizedNetworkPDU, MessageType.NETWORK_PDU);

    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }
}

export default GenericOnOffClient;
