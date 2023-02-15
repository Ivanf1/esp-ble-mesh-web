import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Tag, WithContext as ReactTags } from "react-tag-input";
import BluetoothManager from "../../../bluetooth/BluetoothManager";
import MeshConfigurationManager from "../../../bluetooth/MeshConfigurationManager";
import { modelNameById } from "../../../bluetooth/ModelNameById";
import ConfigClient from "../../../bluetooth/models/ConfigClient";
import MQTTConfigClient from "../../../bluetooth/models/MQTTConfigClient";
import WiFiConfigClient from "../../../bluetooth/models/WiFiConfigClient";
import MQTTConfigModelSettings from "./MQTTConfigModelSettings";
import WiFiConfigModelSettings from "./WiFiConfigModelSettings";

interface IFormInput {
  appKey: string;
  pubAddress: string;
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
  MQTTConfigClient: MQTTConfigClient;
}
const ModelSettings = ({
  BluetoothManager,
  MeshConfigurationManager,
  ConfigClient,
  WiFiConfigClient,
  MQTTConfigClient,
}: Props) => {
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

  if (model.modelID == "000102e5") {
    return (
      <WiFiConfigModelSettings
        BluetoothManager={BluetoothManager}
        MeshConfigurationManager={MeshConfigurationManager}
        ConfigClient={ConfigClient}
        WiFiConfigClient={WiFiConfigClient}
      />
    );
  }
  if (model.modelID == "000302e5") {
    return (
      <MQTTConfigModelSettings
        BluetoothManager={BluetoothManager}
        MeshConfigurationManager={MeshConfigurationManager}
        ConfigClient={ConfigClient}
        MQTTConfigClient={MQTTConfigClient}
      />
    );
  }

  const {
    register,
    handleSubmit,
    getFieldState,
    formState: { isDirty },
    reset,
  } = useForm<IFormInput>();

  const meshGroups = MeshConfigurationManager.getGroups();
  const nodeSubscriptionGroups = node.elements[elementNumber].models[modelNumber].subscribe;
  const [isNodePubAddressDirty, setIsNodePubAddressDirty] = useState<boolean>(false);

  const [nodePubAddresses, setNodePubAddresses] = useState(
    nodeSubscriptionGroups.map((groupAddress) => {
      return { id: groupAddress, text: groupAddress };
    })
  );

  const pubAddressSuggestions = meshGroups.map((g) => {
    return { id: g.address, text: g.address };
  });

  const handlePubAddressDelete = (i: number) => {
    setNodePubAddresses(nodePubAddresses.filter((_, index) => index !== i));
    setIsNodePubAddressDirty(true);
  };

  const handlePubAddressAddition = (tag: Tag) => {
    const lowerCaseQuery = tag.text.toLowerCase();

    if (pubAddressSuggestions.find((t) => t.text.toLowerCase() === lowerCaseQuery)) {
      setNodePubAddresses([...nodePubAddresses, tag]);
      setIsNodePubAddressDirty(true);
    }
  };

  const pubAddressSuggestionFilter = (textInputValue: string, possibleSuggestionsArray: Tag[]) => {
    const lowerCaseQuery = textInputValue.toLowerCase();

    return possibleSuggestionsArray.filter((suggestion) => {
      return suggestion.text.toLowerCase().includes(lowerCaseQuery);
    });
  };

  const onSubmit: SubmitHandler<IFormInput> = (data: IFormInput) => {
    const appKeyState = getFieldState("appKey");
    if (appKeyState.isDirty && data.appKey != "notassigned") {
      ConfigClient.modelAppKeyBind(node.unicastAddress, element.address, model.modelID);
    }

    const pubAddressState = getFieldState("pubAddress");
    if (pubAddressState.isDirty && data.pubAddress != "notassigned") {
      ConfigClient.modelPublicationSet(
        node.unicastAddress,
        element.address,
        data.pubAddress,
        model.modelID
      );
    }

    if (isNodePubAddressDirty) {
      const pubAddressesToAdd = nodePubAddresses.filter(
        (t) => nodeSubscriptionGroups.findIndex((g) => g.toLowerCase() === t.id.toLowerCase()) < 0
      );

      pubAddressesToAdd.forEach((g) =>
        ConfigClient.modelSubscriptionAdd(node.unicastAddress, element.address, g.id, model.modelID)
      );
    }

    if (appKeyState.isDirty || pubAddressState.isDirty || isNodePubAddressDirty) {
      reset(undefined, { keepDirty: false, keepDirtyValues: false, keepValues: true });
      setIsNodePubAddressDirty(false);
    }
  };

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
                  <label>Publication</label>
                  <Link to={"/mesh"} className="ml-auto text-sm mt-0 link">
                    Manage Groups
                  </Link>
                </div>
                <select
                  id="publicationAddress"
                  className="border-solid border-2 p-2 border-border rounded-lg block"
                  defaultValue={
                    model.publish != undefined && model.publish.address != ""
                      ? model.publish.address
                      : "notassigned"
                  }
                  {...register("pubAddress")}
                >
                  <option value="notassigned">Not assigned</option>
                  {meshGroups.map((g, i) => (
                    <option value={g.address} key={i}>
                      {g.name} - {g.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex">
                  <label>Subscriptions</label>
                  <Link to={"/mesh"} className="ml-auto text-sm mt-0 link">
                    Manage Groups
                  </Link>
                </div>
                <div className="border-solid border-2 border-border rounded-lg">
                  <ReactTags
                    tags={nodePubAddresses}
                    suggestions={pubAddressSuggestions}
                    handleDelete={handlePubAddressDelete}
                    handleAddition={handlePubAddressAddition}
                    inline={false}
                    allowDragDrop={false}
                    handleFilterSuggestions={pubAddressSuggestionFilter}
                    allowUnique={true}
                    maxLength={6}
                    minQueryLength={1}
                    placeholder="Add subscription"
                    autofocus={false}
                  />
                </div>
              </div>

              <button
                className="primary ml-auto"
                type="submit"
                disabled={!isDirty && !isNodePubAddressDirty}
              >
                Save
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSettings;
