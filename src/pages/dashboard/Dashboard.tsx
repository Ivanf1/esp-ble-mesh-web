import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import BluetoothManager from "../../bluetooth/BluetoothManager";
import GenericOnOffClient, {
  OnOffClientStatusUpdate,
} from "../../bluetooth/models/GenericOnOffClient";
import ProxyConfigurationClient from "../../bluetooth/models/ProxyConfigurationClient";

interface Props {
  BluetoothManager: BluetoothManager;
  ProxyConfigurationClient: ProxyConfigurationClient;
  GenericOnOffClient: GenericOnOffClient;
}
const Dashboard = ({ BluetoothManager, ProxyConfigurationClient, GenericOnOffClient }: Props) => {
  const device = BluetoothManager.getDevice();
  if (!device) {
    return <Navigate to="/provisioning" />;
  }

  const [lightStatus, setLightStatus] = useState<number>(0);

  const onOnOffMessageReceived = (status: OnOffClientStatusUpdate) => {
    setLightStatus(status.status);
  };

  ProxyConfigurationClient.setBlacklistFilter();

  useEffect(() => {
    GenericOnOffClient.registerStatusUpdateCallback("dashboard", onOnOffMessageReceived);

    return () => GenericOnOffClient.removeStatusUpdateCallback("dashboard");
  }, []);

  return (
    <div className="w-full h-full grid place-items-center">
      Light is {lightStatus ? "on" : "off"}
    </div>
  );
};

export default Dashboard;
