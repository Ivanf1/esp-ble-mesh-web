import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BluetoothManager from "../../bluetooth/BluetoothManager";
import { ProvisionedNode } from "../../bluetooth/meshConfiguration.interface";
import MeshConfigurationManager from "../../bluetooth/MeshConfigurationManager";
import ConfigClient, { ConfigClientStatusUpdate } from "../../bluetooth/models/ConfigClient";
import DeviceSettings from "./components/DeviceSettings";

interface Props {
  BluetoothManager: BluetoothManager;
  ConfigClient: ConfigClient;
  MeshConfigurationManager: MeshConfigurationManager;
}
const Settings = ({ BluetoothManager, ConfigClient, MeshConfigurationManager }: Props) => {
  const navigate = useNavigate();
  const params = useParams();
  let device: BluetoothDevice | ProvisionedNode | null | undefined = BluetoothManager.getDevice();
  if (!params.deviceUnicastAddress && !device) {
    return <Navigate to="/connect" />;
  }

  if (!device) {
    return <Navigate to="/connect" />;
  }

  // not device and address
  // device and address
  if ((device && params.deviceUnicastAddress) || (!device && params.deviceUnicastAddress)) {
    device = MeshConfigurationManager.getNodeByUnicastAddress(params.deviceUnicastAddress);
  }

  if (!device) {
    return <Navigate to="/connect" />;
  }

  const node = MeshConfigurationManager.getNodeById(device.id);

  if (!node) {
    return <Navigate to="/connect" />;
  }

  // const handleConfigClientUpdate = (status: ConfigClientStatusUpdate) => {
  //   console.log(status);
  // };

  // useEffect(() => {
  //   ConfigClient.registerStatusUpdateCallback("Settings", handleConfigClientUpdate);
  //   return () => {
  //     ConfigClient.removeStatusUpdateCallback("Settings");
  //   };
  // }, []);
  // ConfigClient.getCompositionData(BluetoothManager.getDevice()!.id);

  const onElementSelected = (elementNumber: number) => {
    navigate(`${node.unicastAddress}/element/${elementNumber}`);
  };

  return (
    <div className="min-h-full max-w-7xl mx-auto pt-16">
      <h2 className="mb-16">Device</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <DeviceSettings
            onElementSelected={onElementSelected}
            device={node!}
            MeshConfigurationManager={MeshConfigurationManager}
            ConfigClient={ConfigClient}
          />
        </div>
        <div>
          <div>
            <h5 className="mb-3">Composition Data</h5>
            <div className="p-4 rounded-lg border-solid border-2 border-border grid grid-cols-[auto_auto] gap-x-2 gap-y-2">
              <span className="font-medium">Name:</span>
              <span>{device.name}</span>
              <span className="font-medium">Id:</span>
              <span>{device.id}</span>
              <span className="font-medium">Unicast Address:</span>
              <span>{node?.unicastAddress}</span>
              <span className="font-medium">TTL:</span>
              <span>{node?.defaultTTL}</span>
              <span className="font-medium">Device Key:</span>
              <span>{node?.deviceKey.substring(0, 18)}**</span>
              <span className="font-medium">Company Identifier:</span>
              <span>{node?.cid}</span>
              <span className="font-medium">Product Identifier:</span>
              <span>{node?.pid}</span>
              <span className="font-medium">Product Version:</span>
              <span>{node?.vid}</span>
              <span className="font-medium">Replay Protection Count:</span>
              <span>{node?.crpl}</span>
              <span className="font-medium">Relay:</span>
              <span>{node?.features.relay}</span>
              <span className="font-medium">Proxy:</span>
              <span>{node?.features.proxy}</span>
              <span className="font-medium">Friend:</span>
              <span>{node?.features.friend}</span>
              <span className="font-medium">Low Power:</span>
              <span>{node?.features.lowPower}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
