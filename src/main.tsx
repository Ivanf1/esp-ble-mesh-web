import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Device from "./pages/device/Device";
import Provisioning from "./pages/provisioning/Provisioning";
import ErrorPage from "./pages/error/ErrorPage";
import ElementSettings from "./pages/device/subpages/ElementSettings";
import ModelSettings from "./pages/device/subpages/ModelSettings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "device/element/:elementNumber/model/:modelNumber",
        element: <ModelSettings />,
      },
      {
        path: "device/element/:elementNumber",
        element: <ElementSettings />,
      },
      {
        path: "device",
        element: <Device />,
      },
      {
        path: "provisioning",
        element: <Provisioning />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
