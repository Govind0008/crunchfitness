// Single source of truth for business details shown across the public site.

export const SITE = {
  name: 'Crunch Fitness Club',
  url: 'https://www.crunchfitness.fitness',
  phone: '+91 84830 48363',
  phoneHref: 'tel:+918483048363',
  email: 'Crunchfitness680@gmail.com',
  whatsappNumber: '918483048363',
  instagram: 'https://www.instagram.com/crunchfitnessclub',
  instagramHandle: 'crunchfitnessclub',
  address: ['2nd floor, Palash Plus, C Building', 'Opposite Euro School, Wakad', 'Pune, Maharashtra 411050'],
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Crunch+Fitness+Club+Wakad+Pune',
  mapsEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.425823159867!2d73.7674834742727!3d18.599907366747868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b979fd8fdac5%3A0xd27c5a7f4bc4a76e!2sCrunch%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1748722317938!5m2!1sen!2sin',
  healthFormUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSe0mU3RWhMHacMtwOQzwzhcMuwguXvkYJFBaK2Ig_ZyhmHHEA/viewform?pli=1',
} as const;

export const whatsappLink = (message: string, number: string = SITE.whatsappNumber) =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

// Opening hours in 24h local (IST). Index = Date.getDay() (0 = Sunday).
const HOURS: [open: number, close: number][] = [
  [6, 12], [6, 22], [6, 22], [6, 22], [6, 22], [6, 22], [6, 22],
];

export const HOURS_LABELS = [
  { days: 'Monday – Saturday', time: '6:00 AM – 10:00 PM' },
  { days: 'Sunday', time: '6:00 AM – 12:00 PM' },
];

const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`;

const puneNow = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = (Number(get('hour')) % 24) + Number(get('minute')) / 60;
  return { day, hour };
};

/** Whether the gym is open right now, evaluated in Pune's timezone. */
export function getOpenStatus(now: Date = new Date()) {
  const { day, hour } = puneNow(now);
  const [open, close] = HOURS[day];

  if (hour >= open && hour < close) return { open: true, hourNow: hour, label: `Open now · until ${fmt(close)}` };
  if (hour < open) return { open: false, hourNow: hour, label: `Opens today at ${fmt(open)}` };
  const [nextOpen] = HOURS[(day + 1) % 7];
  return { open: false, hourNow: hour, label: `Closed · opens ${fmt(nextOpen)} tomorrow` };
}

/** Today's opening window (24h numbers) and a display label. */
export function getTodayHours(now: Date = new Date()) {
  const [open, close] = HOURS[puneNow(now).day];
  return { open, close, label: `${fmt(open)} – ${fmt(close)}` };
}
