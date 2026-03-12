import { useState, useEffect } from 'react';
import { Instagram, Twitter, Linkedin, Crown } from 'lucide-react';
import Navigation from '../components/Navigation'; // Assuming path to Navigation
import Footer from '../components/Footer';     // Assuming path to Footer
import { Helmet } from 'react-helmet'; // Import Helmet

const Team = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const teamMembers = [
    {
      name: "Nilima Patil", // Owner
      role: "Founder & Head Trainer",
      specialization: "Holistic Fitness, Business Strategy",
      experience: "10+ Years",
      bio: "The visionary behind Crunch Fitness, Nilima leads with a passion for transforming lives through sustainable fitness and a community-driven approach.",
      image: "/lovable-uploads/nilima mam.jpeg", // Placeholder, ideally a clear photo of Nilima
      social: { instagram: "https://www.instagram.com/nilimapatil_official/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: true,
      objectPosition: "center" // Default for owner, adjust as needed
    },
    {
      name: "Gaurav Dhawale", // Manager (assuming distinct from trainer Gaurav)
      role: "Gym Manager & Operations Head",
      specialization: "Client Relations, Facility Management",
      experience: "7+ Years",
      bio: "Gaurav ensures the smooth operation of Crunch Fitness, focusing on member satisfaction and optimizing the gym environment for everyone.",
      image: "https://images.unsplash.com/photo-1560787313-fd089932067b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Placeholder
      social: { instagram: "https://www.instagram.com/gaurav_dhawale/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "center" // Adjust if Gaurav is not centered
    },
    {
      name: "Vikas Jadhav", // Consultant
      role: "Fitness Consultant & Advisor",
      specialization: "Program Development, Strategic Planning",
      experience: "3+ Years",
      bio: "With vast experience in the fitness industry, Vikas provides expert consultation, shaping innovative training programs and growth strategies for the gym.",
      image: "/lovable-uploads/vikas1.JPG", // Placeholder
      social: { instagram: "https://www.instagram.com/vikas_jadhav_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Example: If Vikas is closer to the top of his photo
    },
    {
      name: "Sheetal Sutar", // Consultant
      role: "Fitness Consultant & Advisor",
      specialization: "Program Development, Strategic Planning",
      experience: "7+ Years",
      bio: "With vast experience in the fitness industry, Sheetal provides expert consultation, shaping innovative training programs and growth strategies for the gym.", // Corrected bio
      image: "https://images.unsplash.com/photo-1557827827-fd6475d9e50f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", // Placeholder
      social: { instagram: "https://www.instagram.com/sheetal_sutar_/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Example: If Vikas is closer to the top of his photo
    },
    {
      name: "Rushikesh Zurange", // Trainer
      role: "Strength & Conditioning Coach",
      specialization: "Weight Training, Functional Fitness",
      experience: "5+ Years",
      bio: "Passionate about building strength and resilience, Rushikesh designs personalized programs that push boundaries and deliver tangible results.",
      image: "/lovable-uploads/rushikesh.JPG", // Placeholder
      social: { instagram: "https://www.instagram.com/rushikesh__zurange/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "center 20%" // Example: if Rushikesh is slightly off-center to the left
    },
    {
      name: "Gaurav Gaikwad", // Trainer (distinguished with initial if two Gauravs)
      role: "Certified Personal Trainer",
      specialization: "Fat Loss, Muscle Gain, Endurance",
      experience: "5+ Years",
      bio: "Dedicated to guiding clients through effective training journeys, Gaurav focuses on sustainable progress and holistic well-being.",
      image: "/lovable-uploads/maddy12.PNG", // Placeholder
      social: { instagram: "https://www.instagram.com/gaurav.gaikwad_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Example: Adjust as needed
    },
    {
      name: "Arjun Kamble", // Trainer
      role: "CrossFit & HIIT Specialist",
      specialization: "High-Intensity Training, Athletic Performance",
      experience: "10+ Years",
      bio: "Arjun brings high energy to every session, specializing in CrossFit and HIIT to help members unlock their peak physical potential.",
      image: "/lovable-uploads/arjun.jpeg", // Placeholder
      social: { instagram: "https://www.instagram.com/arjunkamble_07_/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "center" // Adjust as needed
    },
    {
      name: "Rohit Pote", // Trainer
      role: "Nutrition & Lifestyle Coach",
      specialization: "Diet Planning, Weight Management",
      experience: "8+ Years",
      bio: "Rohit empowers clients with balanced nutrition strategies, ensuring their diet complements their training for optimal health and fitness.",
      image:"/lovable-uploads/rohit1.JPG", //
      social: { instagram: "https://www.instagram.com/rohit_pote_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "center" // Adjust as needed
    },
    {
      name: "Rahul Sahu", // Trainer
      role: "Functional Training Expert",
      specialization: "Mobility, Core Strength, Injury Prevention",
      experience: "5+ Years",
      bio: "Rahul specializes in enhancing body movement and stability through functional training, helping members move better and prevent injuries.",
      image: "/lovable-uploads/ptrahul1.jpeg", // Re-using a placeholder, replace with unique one
      social: { instagram: "https://www.instagram.com/rahulsahu_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "center" // Adjust as needed
    },
    {
      name: "Rahul Saware", // Trainer (distinguished with initial if two Rahuls)
      role: "Bodybuilding Coach",
      specialization: "Hypertrophy, Advanced Lifting Techniques",
      experience: "5+ Years",
      bio: "A dedicated bodybuilding coach, Rahul guides clients through progressive overload and precise techniques to maximize muscle growth and definition.",
      image: "/lovable-uploads/rahulsir.jpeg", // Re-using a placeholder, replace with unique one
      social: { instagram: "https://www.instagram.com/rahulsaware_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Adjust as needed
    },
    {
      name: "Swapnil Bhile", // Trainer
      role: "Personal Trainer & Motivator",
      specialization: "General Fitness, Client Motivation",
      experience: "2+ Years",
      bio: "Swapnil is passionate about inspiring individuals to embark on their fitness journeys, providing constant motivation and adaptable training plans.",
      image: "/lovable-uploads/swapnil.jpeg", // Re-using a placeholder, replace with unique one
      social: { instagram: "https://www.instagram.com/swapnil_bhile_/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Adjust as needed
    },
    {
      name: "Pooja Bansode", // Ladies Trainer (Placeholder name)
      role: "Ladies Fitness Specialist",
      specialization: "Women's Health, Pre/Post Natal Fitness, Yoga",
      experience: "3+ Years",
      bio: "Pooja empowers women through specialized fitness programs, focusing on their unique health needs and promoting confidence and strength.", // Corrected bio
      image: "/lovable-uploads/lady.JPG", // Placeholder
      social: { instagram: "https://www.instagram.com/pooja_bansode_fitness/", twitter: "#", linkedin: "#" }, // Added Instagram link
      isOwner: false,
      objectPosition: "top" // Adjust as needed
    }
  ];
return (
    <div className="min-h-screen bg-black text-white pt-20">
            <Navigation />

      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden" aria-labelledby="team-hero-heading">
        <div className="absolute inset-0">
          <img
            src="/lovable-uploads/team-1.jpeg"
            alt="Crunch Fitness expert team training in a modern gym setting"
            className="w-full h-full object-cover object-[center_40%] brightness-75"
          />
          
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70"></div>
        </div>
      </section>

      <section className="py-20 relative bg-gradient-to-b from-black to-gray-900" aria-labelledby="our-trainers-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 id="our-trainers-heading" className="text-4xl md:text-5xl font-orbitron font-bold text-center mb-12">
            <span className="text-white">OUR CERTIFIED</span> <span className="neon-text">TRAINERS</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className={`relative group transition-all duration-700 transform hover:scale-105 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
                onMouseEnter={() => setHoveredMember(index)}
                onMouseLeave={() => setHoveredMember(null)}
              >
                <div className={`relative h-[500px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden border-2 transition-all duration-500 shadow-xl ${
                  member.isOwner ? 'border-yellow-500 hover:border-yellow-400' : 'border-gray-700 hover:border-green-500'
                }`}>
                  {member.isOwner && (
                    <div className="absolute top-4 right-4 z-20 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-3 py-1 rounded-full flex items-center space-x-1 text-sm font-bold">
                      <Crown size={16} />
                      <span>GYM OWNER</span>
                    </div>
                  )}

                  <div className="relative h-3/5 overflow-hidden">
                    <img
                      src={member.image}
                      alt={`${member.name}, ${member.role} at Crunch Fitness Club`}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                      style={{ objectPosition: member.objectPosition }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-2/5 p-6 bg-gradient-to-t from-black via-black/95 to-transparent flex flex-col justify-end">
                    <div className="text-center space-y-2">
                      <h3 className={`text-2xl font-orbitron font-bold mb-2 ${member.isOwner ? 'text-yellow-400' : 'text-white'}`}>{member.name}</h3>
                      <p className={`font-rajdhani font-semibold mb-2 ${member.isOwner ? 'text-yellow-300' : 'text-green-500'}`}>{member.role}</p>
                      <p className="text-gray-400 font-rajdhani text-sm mb-2">Specialization: {member.specialization}</p>
                      <p className={`font-rajdhani text-sm mb-3 font-bold ${member.isOwner ? 'text-yellow-500' : 'text-orange-500'}`}>Experience: {member.experience}</p>
                      <div className={`transition-all duration-500 ${hoveredMember === index ? 'opacity-100 translate-y-0 max-h-16' : 'opacity-0 translate-y-4 max-h-0'} overflow-hidden`}>
                        <p className="text-gray-400 font-rajdhani text-sm mb-3">{member.bio}</p>
                      </div>
                      <div className="flex justify-center">
                        <a href={member.social.instagram} className={`w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white transition-all duration-300 ${member.isOwner ? 'hover:bg-yellow-500 hover:text-black' : 'hover:bg-green-500 hover:text-black'}`} aria-label={`Instagram profile of ${member.name}`}>
                          <Instagram size={16} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Team;
