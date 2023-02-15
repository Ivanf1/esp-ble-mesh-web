import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CONFIGURATION_API } from "./constants/bluetooth";
import Device from "./pages/device/Device";
import Provisioning from "./pages/provisioning/Provisioning";
import ErrorPage from "./pages/error/ErrorPage";
import ElementSettings from "./pages/device/subpages/ElementSettings";
import ModelSettings from "./pages/device/subpages/ModelSettings";
import Mesh from "./pages/mesh/Mesh";
import BluetoothManager from "./bluetooth/BluetoothManager";
import MeshConfigurationManager from "./bluetooth/MeshConfigurationManager";
import ConfigClient from "./bluetooth/models/ConfigClient";
import GenericOnOffClient from "./bluetooth/models/GenericOnOffClient";
import Provisioner from "./bluetooth/models/Provisioner";
import ProxyConfigurationClient from "./bluetooth/models/ProxyConfigurationClient";
import Dashboard from "./pages/dashboard/Dashboard";
import Graph from "./pages/graph/Graph";
import WiFiConfigClient from "./bluetooth/models/WiFiConfigClient";
import MQTTConfigClient from "./bluetooth/models/MQTTConfigClient";

const meshConfigurationManager = new MeshConfigurationManager({
  meshConfigurationServerUrl: CONFIGURATION_API,
  meshConfigurationId: "1",
});
await meshConfigurationManager.initialize();
const bluetoothManager = new BluetoothManager({
  meshConfigurationManager,
});

const provisioner = new Provisioner({ bluetoothManager, meshConfigurationManager });
const configClient = new ConfigClient({ bluetoothManager, meshConfigurationManager });
const onOffClient = new GenericOnOffClient({ bluetoothManager, meshConfigurationManager });
const proxyConfigurationClient = new ProxyConfigurationClient({
  bluetoothManager,
  meshConfigurationManager,
});
const wifiConfigClient = new WiFiConfigClient({ bluetoothManager, meshConfigurationManager });
const mqttConfigClient = new MQTTConfigClient({ bluetoothManager, meshConfigurationManager });

const router = createBrowserRouter([
  {
    path: "/",
    element: <App configClient={configClient} />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "dashboard",
        element: (
          <Dashboard
            BluetoothManager={bluetoothManager}
            ProxyConfigurationClient={proxyConfigurationClient}
            GenericOnOffClient={onOffClient}
          />
        ),
      },
      {
        path: "device/element/:elementNumber/model/:modelNumber",
        element: (
          <ModelSettings
            BluetoothManager={bluetoothManager}
            MeshConfigurationManager={meshConfigurationManager}
            ConfigClient={configClient}
            WiFiConfigClient={wifiConfigClient}
            MQTTConfigClient={mqttConfigClient}
          />
        ),
      },
      {
        path: "device/element/:elementNumber",
        element: (
          <ElementSettings
            BluetoothManager={bluetoothManager}
            MeshConfigurationManager={meshConfigurationManager}
          />
        ),
      },
      {
        path: "device",
        element: (
          <Device
            BluetoothManager={bluetoothManager}
            ConfigClient={configClient}
            MeshConfigurationManager={meshConfigurationManager}
          />
        ),
      },
      {
        path: "provisioning",
        element: (
          <Provisioning
            BluetoothManager={bluetoothManager}
            Provisioner={provisioner}
            ConfigClient={configClient}
          />
        ),
      },
      {
        path: "mesh",
        element: <Mesh MeshConfigurationManager={meshConfigurationManager} />,
      },
      {
        path: "graph",
        element: <Graph MeshConfigurationManager={meshConfigurationManager} />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <RouterProvider router={router} />
);
