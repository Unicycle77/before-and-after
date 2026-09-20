import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isFirebaseConfigured } from "./firebase";
import { MainScreen } from "./MainScreen";
import { Play } from "./Play";
import "./styles.css";

function Root() {
  if (!isFirebaseConfigured) {
    return <main className="center"><h1>Firebase not configured</h1><p>Copy <code>.env.example</code> to <code>.env</code> and fill in your project's values.</p></main>;
  }
  // "/" is the shared main screen; "/play" is what phones open.
  return window.location.pathname.startsWith("/play") ? <Play /> : <MainScreen />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
