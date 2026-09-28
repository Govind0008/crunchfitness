import { createContext, useContext } from 'react';
import type { Actor } from '@/lib/events';

export const ActorContext = createContext<Actor | null>(null);
/** The signed-in admin, recorded on every activity-log entry. */
export const useActor = () => useContext(ActorContext)!;
