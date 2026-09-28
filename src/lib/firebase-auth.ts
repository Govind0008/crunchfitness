import { getAuth } from "firebase/auth";
import { app } from "./firebase";

// Separate module so only the portal routes (login, dashboards) pull in firebase/auth
export const auth = getAuth(app);
