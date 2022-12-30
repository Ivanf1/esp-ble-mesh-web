import utils from "../../utils/utils";
import BluetoothManager from "../BluetoothManager";
import crypto from "../crypto";
import pduBuilder, { MessageType } from "../pduBuilder";

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
}
interface ProvisionerProps {
  bluetoothManager: BluetoothManager;
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
  };
  private confirmationMessageFields = {
    provisioningInvitePDUValue: "",
    provisioningCapabilitiesPDUValue: "",
    provisioningStartPDUValue: "",
  };
  private publicKeyHex = "";
  private publicPrivateKeyPair: CryptoKeyPair | undefined;
  private ecdhSecret = "";

  private isProvisioning = false;
  private bluetoothManager: BluetoothManager;

  constructor(props: ProvisionerProps) {
    this.bluetoothManager = props.bluetoothManager;
  }

  private waitAndSendMessage(message: string, waitTime: number) {
    setTimeout(() => {
      this.bluetoothManager.sendProxyPDU(message);
    }, waitTime);
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
   *
   */
  startProvisioningProcess() {
    if (this.isProvisioning) return;
    this.isProvisioning = true;
    this.publicKeyHex = "";

    const inviteMessage = this.makeInviteMessage();
    console.log("sending invite message");
    this.bluetoothManager.sendProxyPDU(inviteMessage);
  }

  makeInviteMessage(): string {
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
    const confirmationSalt = crypto.s1(confirmationInputs);

    // ConfirmationKey = k1(ECDHSecret, ConfirmationSalt, “prck”)
    const confirmationKey = crypto.k1(this.ecdhSecret, "7072636b", confirmationSalt);

    // RandomProvisioner is a string of random bits generated by the Provisioner’s
    // random number generator.
    const a = new Uint8Array(16);
    window.crypto.getRandomValues(a);
    const randomProvisioner = utils.u8AToHexString(a);

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
      randomProvisioner + authValue
    );

    const pdu = ProvisioningType.CONFIRMATION + confirmationProvisioner;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  async parseProvisionerPDU(pdu: string) {
    if (!this.isProvisioning) return;

    const provisioningType = pdu.substring(0, 2) as ProvisioningType;
    const data = pdu.substring(2);

    switch (provisioningType) {
      case ProvisioningType.CAPABILITIES:
        console.log("received capabilities");
        this.parseCapabilitiesPDU(data);

        console.log("sending start message");
        this.bluetoothManager.sendProxyPDU(this.makeStartMessage());
        // Wait for the previous message to be sent before sending another message
        this.waitAndSendMessage(await this.makePublicKeyMessage(), 1500);
        break;

      case ProvisioningType.PUBLIC_KEY:
        console.log("received device public key");
        await this.parsePublicKeyPDU(data);
        await this.computeECDHSecret();
        this.bluetoothManager.sendProxyPDU(this.makeConfirmationMessage());

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
      // TODO: sent back provisioning error message
      console.log("invalid device public key");
    }
    // console.log(pdu);
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
    console.log(`ecdh secret: ${secretHex}`);

    this.ecdhSecret = secretHex;
  }

  __testSetNodeToProvision(
    numberOfElements: string,
    algorithms: string,
    pubKeyType: string,
    staticOOBType: string,
    outputOOBSize: string,
    outputOOBAction: string,
    inputOOBSize: string,
    inputOOBAction: string
  ) {
    this.nodeToProvision.numberOfElements = numberOfElements;
    this.nodeToProvision.algorithms = algorithms;
    this.nodeToProvision.pubKeyType = pubKeyType;
    this.nodeToProvision.staticOOBType = staticOOBType;
    this.nodeToProvision.outputOOBSize = outputOOBSize;
    this.nodeToProvision.outputOOBAction = outputOOBAction;
    this.nodeToProvision.inputOOBSize = inputOOBSize;
    this.nodeToProvision.inputOOBAction = inputOOBAction;
  }
}

export default Provisioner;
