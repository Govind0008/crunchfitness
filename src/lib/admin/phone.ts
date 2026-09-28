/** Normalise any Indian phone format ("+91 90000 00001", "09000000001") to its last 10 digits.
 *  This is the join key between members, check-ins and event registrations. */
export const phoneKey = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/** One display format for every phone number: "+91 90000 00001" (falls back to what was typed). */
export const formatPhone = (phone: string) => {
  const k = phoneKey(phone);
  return k.length === 10 ? `+91 ${k.slice(0, 5)} ${k.slice(5)}` : phone;
};
