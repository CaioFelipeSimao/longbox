import { createRoot } from "react-dom/client";
import { App } from "./telas/App";

// v132: the host wraps the page in its own skeleton, whose <html> carries no lang,
// so VoiceOver read the Portuguese interface with an English voice.
document.documentElement.lang = "pt-BR";

createRoot(document.getElementById("root")).render(<App />);
