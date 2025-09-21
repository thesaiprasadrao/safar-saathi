
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";
import 'leaflet/dist/leaflet.css';
import './styles/pulse.css';

createRoot(document.getElementById("root")!).render(<App />);
