import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BluetoothManager from "../../../bluetooth/BluetoothManager";
import MeshConfigurationManager from "../../../bluetooth/MeshConfigurationManager";
import { modelNameById } from "../../../bluetooth/ModelNameById";
import ConfigClient, { ConfigClientStatusUpdate } from "../../../bluetooth/models/ConfigClient";
import MQTTConfigClient from "../../../bluetooth/models/MQTTConfigClient";

interface IFormInput {
  appKey: string;
  uri: string;
  username: string;
  password: string;
}
type QueryParams = {
  elementNumber: string;
  modelNumber: string;
};
interface Props {
  BluetoothManager: BluetoothManager;
  MeshConfigurationManager: MeshConfigurationManager;
  ConfigClient: ConfigClient;
  MQTTConfigClient: MQTTConfigClient;
}
const MQTTConfigModelSettings = ({
  BluetoothManager,
  MeshConfigurationManager,
  ConfigClient,
  MQTTConfigClient,
}: Props) => {
  const [, updateState] = useState<any>();
  const forceUpdate = useCallback(() => updateState({}), []);

  const arrow = "<-";
  const navigate = useNavigate();
  const params = useParams<QueryParams>();

  if (!params.elementNumber || !params.modelNumber) {
    return <Navigate to="/connect" />;
  }

  const device = BluetoothManager.getDevice();
  if (!device) {
    return <Navigate to="/connect" />;
  }

  const node = MeshConfigurationManager.getNodeById(device.id);
  if (!node) {
    return <Navigate to="/connect" />;
  }

  const elementNumber = parseInt(params.elementNumber);
  const modelNumber = parseInt(params.modelNumber);
  const element = node.elements[elementNumber];
  const model = element.models[modelNumber];

  const {
    register,
    handleSubmit,
    getFieldState,
    formState: { isDirty },
    reset,
  } = useForm<IFormInput>();

  const onSubmit: SubmitHandler<IFormInput> = (data: IFormInput) => {
    const appKeyState = getFieldState("appKey");
    if (appKeyState.isDirty && data.appKey != "notassigned") {
      ConfigClient.modelAppKeyBind(node.unicastAddress, element.address, model.modelID);
    }

    const uriState = getFieldState("uri");
    const usernameState = getFieldState("username");
    const passwordState = getFieldState("password");
    if (uriState.isDirty && passwordState.isDirty && usernameState.isDirty) {
      if (data.uri.length > 0 && data.password.length > 0 && data.username.length > 0) {
        MQTTConfigClient.sendSetMessage(data.uri, data.username, data.password, element.address);
      }
    }

    if (appKeyState.isDirty || uriState.isDirty || passwordState.isDirty || usernameState.isDirty) {
      reset(undefined, { keepDirty: false, keepDirtyValues: false, keepValues: true });
    }
  };

  const onConfigClientStatusUpdate = (status: ConfigClientStatusUpdate) => {
    forceUpdate();
  };

  useEffect(() => {
    ConfigClient.registerStatusUpdateCallback(
      "WiFiConfigModelSettings",
      onConfigClientStatusUpdate
    );

    return () => {
      ConfigClient.removeStatusUpdateCallback("WiFiConfigModelSettings");
    };
  }, []);

  return (
    <div className="min-h-full max-w-7xl mx-auto pt-16">
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-10">
        <div className="flex flex-col gap-10">
          <span>
            {arrow}
            <span className="link" onClick={() => navigate(-2)}>
              {device.name}
            </span>{" "}
            /{" "}
            <span className="link" onClick={() => navigate(-1)}>
              {element.name ?? "Element " + elementNumber}
            </span>{" "}
            / {modelNameById.get(model.modelID) ?? "Model " + modelNumber}
          </span>

          <div className="flex flex-col gap-10">
            <form className="flex flex-col gap-10" onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-2">
                <label>Application Key</label>
                <select
                  id="net-key"
                  className="border-solid border-2 p-2 border-border rounded-lg block"
                  defaultValue={
                    model.bind.length > 0
                      ? MeshConfigurationManager.getAppKeyByIndex(model.bind[0])
                      : "notassigned"
                  }
                  {...register("appKey")}
                >
                  <option value="notassigned">Not assigned</option>
                  <option value={MeshConfigurationManager.getAppKey()}>
                    {MeshConfigurationManager.getAppKey()}
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex">
                  <label>MQTT Credentials</label>
                </div>
                <div className="border-solid border-2 border-border rounded-lg p-4">
                  {model.bind.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex-1">
                        <label>URI</label>
                        <input className="min-w-full" type="text" {...register("uri")} />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label>Username</label>
                          <input className="min-w-full" type="text" {...register("username")} />
                        </div>
                        <div className="flex-1">
                          <label>Password</label>
                          <input className="min-w-full" type="password" {...register("password")} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>Assign an Application Key first</p>
                  )}
                </div>
              </div>

              <button className="primary ml-auto" type="submit" disabled={!isDirty}>
                Save
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MQTTConfigModelSettings;
