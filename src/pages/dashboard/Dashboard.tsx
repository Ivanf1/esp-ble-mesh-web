import { useEffect, useState } from "react";
import BluetoothManager from "../../bluetooth/BluetoothManager";
import GenericOnOffClient, {
  OnOffClientStatusUpdate,
} from "../../bluetooth/models/GenericOnOffClient";
import ProxyConfigurationClient from "../../bluetooth/models/ProxyConfigurationClient";
import Paho, { Message, MQTTError } from "paho-mqtt";
import {
  MQTT_CLIENT_ID,
  MQTT_HOST,
  MQTT_PASSWORD,
  MQTT_PORT,
  MQTT_USERNAME,
} from "../../constants/mqtt";

interface Props {
  BluetoothManager: BluetoothManager;
  ProxyConfigurationClient: ProxyConfigurationClient;
  GenericOnOffClient: GenericOnOffClient;
}
const Dashboard = ({ BluetoothManager, ProxyConfigurationClient, GenericOnOffClient }: Props) => {
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState(false);
  const [messages, setMessages] = useState([]);

  const device = BluetoothManager.getDevice();

  const [lightStatus, setLightStatus] = useState<number>(0);

  const onOnOffMessageReceived = (status: OnOffClientStatusUpdate) => {
    setLightStatus(status.status);
  };

  useEffect(() => {
    if (device) {
      GenericOnOffClient.registerStatusUpdateCallback("dashboard", onOnOffMessageReceived);
      ProxyConfigurationClient.setBlacklistFilter();

      return () => GenericOnOffClient.removeStatusUpdateCallback("dashboard");
    } else {
      // Create a client instance
      const client = new Paho.Client(MQTT_HOST, MQTT_PORT, MQTT_CLIENT_ID);

      // set callback handlers
      client.onConnectionLost = onConnectionLost;
      client.onMessageArrived = onMessageArrived;

      // connect the client
      client.connect({ onSuccess: onConnect, userName: MQTT_USERNAME, password: MQTT_PASSWORD });

      // called when the client connects
      function onConnect() {
        // Once a connection has been made, make a subscription and send a message.
        console.log("onConnect");
        client.subscribe("World");
      }

      // called when the client loses its connection
      function onConnectionLost(responseObject: MQTTError) {
        if (responseObject.errorCode !== 0) {
          console.log("onConnectionLost:" + responseObject.errorMessage);
        }
      }

      // called when a message arrives
      function onMessageArrived(message: Message) {
        console.log("onMessageArrived:" + message.payloadString);
      }

      return () => client.disconnect();
    }
  }, []);

  return (
    <div className="w-full h-full grid place-items-center">
      Light is {lightStatus ? "on" : "off"}
    </div>
  );
};

export default Dashboard;
