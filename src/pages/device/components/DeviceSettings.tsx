interface Props {
  onElementSelected: (elementNumber: number) => void;
}
const DeviceSettings = ({ onElementSelected }: Props) => {
  const elements = [
    {
      name: "hi",
      unicastAddress: "0x000C",
      models: ["Configuration Server", "Generic OnOff Server"],
    },
    {
      name: "hiiiii",
      unicastAddress: "0x000E",
      models: ["Configuration Server"],
    },
    {
      name: "heei",
      unicastAddress: "0x000F",
      models: ["Configuration Server", "Generic OnOff Server"],
    },
  ];

  return (
    <>
      <h5>Device Settings</h5>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <label>Network Key</label>
          <select
            id="net-key"
            defaultValue={0}
            className="border-solid border-2 p-2 border-border rounded-lg block"
          >
            <option>Not assigned</option>
            <option value="abcdefghi">abcdefghi</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label>Elements</label>
          <div className="elements-table grid min-w-full rounded-lg border-solid border-2 border-border text-left">
            <div className="bg-bg-light font-medium rounded-t-lg">
              <span>Name</span>
              <span>Unicast Address</span>
              <span>Models</span>
            </div>
            {elements.map((e, i) => {
              return (
                <ElementsTableElement
                  elementName={e.name}
                  unicastAddress={e.unicastAddress}
                  models={e.models}
                  onConfigureElementClick={onElementSelected}
                  elementIdx={i}
                  key={i}
                />
              );
            })}
          </div>
        </div>

        <button className="primary ml-auto">Save</button>
      </div>
    </>
  );
};

interface ElementsTableElementProps {
  elementName: string;
  elementIdx: number;
  models: string[];
  unicastAddress: string;
  onConfigureElementClick: (elementNumber: number) => void;
}
const ElementsTableElement = ({
  elementName,
  elementIdx,
  models,
  unicastAddress,
  onConfigureElementClick,
}: ElementsTableElementProps) => {
  return (
    <div>
      <span>{elementName}</span>
      <span>{unicastAddress}</span>
      <div className="flex flex-col gap-2">
        {models.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <button className="secondary self-start" onClick={() => onConfigureElementClick(elementIdx)}>
        Configure
      </button>
    </div>
  );
};

export default DeviceSettings;
