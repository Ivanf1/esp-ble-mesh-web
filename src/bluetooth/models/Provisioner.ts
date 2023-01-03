import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import crypto from "../crypto";
import MeshConfigurationManager from "../MeshConfigurationManager";
import pduBuilder, { MessageType } from "../pduBuilder";
import { ParsedPDU, ProxyPDU } from "../PduParser";

const TAG = "PROVISIONER";

enum ProvisioningType {
  INVITE = "00",
  CAPABILITIES = "01",
  START = "02",
  PUBLIC_KEY = "03",
  INPUT_COMPLETE = "04",
  CONFIRMATION = "05",
  RANDOM = "06",
  DATA = "07",
  COMPLETE = "08",
  FAILED = "09",
}
enum ProvisioningFailedReason {
  INVALID_PDU = "01",
  INVALID_FORMAT = "02",
  UNEXPECTED_PDU = "03",
  CONFIRMATION_FAILED = "04",
  OUT_OF_RESOURCES = "05",
  DECRYPTION_FAILED = "06",
  UNEXPECTED_ERROR = "07",
  CANNOT_ASSIGN_ADDRESS = "08",
}
interface NodeToProvision {
  numberOfElements: string;
  algorithms: string;
  pubKeyType: string;
  staticOOBType: string;
  outputOOBSize: string;
  outputOOBAction: string;
  inputOOBSize: string;
  inputOOBAction: string;
  publicKey: {
    hex: string;
    cryptoKey: CryptoKey | undefined;
  };
  random: string;
  devKey: string;
  unicastAddress: string;
}
interface ProvisionerProps {
  bluetoothManager: BluetoothManager;
  meshConfigurationManager: MeshConfigurationManager;
}
class Provisioner {
  private nodeToProvision: NodeToProvision = {
    numberOfElements: "",
    algorithms: "",
    pubKeyType: "",
    staticOOBType: "",
    outputOOBSize: "",
    outputOOBAction: "",
    inputOOBSize: "",
    inputOOBAction: "",
    publicKey: {
      hex: "",
      cryptoKey: undefined,
    },
    random: "",
    devKey: "",
    unicastAddress: "",
  };
  private confirmationMessageFields = {
    provisioningInvitePDUValue: "",
    provisioningCapabilitiesPDUValue: "",
    provisioningStartPDUValue: "",
  };
  private publicKeyHex = "";
  private publicPrivateKeyPair: CryptoKeyPair | undefined;
  private ecdhSecret = "";
  private confirmationSalt = "";
  private randomProvisioner = "";

