import { Navigate } from "react-router-dom";
import BluetoothManager from "../../bluetooth/BluetoothManager";
import ProxyConfigurationClient from "../../bluetooth/models/ProxyConfigurationClient";

interface Props {
  BluetoothManager: BluetoothManager;
  ProxyConfigurationClient: ProxyConfigurationClient;
}
const Dashboard = ({ BluetoothManager, ProxyConfigurationClient }: Props) => {
  const device = BluetoothManager.getDevice();
  if (!device) {
    return <Navigate to="/provisioning" />;
  }

  ProxyConfigurationClient.setBlacklistFilter();

  return (
    <div>
      <div></div>
    </div>
  );
};

export default Dashboard;
