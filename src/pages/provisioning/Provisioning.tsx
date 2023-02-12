import { useState } from "react";
import { ReactComponent as ConnectSVG } from "../../assets/img/connect_ill.svg";
import BluetoothManager from "../../bluetooth/BluetoothManager";
import ConfigClient from "../../bluetooth/models/ConfigClient";
import Provisioner, { ProvisioningStatus } from "../../bluetooth/models/Provisioner";
import ProgressBar from "../../components/ProgressBar";

interface Props {
  BluetoothManager: BluetoothManager;
  Provisioner: Provisioner;
  ConfigClient: ConfigClient;
}
const Provisioning = ({ BluetoothManager, Provisioner, ConfigClient }: Props) => {
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [isProxyConnection, setIsProxyConnection] = useState<boolean>(false);
  const [provisioningStatus, setProvisioningStatus] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);

  const onProvisionStatusUpdate = (status: ProvisioningStatus) => {
    if (!status.error) {
      setProvisioningStatus(status.percentage!);
      // setIsProvisioning(false);
    } else {
      setIsProvisioning(false);
      BluetoothManager.disconnect();
    }
  };

  const onProvisionClick = async () => {
    const connected = await BluetoothManager.connect("provisioning");

    if (connected) {
      setIsConnected(true);
      setDevice(BluetoothManager.getDevice());
    }
  };

  const onProvisionStart = () => {
    if (isConnected) {
      setIsProvisioning(true);
      Provisioner.startProvisioningProcess(onProvisionStatusUpdate);
    }
  };

  const onConnectClick = async () => {
    const connected = await BluetoothManager.connect("proxy");

    if (connected) {
      setIsProxyConnection(true);
      ConfigClient.getCompositionData(BluetoothManager.getDevice()!.id);
      setDevice(BluetoothManager.getDevice());
    }
  };

  const onAbortClick = () => {
    setIsProvisioning(false);
  };

  return (
    <div className="min-h-full max-w-7xl mx-auto pt-16">
      <h2 className="mb-16">Connect</h2>
      {BluetoothManager.getDevice() ? (
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
          <div>
            <h5 className="mb-3">Connected Device</h5>
            <div className="p-5 rounded-t-lg border-solid border-2 border-border">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <span className="font-medium">Name:</span>
                <span>{device?.name ?? "No name"}</span>
                <span className="font-medium">Id:</span>
                <span>{device?.id}</span>
              </div>
            </div>
            <div className="p-5 rounded-b-lg border-solid border-x-2 border-b-2 border-border flex flex-col">
              {isProvisioning ? (
                provisioningStatus < 100 && (
                  <>
                    <span>Device is being provisioned...</span>
                    <ProgressBar completed={provisioningStatus} total={100} showLabel={true} />
                    <button className="cancel ml-auto mt-5" onClick={onAbortClick}>
                      Abort
                    </button>
                  </>
                )
              ) : isProxyConnection ? (
                <span>This device has been provisioned</span>
              ) : (
                <button className="primary ml-auto" onClick={onProvisionStart}>
                  Provision
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ConnectionPanel onConnectClick={onConnectClick} onProvisionClick={onProvisionClick} />
      )}
    </div>
  );
};

interface ConnectionPanelProps {
  onProvisionClick: () => void;
  onConnectClick: () => void;
}
const ConnectionPanel = ({ onConnectClick, onProvisionClick }: ConnectionPanelProps) => {
  return (
    <div className="mx-auto">
      <div className="py-24 rounded-lg border-solid border-2 border-border flex flex-col items-center gap-10">
        <ConnectSVG />
        <h4>Connect to a device</h4>
        <div className="min-w-full grid grid-cols-[1fr_auto_1fr] mt-12">
          <div className="flex flex-col items-center gap-4 py-6">
            <span className="text-center">Connect to an already provisioned Proxy Server</span>
            <button className="primary mx-auto" onClick={onConnectClick}>
              Connect
            </button>
          </div>
          <div className="bg-border rounded-lg min-w-[2px]"></div>
          <div className="flex flex-col items-center gap-4 py-6">
            <span className="text-center">Add a new device to the mesh network</span>
            <button className="primary mx-auto" onClick={onProvisionClick}>
              Provision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Provisioning;
