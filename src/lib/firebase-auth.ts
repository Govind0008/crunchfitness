import { connectAuthEmulator, getAuth } from "firebase/auth";
import { app, USE_EMULATORS } from "./firebase";

// Separate module so only the portal routes (login, dashboards, event admin) pull in firebase/auth
export const auth = getAuth(app);
if (USE_EMULATORS) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
