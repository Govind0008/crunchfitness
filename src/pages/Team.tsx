import { useState, useEffect } from 'react';
import { Instagram, Crown } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Footer from '../components/Footer';
import { PageHeader, Section } from '@/components/site/Section';
import CtaBand from '@/components/site/CtaBand';
import { Helmet } from 'react-helmet';

interface Member {
  id?: string;
  name: string;
  role: string;
  specialization: string;
  experience: string;
  bio: string;
  image: string;
  instagram: string;
  isOwner: boolean;
  objectPosition: string;
  order?: number;
  visible?: boolean;
}

// Static fallback — shown until admin populates Firestore
const FALLBACK_MEMBERS: Member[] = [
  {
    name: "Nilima Patil",
    role: "Founder & Head Trainer",
    specialization: "Holistic Fitness, Business Strategy",
    experience: "10+ Years",
    bio: "The visionary behind Crunch Fitness, Nilima leads with a passion for transforming lives through sustainable fitness and a community-driven approach.",
    image: "/lovable-uploads/nilima mam.jpeg",
    instagram: "https://www.instagram.com/nilimapatil_official/",
    isOwner: true,
    objectPosition: "center",
  },
  {
    name: "Gaurav Dhawale",
    role: "Gym Manager & Operations Head",
    specialization: "Client Relations, Facility Management",
    experience: "7+ Years",
    bio: "Gaurav ensures the smooth operation of Crunch Fitness, focusing on member satisfaction and optimizing the gym environment for everyone.",
    image: "https://images.unsplash.com/photo-1560787313-fd089932067b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    instagram: "https://www.instagram.com/gaurav_dhawale/",
    isOwner: false,
    objectPosition: "center",
  },
  {
    name: "Vikas Jadhav",
    role: "Fitness Consultant & Advisor",
    specialization: "Program Development, Strategic Planning",
    experience: "3+ Years",
    bio: "With vast experience in the fitness industry, Vikas provides expert consultation, shaping innovative training programs and growth strategies for the gym.",
    image: "/lovable-uploads/vikas1.JPG",
    instagram: "https://www.instagram.com/vikas_jadhav_fitness/",
    isOwner: false,
    objectPosition: "top",
  },
  {
    name: "Sheetal Sutar",
    role: "Fitness Consultant & Advisor",
    specialization: "Program Development, Strategic Planning",
    experience: "7+ Years",
    bio: "With vast experience in the fitness industry, Sheetal provides expert consultation, shaping innovative training programs and growth strategies for the gym.",
    image: "https://images.unsplash.com/photo-1557827827-fd6475d9e50f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
    instagram: "https://www.instagram.com/sheetal_sutar_/",
    isOwner: false,
    objectPosition: "top",
  },
  {
    name: "Rushikesh Zurange",
    role: "Strength & Conditioning Coach",
    specialization: "Weight Training, Functional Fitness",
    experience: "5+ Years",
    bio: "Passionate about building strength and resilience, Rushikesh designs personalized programs that push boundaries and deliver tangible results.",
    image: "/lovable-uploads/rushikesh.JPG",
    instagram: "https://www.instagram.com/rushikesh__zurange/",
    isOwner: false,
    objectPosition: "center 20%",
  },
  {
    name: "Gaurav Gaikwad",
    role: "Certified Personal Trainer",
    specialization: "Fat Loss, Muscle Gain, Endurance",
    experience: "5+ Years",
    bio: "Dedicated to guiding clients through effective training journeys, Gaurav focuses on sustainable progress and holistic well-being.",
    image: "/lovable-uploads/maddy12.PNG",
    instagram: "https://www.instagram.com/gaurav.gaikwad_fitness/",
    isOwner: false,
    objectPosition: "top",
  },
  {
    name: "Arjun Kamble",
    role: "CrossFit & HIIT Specialist",
    specialization: "High-Intensity Training, Athletic Performance",
    experience: "10+ Years",
    bio: "Arjun brings high energy to every session, specializing in CrossFit and HIIT to help members unlock their peak physical potential.",
    image: "/lovable-uploads/arjun.jpeg",
    instagram: "https://www.instagram.com/arjunkamble_07_/",
    isOwner: false,
    objectPosition: "center",
  },
  {
    name: "Rohit Pote",
    role: "Nutrition & Lifestyle Coach",
    specialization: "Diet Planning, Weight Management",
    experience: "8+ Years",
    bio: "Rohit empowers clients with balanced nutrition strategies, ensuring their diet complements their training for optimal health and fitness.",
    image: "/lovable-uploads/rohit1.JPG",
    instagram: "https://www.instagram.com/rohit_pote_fitness/",
    isOwner: false,
    objectPosition: "center",
  },
  {
    name: "Rahul Sahu",
    role: "Functional Training Expert",
    specialization: "Mobility, Core Strength, Injury Prevention",
    experience: "5+ Years",
    bio: "Rahul specializes in enhancing body movement and stability through functional training, helping members move better and prevent injuries.",
    image: "/lovable-uploads/ptrahul1.jpeg",
    instagram: "https://www.instagram.com/rahulsahu_fitness/",
    isOwner: false,
    objectPosition: "center",
  },
  {
    name: "Rahul Saware",
    role: "Bodybuilding Coach",
    specialization: "Hypertrophy, Advanced Lifting Techniques",
    experience: "5+ Years",
    bio: "A dedicated bodybuilding coach, Rahul guides clients through progressive overload and precise techniques to maximize muscle growth and definition.",
    image: "/lovable-uploads/rahulsir.jpeg",
    instagram: "https://www.instagram.com/rahulsaware_fitness/",
    isOwner: false,
    objectPosition: "top",
  },
  {
    name: "Swapnil Bhile",
    role: "Personal Trainer & Motivator",
    specialization: "General Fitness, Client Motivation",
    experience: "2+ Years",
    bio: "Swapnil is passionate about inspiring individuals to embark on their fitness journeys, providing constant motivation and adaptable training plans.",
    image: "/lovable-uploads/swapnil.jpeg",
    instagram: "https://www.instagram.com/swapnil_bhile_/",
    isOwner: false,
    objectPosition: "top",
  },
  {
    name: "Pooja Bansode",
    role: "Ladies Fitness Specialist",
    specialization: "Women's Health, Pre/Post Natal Fitness, Yoga",
    experience: "3+ Years",
    bio: "Pooja empowers women through specialized fitness programs, focusing on their unique health needs and promoting confidence and strength.",
    image: "/lovable-uploads/lady.JPG",
    instagram: "https://www.instagram.com/pooja_bansode_fitness/",
    isOwner: false,
    objectPosition: "top",
  },
];

