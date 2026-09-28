import { createContext, useContext } from 'react';

/** Which staff area is showing a shared screen: the operations admin or the marketing desk. */
export type StaffArea = '/admin' | '/marketing';
export const AreaContext = createContext<StaffArea>('/admin');
export const useArea = () => useContext(AreaContext);
