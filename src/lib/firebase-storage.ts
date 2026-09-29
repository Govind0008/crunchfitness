import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { app, USE_EMULATORS } from './firebase';

// Separate module so only admin screens that handle member photos pull in firebase/storage
export const storage = getStorage(app);
if (USE_EMULATORS) connectStorageEmulator(storage, '127.0.0.1', 9199);
