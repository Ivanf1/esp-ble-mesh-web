import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import MeshConfigurationManager from "../MeshConfigurationManager";
import pduBuilder, {
  MakeUpperTransportPDUParams,
  MakeSegmentedLowerTransportPDUParams,
  MakeSecureNetworkLayerParams,
  ObfuscateNetworkPDUInput,
  FinalizeNetworkPDUInput,
  MessageType,
  MakeLowerTransportPDUParams,
} from "../pduBuilder";
import { ProxyPDU } from "../PduParser";

interface ConfigClientProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class ConfigClient {
  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  constructor(props: ConfigClientProps) {
    this.bluetoothManager = props.bluetoothManager;
    this.meshConfigurationManager = props.meshConfigurationManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      this.onConfigMessageReceived,
      MessageType.NETWORK_PDU
    );
  }

  addAppKey(dst: string, devKey: string) {
    const accessPayload = pduBuilder.makeAccessPayload(
      "00",
      "000000" + this.meshConfigurationManager.getAppKey()
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: 12,
      src: "0001",
      dst: dst,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const [upperTransportPDUSeg0, upperTransportPDUSeg1] =
      pduBuilder.makeSegmentedUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParamsSeg0: MakeSegmentedLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDUSeg0,
      isAppKey: false,
      segN: 1,
      segO: 0,
      seq: 12,
    };
    const lowerTransportPDUSeg0 = pduBuilder.makeSegmentedLowerTransportPDU(
      lowerTransportPDUInputParamsSeg0
    );
    const lowerTransportPDUInputParamsSeg1: MakeSegmentedLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDUSeg1,
      isAppKey: false,
      segN: 1,
      segO: 1,
      seq: 12,
    };
    const lowerTransportPDUSeg1 = pduBuilder.makeSegmentedLowerTransportPDU(
      lowerTransportPDUInputParamsSeg1
    );

    const securedNetworkPDUInputParamsSeg0: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: dst,
      lowerTransportPDU: lowerTransportPDUSeg0,
      ctl: "00",
      ttl: "04",
      seq: 12,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDUSeg0 = pduBuilder.makeSecureNetworkLayer(
      securedNetworkPDUInputParamsSeg0
    );
    const securedNetworkPDUInputParamsSeg1: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: dst,
      lowerTransportPDU: lowerTransportPDUSeg1,
      ctl: "00",
      ttl: "04",
      seq: 12,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDUSeg1 = pduBuilder.makeSecureNetworkLayer(
      securedNetworkPDUInputParamsSeg1
    );

    const obfuscateNetworkPDUInputParamsSeg0: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDUSeg0,
      ctl: "00",
      ttl: "04",
      seq: 12,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscatedSeg0 = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParamsSeg0);
    const obfuscateNetworkPDUInputParamsSeg1: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDUSeg1,
      ctl: "00",
      ttl: "04",
      seq: 12,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      privacyKey: this.meshConfigurationManager.getPrivacyKey(),
    };
    const obfuscatedSeg1 = pduBuilder.obfuscateNetworkPDU(obfuscateNetworkPDUInputParamsSeg1);

    const finalizedNetworkPDUInputParamsSeg0: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
      obfuscated_ctl_ttl_seq_src: obfuscatedSeg0.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDUSeg0.EncDST,
      encTransportPdu: securedNetworkPDUSeg0.EncTransportPDU,
      netmic: securedNetworkPDUSeg0.NetMIC,
    };
    const finalizedNetworkPDUSeg0 = pduBuilder.finalizeNetworkPDU(
      finalizedNetworkPDUInputParamsSeg0
    );
    const finalizedNetworkPDUInputParamsSeg1: FinalizeNetworkPDUInput = {
      ivi: this.meshConfigurationManager.getIvi(),
      nid: this.meshConfigurationManager.getNID(),
      obfuscated_ctl_ttl_seq_src: obfuscatedSeg1.obfuscated_ctl_ttl_seq_src,
      encDst: securedNetworkPDUSeg1.EncDST,
      encTransportPdu: securedNetworkPDUSeg1.EncTransportPDU,
      netmic: securedNetworkPDUSeg1.NetMIC,
    };
    const finalizedNetworkPDUSeg1 = pduBuilder.finalizeNetworkPDU(
      finalizedNetworkPDUInputParamsSeg1
    );

    const proxyPDUSeg0 = pduBuilder.finalizeProxyPDU(
      finalizedNetworkPDUSeg0,
      MessageType.NETWORK_PDU
    );
    const proxyPDUSeg1 = pduBuilder.finalizeProxyPDU(
      finalizedNetworkPDUSeg1,
      MessageType.NETWORK_PDU
    );

    console.log(`sending config add AppKey seg0: ${proxyPDUSeg0}`);
    this.bluetoothManager.sendProxyPDU(proxyPDUSeg0);
    this.waitAndSendMessage(proxyPDUSeg1, 500, "sending config add AppKey seg1");
  }

  modelAppKeyBind(nodeAddress: string, elementAddress: string, devKey: string, modelId: string) {
    const accessPayload = pduBuilder.makeAccessPayload(
      "803d",
      utils.swapHexEndianness(elementAddress) +
        utils.swapHexEndianness("0000") +
        utils.swapHexEndianness(modelId)
    );

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: 13,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: 13,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: 13,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    console.log(`sending config AppKey bind: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
  }

  getCompositionData(nodeAddress: string, page: string, devKey: string) {
    const accessPayload = pduBuilder.makeAccessPayload("8008", utils.swapHexEndianness(page));
    const seq = this.meshConfigurationManager.getSeq();

    const upperTransportPDUInputParams: MakeUpperTransportPDUParams = {
      seq: seq,
      src: "0001",
      dst: nodeAddress,
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      key: devKey,
      accessPayload,
      keyType: "device",
    };
    const upperTransportPDU = pduBuilder.makeUpperTransportPDU(upperTransportPDUInputParams);

    const lowerTransportPDUInputParams: MakeLowerTransportPDUParams = {
      AID: this.meshConfigurationManager.getAID(),
      upperTransportPDU: upperTransportPDU,
      isAppKey: false,
    };
    const lowerTransportPDU = pduBuilder.makeLowerTransportPDU(lowerTransportPDUInputParams);

    const securedNetworkPDUInputParams: MakeSecureNetworkLayerParams = {
      encryptionKey: this.meshConfigurationManager.getEncryptionKey(),
      dst: nodeAddress,
      lowerTransportPDU: lowerTransportPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
      nonceType: "network",
    };
    const securedNetworkPDU = pduBuilder.makeSecureNetworkLayer(securedNetworkPDUInputParams);

    const obfuscateNetworkPDUInputParams: ObfuscateNetworkPDUInput = {
      encryptedNetworkPayload: securedNetworkPDU,
      ctl: "00",
      ttl: "04",
      seq: seq,
      src: "0001",
      ivIndex: this.meshConfigurationManager.getIvIndex(),
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

    console.log(`sending config get composition data: ${proxyPDU}`);
    this.bluetoothManager.sendProxyPDU(proxyPDU);
    this.meshConfigurationManager.updateSeq();
  }

  onConfigMessageReceived(pdu: ProxyPDU) {}

  private waitAndSendMessage(message: string, waitTime: number, log: string) {
    setTimeout(() => {
      console.log(`${log}: ${message}`);
      this.bluetoothManager.sendProxyPDU(message);
    }, waitTime);
  }
}

export default ConfigClient;
