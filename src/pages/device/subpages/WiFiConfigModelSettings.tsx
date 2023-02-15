import { useCallback, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BluetoothManager from "../../../bluetooth/BluetoothManager";
import MeshConfigurationManager from "../../../bluetooth/MeshConfigurationManager";
import { modelNameById } from "../../../bluetooth/ModelNameById";
import ConfigClient, { ConfigClientStatusUpdate } from "../../../bluetooth/models/ConfigClient";
import WiFiConfigClient, {
  WiFiConfigClientStatusUpdate,
} from "../../../bluetooth/models/WiFiConfigClient";

interface IFormInput {
  appKey: string;
  ssid: string;
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
  WiFiConfigClient: WiFiConfigClient;
}
const WiFiConfigModelSettings = ({
  BluetoothManager,
  MeshConfigurationManager,
  ConfigClient,
  WiFiConfigClient,
}: Props) => {
  const [, updateState] = useState<any>();
  const forceUpdate = useCallback(() => updateState({}), []);

  const arrow = "<-";
  const navigate = useNavigate();
  const params = useParams<QueryParams>();

  if (!params.elementNumber || !params.modelNumber) {
    return <Navigate to="/provisioning" />;
  }

  const device = BluetoothManager.getDevice();
  if (!device) {
    return <Navigate to="/provisioning" />;
  }

  const node = MeshConfigurationManager.getNodeById(device.id);
  if (!node) {
    return <Navigate to="/provisioning" />;
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

    const ssidState = getFieldState("ssid");
    const passwordState = getFieldState("password");
    if (ssidState.isDirty && passwordState.isDirty) {
      if (data.ssid.length > 0 && data.password.length > 0) {
        WiFiConfigClient.sendSetMessage(data.ssid, data.password, element.address);
      }
    }

    if (appKeyState.isDirty || ssidState.isDirty || passwordState.isDirty) {
      reset(undefined, { keepDirty: false, keepDirtyValues: false, keepValues: true });
    }
  };

  const onWiFiConfigClientStatusUpdate = (status: WiFiConfigClientStatusUpdate) => {
    forceUpdate();
  };

  const onConfigClientStatusUpdate = (status: ConfigClientStatusUpdate) => {
    forceUpdate();
  };

  useEffect(() => {
    WiFiConfigClient.registerStatusUpdateCallback(
      "WiFiConfigModelSettings",
      onWiFiConfigClientStatusUpdate
    );
    ConfigClient.registerStatusUpdateCallback(
      "WiFiConfigModelSettings",
      onConfigClientStatusUpdate
    );

    return () => {
      WiFiConfigClient.removeStatusUpdateCallback("WiFiConfigModelSettings");
      ConfigClient.removeStatusUpdateCallback("WiFiConfigModelSettings");
    };
  }, []);

  return (
    <div className="min-h-full max-w-7xl mx-auto pt-16">
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
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
                  <label>Wi-Fi Credentials</label>
                </div>
                <div className="border-solid border-2 border-border rounded-lg p-4">
                  {model.bind.length > 0 ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label>SSID</label>
                        <input className="min-w-full" type="text" {...register("ssid")} />
                      </div>
                      <div className="flex-1">
                        <label>Password</label>
                        <input className="min-w-full" type="password" {...register("password")} />
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

export default WiFiConfigModelSettings;