const MemberPhoto = ({ member }: { member: Member }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !member.image) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink-800 font-display text-6xl font-bold text-ink-600" aria-hidden>
        {member.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
      </div>
    );
  }
  return (
    <img
      src={member.image}
      alt={`${member.name}, ${member.role} at Crunch Fitness Club`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
      style={{ objectPosition: member.objectPosition || 'center' }}
    />
  );
};

const Team = () => {
  const [firestoreMembers, setFirestoreMembers] = useState<Member[]>([]);
  const [loadingFirestore, setLoadingFirestore] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Member))
        .filter((m) => m.visible !== false);
      setFirestoreMembers(data);
      setLoadingFirestore(false);
    }, () => setLoadingFirestore(false));
    return unsub;
  }, []);

  // Use Firestore data once it's loaded and non-empty; otherwise show static fallback
  const displayMembers = !loadingFirestore && firestoreMembers.length > 0
    ? firestoreMembers
    : FALLBACK_MEMBERS;

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Our Team | Crunch Fitness Club</title>
      </Helmet>

      <main>
        <PageHeader
          eyebrow="The team"
          title={<>Coaches in <span className="text-brand-400">your corner</span></>}
          lede="Certified trainers covering strength, fat loss, functional training, nutrition and women's fitness — on the floor every day to guide your sessions."
          image={{ src: '/images/team-1920.webp', srcSet: '/images/team-960.webp 960w, /images/team-1920.webp 1920w', alt: 'The Crunch Fitness coaching team', position: 'center 35%' }}
        />

        <Section aria-labelledby="our-trainers-heading">
          <h2 id="our-trainers-heading" className="sr-only">Our certified trainers</h2>

          {loadingFirestore ? (
            <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading trainers">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="animate-pulse">
                  <div className="aspect-[4/5] rounded-2xl bg-ink-900" />
                  <div className="mt-5 h-5 w-2/3 rounded bg-ink-900" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-ink-900" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {displayMembers.map((member, index) => {
                const hasInstagram = member.instagram && member.instagram !== '#';
                return (
                  <li
                    key={member.id ?? index}
                    className="m-rise"
                    style={{ '--i': Math.min(index, 8) } as React.CSSProperties}
                  >
                    <article className="group flex h-full flex-col transition-transform duration-500 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-900 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-500 group-hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
                        {/* Photo drifts up and in, like a coach stepping forward */}
                        <div className="h-full w-full transition-transform [transition-duration:900ms] ease-out-expo [@media(hover:hover)]:group-hover:-translate-y-2 [@media(hover:hover)]:group-hover:scale-[1.06]">
                          <MemberPhoto member={member} />
                        </div>
                        <span className="hud absolute right-3 top-3 rounded-full bg-ink-950/60 px-2.5 py-1.5 text-white/80 backdrop-blur-sm">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {member.isOwner && (
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-ink-950">
                            <Crown className="h-3.5 w-3.5" aria-hidden /> Gym owner
                          </span>
                        )}

                        {/* Pointer devices: bio + action rise over the photo on hover / focus */}
                        <div className="pointer-events-none absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent p-5 opacity-0 transition-opacity duration-500 [@media(hover:hover)]:flex group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                          <span className="block h-px w-8 origin-left scale-x-0 bg-brand-400 transition-transform delay-100 duration-500 ease-out-expo group-hover:scale-x-100 group-focus-within:scale-x-100" aria-hidden />
                          {member.bio && (
                            <p className="mt-3 translate-y-3 text-sm leading-relaxed text-ink-200 transition-transform duration-500 ease-out-expo line-clamp-5 group-hover:translate-y-0 group-focus-within:translate-y-0">
                              {member.bio}
                            </p>
                          )}
                          {hasInstagram && (
                            <a
                              href={member.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-drive mt-4 inline-flex w-fit translate-y-3 items-center gap-2 text-sm font-semibold text-white transition-transform delay-75 duration-500 ease-out-expo hover:text-brand-400 group-hover:translate-y-0 group-focus-within:translate-y-0"
                              aria-label={`Instagram profile of ${member.name}`}
                            >
                              <Instagram className="h-4 w-4" aria-hidden /> Follow on Instagram
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="mt-5">
                        <h3 className="font-display text-3xl font-bold uppercase leading-none text-white">{member.name}</h3>
                        <p className="mt-1 text-sm font-medium text-brand-400">{member.role}</p>
                        {(member.specialization || member.experience) && (
                          <dl className="mt-4 space-y-1 text-sm">
                            {member.specialization && (
                              <div className="flex gap-2"><dt className="text-ink-500">Focus</dt><dd className="text-ink-200">{member.specialization}</dd></div>
                            )}
                            {member.experience && (
                              <div className="flex gap-2"><dt className="text-ink-500">Experience</dt><dd className="text-ink-200">{member.experience}</dd></div>
                            )}
                          </dl>
                        )}
                        {/* Touch devices: bio and Instagram stay visible below the photo */}
                        <div className="[@media(hover:hover)]:hidden">
                          {member.bio && <p className="mt-3 text-sm leading-relaxed text-ink-400 line-clamp-4">{member.bio}</p>}
                          {hasInstagram && (
                            <a
                              href={member.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white"
                              aria-label={`Instagram profile of ${member.name}`}
                            >
                              <Instagram className="h-4 w-4" aria-hidden /> Instagram
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <CtaBand title="Train with our coaches" body="Book a free tour and we'll introduce you to the trainer best suited to your goal." />
      </main>

      <Footer />
    </div>
  );
};

export default Team;
