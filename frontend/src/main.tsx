import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";

import App from "./App";
import "./index.css";

// No <React.StrictMode> here: its dev-only double-invoke of mount/cleanup
// effects breaks maplibre-gl's Map initialization (verified directly against
// raw maplibre-gl, independent of react-map-gl/deck.gl -- the second Map
// instance never reaches "loaded" and renders a blank canvas). This is a
// dev-only tradeoff (StrictMode's extra effect-safety checks are lost) --
// production builds are unaffected either way since React only double-invokes
// in development.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
