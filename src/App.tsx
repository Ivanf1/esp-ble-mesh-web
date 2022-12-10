import bluetooth from "./services/bluetooth/bluetooth";

function App() {
  const connect = () => {
    bluetooth.initialize();
  };

  return (
    <div className="App">
      <button onClick={connect}>connect</button>
    </div>
  );
}

export default App;
