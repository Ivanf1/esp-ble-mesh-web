import BluetoothManager from "../BluetoothManager";
import crypto from "../crypto";
import MeshConfigurationManager from "../MeshConfigurationManager";
import PDUBuilder, { MessageType } from "../PduBuilder";
import { AccessPayloadData, ProxyPDU } from "../PduParser";

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
  id: string;
  name: string;
}
export interface ProvisioningStatus {
  error: boolean;
  message?: string; // only set if [error] is true
  percentage?: number; // only set if [error] is true
}
type ProvisioningStatusUpdateCallback = (status: ProvisioningStatus) => void;

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
    id: "",
    name: "",
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
  private onProvisioningStatusUpdateCallback: ProvisioningStatusUpdateCallback | null;
  private bluetoothManager: BluetoothManager;
  private meshConfigurationManager: MeshConfigurationManager;

  private PDUBuilder: PDUBuilder;

  constructor(props: ProvisionerProps) {
    this.bluetoothManager = props.bluetoothManager;
    this.bluetoothManager.registerProxyPDUNotificationCallback(
      (pdu) => this.onProxyPDUReceived(pdu),
      MessageType.PROVISIONING
    );
    this.onProvisioningStatusUpdateCallback = null;
    this.meshConfigurationManager = props.meshConfigurationManager;
    this.PDUBuilder = PDUBuilder.getInstance();
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
   * 9) Provisioning Data. The Provisioner can now provide the provisioning data required by the new
   *    device to become a node in a mesh network. This includes a NetKey along with a network key index,
   *    the current IV Index of this network key, and the unicast address of the first element of this
   *    node, and therefore all the subsequent addresses of additional elements. This data is encrypted
   *    and authenticated using a session key derived from the ECDH shared secret.
   * 10) Provisioning Complete. The new device now indicates that it has successfully received and
   *     processed the provisioning data.
   */
  public startProvisioningProcess(onProvisioningStatusUpdate?: ProvisioningStatusUpdateCallback) {
    if (this.isProvisioning) return;
    if (onProvisioningStatusUpdate) {
      this.onProvisioningStatusUpdateCallback = onProvisioningStatusUpdate;
    }
    this.isProvisioning = true;
    this.publicKeyHex = "";
    const device = this.bluetoothManager.getDevice()!;
    this.nodeToProvision.id = device.id;
    this.nodeToProvision.name = device.name ?? "";

    const inviteMessage = this.makeInviteMessage();
    console.log(`${TAG}: sending invite message`);
    this.bluetoothManager.sendProxyPDU(inviteMessage);
  }

  private makeInviteMessage(): string {
    const attentionDuration = "00";
    this.confirmationMessageFields.provisioningInvitePDUValue = attentionDuration;
    return this.PDUBuilder.finalizeProxyPDU(
      ProvisioningType.INVITE + attentionDuration,
      MessageType.PROVISIONING
    );
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

    return this.PDUBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private async makePublicKeyMessage() {
    // A new key pair shall be generated by the Provisioner.
    const key = await crypto.generatePublicPrivateKeyPair();
    this.publicPrivateKeyPair = key;

    this.publicKeyHex = await crypto.getPublicKeyHex(key.publicKey);

    const pdu = ProvisioningType.PUBLIC_KEY + this.publicKeyHex;

    return this.PDUBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  /**
   * Refer to Mesh Profile Specification 5.4.2.4.
   */
  private makeConfirmationMessage() {
    // The AuthValue is a 128-bit value. The computation of AuthValue depends on the data type
    // of the Output OOB Action, Input OOB Action, or Static OOB Type that is used.
    // For example, if the Authentication with No OOB method is used, the AuthValue shall be set to
    // 0x00000000000000000000000000000000, which means it is not authenticated, resulting in an array
    // consisting of [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // 0x00, 0x00, 0x00].
    // For now, only no authentication is supported.
    const authValue = "00000000000000000000000000000000";

    const { confirmationSalt, randomProvisioner, confirmationProvisioner } =
      crypto.makeConfirmationProvisioner(
        this.confirmationMessageFields.provisioningInvitePDUValue,
        this.confirmationMessageFields.provisioningCapabilitiesPDUValue,
        this.confirmationMessageFields.provisioningStartPDUValue,
        this.publicKeyHex,
        this.nodeToProvision.publicKey.hex,
        this.ecdhSecret,
        authValue
      );

    this.randomProvisioner = randomProvisioner;
    this.confirmationSalt = confirmationSalt;

    const pdu = ProvisioningType.CONFIRMATION + confirmationProvisioner;

    return this.PDUBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private makeProvisioningRandom() {
    const pdu = ProvisioningType.RANDOM + this.randomProvisioner;
    return this.PDUBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
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
    const keyIndex = this.meshConfigurationManager.getNetKeyIndex();
    const flags = "00"; // Key Refresh Phase 0, Normal Operation
    const ivIndex = this.meshConfigurationManager.getIvIndex();

    this.nodeToProvision.unicastAddress =
      this.meshConfigurationManager.getNextUnicastAddressAvailable()!;

    // Provisioning Data = Network Key || Key Index || Flags || IV Index || Unicast Address
    const provisioningData =
      netKey + keyIndex + flags + ivIndex + this.nodeToProvision.unicastAddress;

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

    return this.PDUBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  private onProxyPDUReceived(proxyPDU: ProxyPDU) {
    this.parseProvisionerPDU(proxyPDU.data);
  }

  private async parseProvisionerPDU(pdu: AccessPayloadData) {
    if (!this.isProvisioning) return;

    switch (pdu.opcode as ProvisioningType) {
      case ProvisioningType.CAPABILITIES:
        console.log(`${TAG}: received capabilities`);
        this.parseCapabilitiesPDU(pdu.params);

        const sm = this.makeStartMessage();
        console.log(`${TAG}: sending start message: `);
        this.bluetoothManager.sendProxyPDU(sm);
        this.bluetoothManager.sendProxyPDU(await this.makePublicKeyMessage());
        if (this.onProvisioningStatusUpdateCallback) {
          this.onProvisioningStatusUpdateCallback({
            error: false,
            percentage: 20,
          });
        }
        break;

      case ProvisioningType.PUBLIC_KEY:
        console.log(`${TAG}: received device public key`);
        await this.parsePublicKeyPDU(pdu.params);
        await this.computeECDHSecret();
        const cm = this.makeConfirmationMessage();
        console.log(`${TAG}: sending confirmation message: ${cm}`);
        this.bluetoothManager.sendProxyPDU(this.makeConfirmationMessage());
        if (this.onProvisioningStatusUpdateCallback) {
          this.onProvisioningStatusUpdateCallback({
            error: false,
            percentage: 40,
          });
        }
        break;

      case ProvisioningType.CONFIRMATION:
        console.log(`${TAG}: received confirmation message: ${pdu.params}`);
        const pm = this.makeProvisioningRandom();
        console.log(`${TAG}: sending provisioning random: ${pm}`);
        this.bluetoothManager.sendProxyPDU(pm);
        if (this.onProvisioningStatusUpdateCallback) {
          this.onProvisioningStatusUpdateCallback({
            error: false,
            percentage: 60,
          });
        }
        break;

      case ProvisioningType.RANDOM:
        console.log(`${TAG}: received device random: ${pdu.params}`);
        this.parseRandomProvisioningDevice(pdu.params);

        const pdm = this.makeProvisioningData();
        console.log(`${TAG}: sending provisioning data: ${pdm}`);
        this.bluetoothManager.sendProxyPDU(pdm);
        if (this.onProvisioningStatusUpdateCallback) {
          this.onProvisioningStatusUpdateCallback({
            error: false,
            percentage: 80,
          });
        }
        break;

      case ProvisioningType.COMPLETE:
        console.log(`${TAG}: provisioning completed`);
        this.meshConfigurationManager.addNode(
          this.nodeToProvision.unicastAddress,
          this.nodeToProvision.devKey,
          parseInt(this.nodeToProvision.numberOfElements, 16),
          this.nodeToProvision.id,
          this.nodeToProvision.name
        );
        if (this.onProvisioningStatusUpdateCallback) {
          this.onProvisioningStatusUpdateCallback({
            error: false,
            percentage: 100,
          });
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
    try {
      const pbk = await crypto.importKey(this.nodeToProvision.publicKey.hex);
      this.nodeToProvision.publicKey.cryptoKey = pbk;
    } catch (error) {
      // TODO: send back provisioning error message
      console.error("invalid device public key");
    }
  }

  private parseRandomProvisioningDevice(pdu: string) {
    this.nodeToProvision.random = pdu;
  }

  private async computeECDHSecret() {
    this.ecdhSecret = await crypto.computeECDHSecret(
      this.nodeToProvision.publicKey.cryptoKey!,
      this.publicPrivateKeyPair!.privateKey
    );
  }

  private parseFailedReason(failureReason: ProvisioningFailedReason) {
    this.resetProvisioningInfo();
    let message = "";

    switch (failureReason) {
      case ProvisioningFailedReason.INVALID_PDU:
        console.error(`${TAG}: provisioning failed: invalid pdu`);
        message = "invalid pdu";
        break;
      case ProvisioningFailedReason.INVALID_FORMAT:
        console.error(`${TAG}: provisioning failed: invalid format`);
        message = "invalid format";
        break;
      case ProvisioningFailedReason.UNEXPECTED_PDU:
        console.error(`${TAG}: provisioning failed: unexpected pdu`);
        message = "unexpected pdu";
        break;
      case ProvisioningFailedReason.CONFIRMATION_FAILED:
        console.error(`${TAG}: provisioning failed: confirmation failed`);
        message = "confirmation failed";
        break;
      case ProvisioningFailedReason.OUT_OF_RESOURCES:
        console.error(`${TAG}: provisioning failed: out of resources`);
        message = "out of resources";
        break;
      case ProvisioningFailedReason.DECRYPTION_FAILED:
        console.error(`${TAG}: provisioning failed: decryption failed`);
        message = "decryption failed";
        break;
      case ProvisioningFailedReason.UNEXPECTED_ERROR:
        console.error(`${TAG}: provisioning failed: unexpected error`);
        message = "unexpected error";
        break;
      case ProvisioningFailedReason.CANNOT_ASSIGN_ADDRESS:
        console.error(`${TAG}: provisioning failed: cannot assign address`);
        message = "cannot assign address";
        break;
      default:
        break;
    }

    if (this.onProvisioningStatusUpdateCallback) {
      this.onProvisioningStatusUpdateCallback({
        error: true,
        message: message,
      });
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
      id: "",
      name: "",
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
