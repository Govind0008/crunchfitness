import { useEffect, useState } from 'react';
import { watchEvent, watchRegistrations, watchResults, type CrunchEvent, type Registration, type Result } from '@/lib/events';

/** Live data for one event — shared by the control centre, check-in and event-day screens. */
export function useEventData(id: string | undefined) {
  const [event, setEvent] = useState<CrunchEvent | null | undefined>(undefined);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  useEffect(() => (id ? watchEvent(id, setEvent, () => setEvent(null)) : undefined), [id]);
  useEffect(() => (id ? watchRegistrations(id, setRegistrations) : undefined), [id]);
  useEffect(() => (id ? watchResults(id, setResults) : undefined), [id]);
  return { event, registrations, results };
}
