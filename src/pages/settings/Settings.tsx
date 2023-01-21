const Settings = () => {
  return (
    <>
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <div>
            <h5 className="mb-3">Network Key</h5>
            <div className="p-4 rounded-lg border-solid border-2 border-border">
              <span>jalòsjkdglkajsldgj</span>
            </div>
          </div>
          <div>
            <h5 className="mb-3">Application Key</h5>
            <div className="p-4 rounded-lg border-solid border-2 border-border">
              <span>jalòsjkdglkajsldgj</span>
            </div>
          </div>
        </div>
        <div>
          <div>
            <h5 className="mb-3">Composition Data</h5>
            <div className="p-4 rounded-lg border-solid border-2 border-border grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <span className="font-medium">Name:</span>
              <span>blablabla</span>
              <span className="font-medium">Id:</span>
              <span>blablabla</span>
              <span className="font-medium">Unicast Address:</span>
              <span>blablabla</span>
              <span className="font-medium">TTL:</span>
              <span>blablabla</span>
              <span className="font-medium">Device Key:</span>
              <span>blablabla</span>
              <span className="font-medium">Company Identifier</span>
              <span>blablabla</span>
              <span className="font-medium">Product Identifier:</span>
              <span>blablabla</span>
              <span className="font-medium">Product Version:</span>
              <span>blablabla</span>
              <span className="font-medium">Replay Protection Count:</span>
              <span>blablabla</span>
              <span className="font-medium">Relay:</span>
              <span>blablabla</span>
              <span className="font-medium">Proxy:</span>
              <span>blablabla</span>
              <span className="font-medium">Friend:</span>
              <span>blablabla</span>
              <span className="font-medium">Low Power:</span>
              <span>blablabla</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