  private isProvisioning = false;
  private onProvisioningCompletedCallback: ((devKey: string) => void) | null;
  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  constructor(props: ProvisionerProps) {
    this.bluetoothManager = props.bluetoothManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onProxyPDUReceived(pdu),
      MessageType.PROVISIONING
    );
    this.onProvisioningCompletedCallback = null;
    this.meshConfigurationManager = props.meshConfigurationManager;
  }

  public updateSeq() {
    this.meshConfigurationManager.updateSeq();
    console.log(this.meshConfigurationManager.getSeq());
  }

  private waitAndSendMessage(message: string, waitTime: number, log: string) {
    setTimeout(() => {
      console.log(`${log}: ${message}`);
      this.bluetoothManager.sendProxyPDU(message);
    }, waitTime);
  }

  public getNode() {
    console.log(this.nodeToProvision);
    return this.nodeToProvision;
  }

  /**
   * Provisioning process steps:
   *
   * 1) Provisioning Invite. The Provisioner will invite the new device to join the mesh network.
   * 2) Provisioning Capabilities. The device to be provisioned responds to the invite by sending its
   *    capabilities.
   * 3) Provisioning Start. The Provisioner upon receiving the capabilities, sends a provisioning
   *    start message stating the algorithm and authentication method to use.
   * 4) Provisioning Public Key (Provisioner). The Provisioner sends its public key to the new device.
   * 5) Provisioning Public Key (Device). The device sends its public key to the Provisioner.
   * 6) Provisioning Confirmation (Provisioner). The Provisioner will calculate a confirmation value
   *    that is based off of all the information already exchanged, a random number that has not been
   *    exchanged yet, and an authentication value that is communicated OOB.
   * 7) Provisioning Random (Provisioner). The Provisioner will now expose its random number used to
   *    generate its confirmation value that it has previously committed to.
   * 8) Provisioning Random (Device). The new device now sends its random number to the Provisioner.
   *
   */
  startProvisioningProcess(onProvisioningCompleted?: (devKey: string) => void) {
    if (this.isProvisioning) return;
    if (onProvisioningCompleted) {
      this.onProvisioningCompletedCallback = onProvisioningCompleted;
    }
    this.isProvisioning = true;
    this.publicKeyHex = "";

    const inviteMessage = this.makeInviteMessage();
    console.log(`${TAG}: sending invite message`);
    this.bluetoothManager.sendProxyPDU(inviteMessage);
  }

  private makeInviteMessage(): string {
    const attentionDuration = "00";
    this.confirmationMessageFields.provisioningInvitePDUValue = attentionDuration;
    return pduBuilder.finalizeProxyPDU("00" + attentionDuration, MessageType.PROVISIONING);
  }

  /**
   * Refer to Mesh Profile Specification 5.4.1.3.
   */
  private makeStartMessage() {
    // No OOB authentication is used.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.28.
    const authenticationMethod = "00";

    // Blink. Even if we do not use an authentication method we
    // have to specify this field.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.29.
    const authenticationAction = "00";

    // Even if we do not use an authentication method we
    // have to specify this field.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.30.
    const authenticationSize = "00";

    const data =
      this.nodeToProvision.algorithms.substring(0, 2) +
      this.nodeToProvision.pubKeyType +
      authenticationMethod +
      authenticationAction +
      authenticationSize;

    this.confirmationMessageFields.provisioningStartPDUValue = data;

    const pdu = ProvisioningType.START + data;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private async makePublicKeyMessage() {
    // A new key pair shall be generated by the Provisioner.
    const key = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    this.publicPrivateKeyPair = key;

    const rawPublicKey = await window.crypto.subtle.exportKey("raw", key.publicKey);
    // Web Crypto API, for ECDH, will return the key as 65 bytes. These keys have a
    // 0x04 prefix. The device will only accept a 64 bytes public key. Therefore we
    // need to remove the 0x04 prefix before sending the public key to the device.
    this.publicKeyHex = utils.arrayBufferToHex(rawPublicKey).substring(2);

    const pdu = ProvisioningType.PUBLIC_KEY + this.publicKeyHex;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  /**
   * Refer to Mesh Profile Specification 5.4.2.4.
   */
  private makeConfirmationMessage() {
    // ConfirmationInputs = ProvisioningInvitePDUValue || ProvisioningCapabilitiesPDUValue ||
    //                      ProvisioningStartPDUValue || PublicKeyProvisioner || PublicKeyDevice
    const confirmationInputs =
      this.confirmationMessageFields.provisioningInvitePDUValue +
      this.confirmationMessageFields.provisioningCapabilitiesPDUValue +
      this.confirmationMessageFields.provisioningStartPDUValue +
      this.publicKeyHex +
      this.nodeToProvision.publicKey.hex;

    // ConfirmationSalt = s1(ConfirmationInputs)
    this.confirmationSalt = crypto.s1(confirmationInputs);

    // ConfirmationKey = k1(ECDHSecret, ConfirmationSalt, “prck”)
    const confirmationKey = crypto.k1(this.ecdhSecret, "7072636b", this.confirmationSalt);

    // RandomProvisioner is a string of random bits generated by the Provisioner’s
    // random number generator.
    const a = new Uint8Array(16);
    window.crypto.getRandomValues(a);
    this.randomProvisioner = utils.u8AToHexString(a);

    // The AuthValue is a 128-bit value. The computation of AuthValue depends on the data type
    // of the Output OOB Action, Input OOB Action, or Static OOB Type that is used.
    // For example, if the Authentication with No OOB method is used, the AuthValue shall be set to
    // 0x00000000000000000000000000000000, which means it is not authenticated, resulting in an array
    // consisting of [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // 0x00, 0x00, 0x00].
    // For now, only no authentication is supported.
    const authValue = "00000000000000000000000000000000";

    // ConfirmationProvisioner = AES - CMACConfirmationKey(RandomProvisioner || AuthValue);
    const confirmationProvisioner = crypto.getAesCmac(
      confirmationKey,
      this.randomProvisioner + authValue
    );

    const pdu = ProvisioningType.CONFIRMATION + confirmationProvisioner;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private makeProvisioningRandom() {
    const pdu = ProvisioningType.RANDOM + this.randomProvisioner;
    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private makeProvisioningData() {
    // Once the device has been authenticated, the Provisioner and device shall use the calculated
    // Diffie-Hellman shared secret ECDHSecret and generate a session key from that shared secret.
    // That session key shall then be used to encrypt and authenticate the provisioning data.

    const provisioningSalt = crypto.makeProvisioningSalt(
      this.confirmationSalt,
      this.randomProvisioner,
      this.nodeToProvision.random
    );

    const sessionKey = crypto.makeSessionKey(this.ecdhSecret, provisioningSalt);

    const sessionNonce = crypto.makeSessionNonce(this.ecdhSecret, provisioningSalt);

    const netKey = this.meshConfigurationManager.getNetKey();
    const keyIndex = "0000";
    const flags = "00";
    const ivIndex = this.meshConfigurationManager.getIvIndex();
    const unicastAddress = "0003";

    this.nodeToProvision.unicastAddress = "0003";

    // Provisioning Data = Network Key || Key Index || Flags || IV Index || Unicast Address
    const provisioningData = netKey + keyIndex + flags + ivIndex + unicastAddress;

    const encProvisioningData = crypto.encryptProvisioningData(
      sessionKey,
      sessionNonce,
      provisioningData
    );

    this.nodeToProvision.devKey = crypto.deriveDevKey(this.ecdhSecret, provisioningSalt);

    const pdu =
      ProvisioningType.DATA +
      encProvisioningData.encProvisioningData +
      encProvisioningData.provisioningDataMIC;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private onProxyPDUReceived(proxyPDU: ProxyPDU) {
    this.parseProvisionerPDU(proxyPDU.data);
  }

  async parseProvisionerPDU(pdu: ParsedPDU) {
    if (!this.isProvisioning) return;

    switch (pdu.opcode as ProvisioningType) {
      case ProvisioningType.CAPABILITIES:
        console.log(`${TAG}: received capabilities`);
        this.parseCapabilitiesPDU(pdu.params);

        const sm = this.makeStartMessage();
        console.log(`${TAG}: sending start message: `);
        this.bluetoothManager.sendProxyPDU(sm);
        // Wait for the previous message to be sent before sending another message.
        this.waitAndSendMessage(
          await this.makePublicKeyMessage(),
          500,
          `${TAG}: sending public key message`
        );
        break;

      case ProvisioningType.PUBLIC_KEY:
        console.log(`${TAG}: received device public key`);
        await this.parsePublicKeyPDU(pdu.params);
        await this.computeECDHSecret();
        const cm = this.makeConfirmationMessage();
        console.log(`${TAG}: sending confirmation message: ${cm}`);
        this.bluetoothManager.sendProxyPDU(this.makeConfirmationMessage());
        break;

      case ProvisioningType.CONFIRMATION:
        console.log(`${TAG}: received confirmation message: ${pdu.params}`);
        const pm = this.makeProvisioningRandom();
        console.log(`${TAG}: sending provisioning random: ${pm}`);
        this.bluetoothManager.sendProxyPDU(pm);
        break;

      case ProvisioningType.RANDOM:
        console.log(`${TAG}: received device random: ${pdu.params}`);
        this.parseRandomProvisioningDevice(pdu.params);

        const pdm = this.makeProvisioningData();
        console.log(`${TAG}: sending provisioning data: ${pdm}`);
        this.bluetoothManager.sendProxyPDU(pdm);
        break;

      case ProvisioningType.COMPLETE:
        console.log(`${TAG}: provisioning completed`);
        this.meshConfigurationManager.addNode(
          this.nodeToProvision.unicastAddress,
          this.nodeToProvision.devKey,
          parseInt(this.nodeToProvision.numberOfElements, 16)
        );
        if (this.onProvisioningCompletedCallback) {
          this.onProvisioningCompletedCallback(this.nodeToProvision.devKey);
        }
        this.resetProvisioningInfo();

      case ProvisioningType.FAILED:
        this.parseFailedReason(pdu.params as ProvisioningFailedReason);
        break;

      default:
        break;
    }
  }

  /**
   * Refer to Mesh Profile Specification 5.4.1.2.
   */
  private parseCapabilitiesPDU(pdu: string) {
    this.confirmationMessageFields.provisioningCapabilitiesPDUValue = pdu;

    this.nodeToProvision.numberOfElements = pdu.substring(0, 2);
    this.nodeToProvision.algorithms = pdu.substring(2, 6);
    this.nodeToProvision.pubKeyType = pdu.substring(6, 8);
    this.nodeToProvision.staticOOBType = pdu.substring(8, 10);
    this.nodeToProvision.outputOOBSize = pdu.substring(10, 12);
    this.nodeToProvision.outputOOBAction = pdu.substring(12, 16);
    this.nodeToProvision.inputOOBSize = pdu.substring(16, 18);
    this.nodeToProvision.inputOOBAction = pdu.substring(18, pdu.length);
  }

  private async parsePublicKeyPDU(pdu: string) {
    this.nodeToProvision.publicKey.hex = pdu;
    // Older uncompressed public keys, the kind used by Web Crypto API for ECDH, are 65 bytes
    // consisting of constant prefix (0x04), followed by two 256-bit integers called x and y.
    // The device sends a 64 byte public key, therefore to correctly import the key we have
    // to add the 0x04 prefix.
    try {
      const pbk = await window.crypto.subtle.importKey(
        "raw",
        utils.hexToArrayBuffer("04" + this.nodeToProvision.publicKey.hex),
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        []
      );
      this.nodeToProvision.publicKey.cryptoKey = pbk;
    } catch (error) {
      // TODO: send back provisioning error message
      console.log("invalid device public key");
    }
  }

  private parseRandomProvisioningDevice(pdu: string) {
    this.nodeToProvision.random = pdu;
  }

  private async computeECDHSecret() {
    const secret = await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: this.nodeToProvision.publicKey.cryptoKey,
      },
      this.publicPrivateKeyPair?.privateKey!,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );

    const rawSecret = await window.crypto.subtle.exportKey("raw", secret);
    const secretHex = utils.arrayBufferToHex(rawSecret);

    this.ecdhSecret = secretHex;
  }

  private parseFailedReason(failureReason: ProvisioningFailedReason) {
    this.resetProvisioningInfo();

    switch (failureReason) {
      case ProvisioningFailedReason.INVALID_PDU:
        console.log(`${TAG}: provisioning failed: invalid pdu`);
        break;
      case ProvisioningFailedReason.INVALID_FORMAT:
        console.log(`${TAG}: provisioning failed: invalid format`);
        break;
      case ProvisioningFailedReason.UNEXPECTED_PDU:
        console.log(`${TAG}: provisioning failed: unexpected pdu`);
        break;
      case ProvisioningFailedReason.CONFIRMATION_FAILED:
        console.log(`${TAG}: provisioning failed: confirmation failed`);
        break;
      case ProvisioningFailedReason.OUT_OF_RESOURCES:
        console.log(`${TAG}: provisioning failed: out of resources`);
        break;
      case ProvisioningFailedReason.DECRYPTION_FAILED:
        console.log(`${TAG}: provisioning failed: decryption failed`);
        break;
      case ProvisioningFailedReason.UNEXPECTED_ERROR:
        console.log(`${TAG}: provisioning failed: unexpected error`);
        break;
      case ProvisioningFailedReason.CANNOT_ASSIGN_ADDRESS:
        console.log(`${TAG}: provisioning failed: cannot assign address`);
        break;
      default:
        break;
    }
  }

  private resetProvisioningInfo() {
    this.nodeToProvision = {
      numberOfElements: "",
      algorithms: "",
      pubKeyType: "",
      staticOOBType: "",
      outputOOBSize: "",
      outputOOBAction: "",
      inputOOBSize: "",
      inputOOBAction: "",
      publicKey: {
        hex: "",
        cryptoKey: undefined,
      },
      random: "",
      devKey: "",
      unicastAddress: "",
    };
    this.confirmationMessageFields = {
      provisioningInvitePDUValue: "",
      provisioningCapabilitiesPDUValue: "",
      provisioningStartPDUValue: "",
    };
    this.publicKeyHex = "";
    this.publicPrivateKeyPair = undefined;
    this.ecdhSecret = "";
    this.confirmationSalt = "";
    this.randomProvisioner = "";

    this.isProvisioning = false;
  }
}

export default Provisioner;
