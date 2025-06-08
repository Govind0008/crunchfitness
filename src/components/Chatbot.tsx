import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

// Enhanced Trainer Interface (kept for context, not directly used for SEO in component)
interface Trainer {
  name: string;
  specializations: string[];
  certifications: string[];
  bio: string;
  image?: string;
}

// Enhanced Service Interface (kept for context, not directly used for SEO in component)
interface Service {
  name: string;
  description: string;
  keywords?: string[];
}

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "👋 Hey there! I'm your dedicated Crunch Fitness virtual assistant. Ready to crush your fitness goals? Ask me anything!",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem('hasVisitedChatbot');
    if (!hasVisited) {
      setIsOpen(true);
      sessionStorage.setItem('hasVisitedChatbot', 'true');
    }
  }, []);

  // --- Enhanced Gym Data Structure ---
  const gymData = {
    membership: {
      basic: { price: '₹999', name: 'Basic', benefits: ['Access to gym equipment', 'Locker room', 'Basic fitness assessment', 'Mobile app access', 'Community support'] },
      pro: { price: '₹1,499', name: 'Pro', benefits: ['Everything in Basic', 'Limited personal training sessions', 'Nutrition consultation', 'Group fitness classes', 'Premium locker', 'Guest passes'] },
      elite: { price: '₹1,999', name: 'Elite', benefits: ['Everything in Pro', 'Unlimited personal training', 'VIP locker room access', 'Massage therapy', 'Custom nutrition meal plans', 'Unlimited guest passes'] }
    },
    timings: '5 AM to 10 PM, Monday to Sunday',
    location: 'Wakad, Pune', // Corrected location to match previous sections
    contact: '+91-9876543210',
    email: 'info@crunchfitness.fit', // Changed domain to match your site
    website: 'https://www.crunchfitness.fit/', // Changed domain to match your site and added https

    // Detailed Trainer Information (used by bot, not directly SEO)
    trainers: [
      {
        name: 'Trainer Jane Doe',
        specializations: ['Strength Training', 'Powerlifting', 'Sports Performance'],
        certifications: ['Certified Strength and Conditioning Specialist (CSCS)', 'USA Powerlifting Coach'],
        bio: "Jane is a national gold medalist in powerlifting, with a passion for helping athletes maximize their strength and achieve peak performance. Her focus is on safe, effective lifting techniques and progressive overload.",
        image: '/dummy-assets/trainer-jane.jpg'
      },
      {
        name: 'Trainer John Smith',
        specializations: ['Diet & Nutrition', 'Weight Management', 'Body Transformation', 'Meal Planning'],
        certifications: ['Precision Nutrition Level 1 (PN1)', 'Certified Personal Trainer (CPT) - NASM'],
        bio: "John specializes in holistic nutrition and sustainable weight loss. He believes in empowering clients with knowledge to make informed food choices that complement their fitness goals and lifestyle.",
        image: '/dummy-assets/trainer-john.jpg'
      },
      {
        name: 'Trainer Sarah Lee',
        specializations: ['Yoga & Flexibility', 'Pilates', 'Rehabilitation Exercises', 'Mindfulness'],
        certifications: ['RYT 500 Yoga Alliance', 'Pilates Mat & Reformer Certification'],
        bio: "Sarah brings a mindful approach to fitness, focusing on flexibility, core strength, and injury prevention. Her sessions are designed to improve mobility, reduce stress, and enhance overall well-being.",
        image: '/dummy-assets/trainer-sarah.jpg'
      },
      {
          name: 'Trainer David Kim',
          specializations: ['CrossFit', 'HIIT', 'Endurance Training', 'Functional Fitness'],
          certifications: ['CrossFit Level 1 Trainer', 'ACSM Certified Personal Trainer'],
          bio: "David is a high-energy trainer who loves pushing limits with dynamic, functional workouts. He helps clients build endurance, strength, and agility through challenging and varied routines.",
          image: '/dummy-assets/trainer-david.jpg'
      }
    ],

    // Detailed Service Information (used by bot, not directly SEO)
    services: [
      { name: 'Zumba Classes', description: 'Energetic dance fitness classes perfect for all levels, combining fun moves with a great cardio workout.', keywords: ['zumba', 'dance', 'cardio'] },
      { name: 'CrossFit Training', description: 'High-intensity functional movements designed to build strength, endurance, and agility. Our certified coaches guide you through challenging WODs.', keywords: ['crossfit', 'hiit', 'functional'] },
      { name: 'Weight Training', description: 'Guided strength building sessions with our expert trainers, focusing on proper form and progressive overload for muscle growth and fat loss.', keywords: ['weight', 'strength', 'muscle', 'gym equipment'] },
      { name: 'Yoga & Pilates', description: 'Improve flexibility, balance, and core strength with our diverse range of Yoga and Pilates classes, suitable for beginners to advanced practitioners.', keywords: ['yoga', 'pilates', 'flexibility', 'mindfulness'] },
      { name: 'Personal Training', description: 'One-on-one sessions tailored to your individual goals, delivered by our highly certified personal trainers. Get customized workout plans and expert guidance.', keywords: ['personal training', 'one-on-one', 'custom workout'] },
      { name: 'Nutrition Consultation', description: 'Personalized diet plans and guidance from our certified nutritionists to complement your fitness goals, whether it\'s weight loss, muscle gain, or healthy eating.', keywords: ['nutrition', 'diet', 'meal plan', 'eating'] },
      { name: 'Massage Therapy', description: 'Post-workout recovery and relaxation sessions to help soothe sore muscles, reduce tension, and improve circulation.', keywords: ['massage', 'recovery', 'relaxation'] },
      { name: 'Community Events', description: 'Engaging events, workshops, and challenges designed to foster a supportive and motivating fitness community.', keywords: ['events', 'community', 'workshops'] }
    ]
  };

  const getResponse = useCallback((userInput: string): string => {
    const input = userInput.toLowerCase();

    // --- Greetings & General ---
    if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
      if (messages.length === 1 && messages[0].isBot) {
        return "Welcome to Crunch Fitness! 🎉 I'm here to answer any questions you have about our club. What's on your mind today?";
      }
      return "Hello again! How can I help you continue your fitness journey at Crunch Fitness?";
    }
    if (input.includes('how are you')) {
      return "I'm a virtual assistant, so I don't have feelings, but I'm fully charged and ready to help you with anything about Crunch Fitness! How can I make your day more productive?";
    }
    if (input.includes('what can you do')) {
      return "I can provide details about our **membership plans**, **club timings**, **location**, introduce you to our **expert trainers** and their specializations, explain our exciting **services and classes**, or tell you how to **contact us**. What would you like to know?";
    }
    if (input.includes('thank') || input.includes('thanks') || input.includes('appreciate')) {
        return "You're most welcome! Always happy to help you on your fitness journey. Is there anything else I can clarify?";
    }

    // --- Membership Pricing & Details ---
    const membershipKeywords = ['membership', 'plan', 'price', 'cost', 'sign up', 'join'];
    if (membershipKeywords.some(keyword => input.includes(keyword))) {
        if (input.includes('basic')) {
            return `Our **Basic** membership is just ${gymData.membership.basic.price} per month! It includes: ${gymData.membership.basic.benefits.join(', ')}. It's a fantastic foundation for your fitness journey!`;
        }
        if (input.includes('pro')) {
            return `The **Pro** membership is ${gymData.membership.pro.price} per month. This popular plan includes: ${gymData.membership.pro.benefits.join(', ')}. It's designed for those ready to level up!`;
        }
        if (input.includes('elite')) {
            return `Our **Elite** membership is the ultimate fitness package at ${gymData.membership.elite.price} per month. It offers: ${gymData.membership.elite.benefits.join(', ')}. Get ready for unparalleled support and results!`;
        }
        return `We have three fantastic membership options designed to fit your needs:
• **Basic**: ${gymData.membership.basic.price}/month
• **Pro**: ${gymData.membership.pro.price}/month
• **Elite**: ${gymData.membership.elite.price}/month

Which one sounds like the best fit for your fitness journey, or would you like more details on a specific plan?`;
    }

    // --- Location ---
    if (input.includes('location') || input.includes('where') || input.includes('address') || input.includes('find you') || input.includes('wakad') || input.includes('pune')) {
      return `Crunch Fitness Club is conveniently located in **${gymData.location}**. We're on Pink City Road, making your visit hassle-free!`;
    }

    // --- Timings ---
    if (input.includes('time') || input.includes('open') || input.includes('hour') || input.includes('6 am') || input.includes('morning') || input.includes('evening')) {
      return `We're open every day, **${gymData.timings}**! Whether you're an early bird or a night owl, we're here to accommodate your schedule. Yes, you can definitely come at 6 AM - we're ready!`;
    }

    // --- Trainers & Specializations ---
    const trainerKeywords = ['trainer', 'coach', 'instructor', 'expert', 'personal training'];
    if (trainerKeywords.some(keyword => input.includes(keyword))) {
        // Specific trainer lookup
        const foundTrainer = gymData.trainers.find(trainer => input.includes(trainer.name.toLowerCase().replace('trainer ', '')));
        if (foundTrainer) {
            return `Absolutely! Here's some info about ${foundTrainer.name}:
**Specializations**: ${foundTrainer.specializations.join(', ')}
**Certifications**: ${foundTrainer.certifications.join(', ')}
**Bio**: ${foundTrainer.bio}
Would you like to book a session with ${foundTrainer.name}?`;
        }

        // Certification lookup
        if (input.includes('certified') || input.includes('best certified') || input.includes('most certified')) {
            const allCerts = [...new Set(gymData.trainers.flatMap(t => t.certifications))].join(', ');
            return `Our trainers hold a variety of esteemed certifications including: ${allCerts}. Each trainer brings a unique set of expertise to help you achieve your goals.`;
        }

        // Specialization lookup (e.g., "diet", "yoga", "strength")
        if (input.includes('diet') || input.includes('nutrition') || input.includes('meal plan')) {
            const dietTrainers = gymData.trainers.filter(t => t.specializations.some(s => s.toLowerCase().includes('diet') || s.toLowerCase().includes('nutrition') || s.toLowerCase().includes('meal planning')));
            if (dietTrainers.length > 0) {
                return `For **Diet & Nutrition** guidance, I highly recommend ${dietTrainers.map(t => t.name).join(' and ')}. They are certified experts in helping you with meal planning and sustainable eating habits. Would you like to know more about their approach or book a consultation?`;
            }
        }
        if (input.includes('yoga') || input.includes('flexibility') || input.includes('pilates')) {
            const yogaPilatesTrainers = gymData.trainers.filter(t => t.specializations.some(s => s.toLowerCase().includes('yoga') || s.toLowerCase().includes('pilates') || s.toLowerCase().includes('flexibility')));
            if (yogaPilatesTrainers.length > 0) {
                return `If you're looking for **Yoga or Pilates**, ${yogaPilatesTrainers.map(t => t.name).join(' and ')} are our specialists. They'll help you improve flexibility, core strength, and overall well-being.`;
            }
        }
        if (input.includes('strength') || input.includes('powerlifting') || input.includes('muscle') || input.includes('lifting')) {
            const strengthTrainers = gymData.trainers.filter(t => t.specializations.some(s => s.toLowerCase().includes('strength') || s.toLowerCase().includes('powerlifting')));
            if (strengthTrainers.length > 0) {
                return `For **Strength Training** and building muscle, ${strengthTrainers.map(t => t.name).join(' and ')} are your go-to experts. They're excellent at developing powerful workout routines and ensuring proper form.`;
            }
        }
        if (input.includes('crossfit') || input.includes('hiit') || input.includes('endurance')) {
            const crossfitTrainers = gymData.trainers.filter(t => t.specializations.some(s => s.toLowerCase().includes('crossfit') || s.toLowerCase().includes('hiit') || s.toLowerCase().includes('endurance')));
            if (crossfitTrainers.length > 0) {
                return `For dynamic **CrossFit, HIIT, or Endurance Training**, check out ${crossfitTrainers.map(t => t.name).join(' and ')}. They'll help you push your limits and achieve peak functional fitness.`;
            }
        }

        // General trainer info if no specific specialization found
        const allTrainerNames = gymData.trainers.map(t => t.name).join(', ');
        return `Our team of expert trainers, including ${allTrainerNames}, are all highly certified and passionate about helping you. What kind of training or specialization are you interested in?`;
    }

    // --- Services/Classes ---
    const serviceKeywords = ['class', 'service', 'offer', 'what do you have'];
    if (serviceKeywords.some(keyword => input.includes(keyword)) ||
        gymData.services.some(s => s.keywords?.some(k => input.includes(k)))) {

        // Specific service lookup
        const foundService = gymData.services.find(service =>
            input.includes(service.name.toLowerCase().replace(' classes', '').replace(' training', '')) ||
            service.keywords?.some(k => input.includes(k))
        );

        if (foundService) {
            return `You're asking about **${foundService.name}**! ${foundService.description} Many of our services, like this one, are included in our Pro and Elite memberships.`;
        }

        // List all services
        const serviceNames = gymData.services.map(s => s.name).join(', ');
        return `We offer a wide range of services and classes to keep your workouts exciting and effective! These include: **${serviceNames}**. Is there a specific class or service you'd like to know more about?`;
    }

    // --- Contact ---
    if (input.includes('contact') || input.includes('call') || input.includes('phone') || input.includes('number') || input.includes('email') || input.includes('website')) {
      let contactInfo = `You can easily reach us at **${gymData.contact}** during working hours. `;
      if (input.includes('email')) {
          contactInfo += `You can also send us an email at **${gymData.email}**.`;
      }
      if (input.includes('website')) {
          contactInfo += `Visit our website at **${gymData.website}** for more details and online forms.`;
      }
      return contactInfo.trim();
    }

    // --- Trial / First visit ---
    if (input.includes('trial') || input.includes('first visit') || input.includes('demo') || input.includes('guest pass') || input.includes('visit')) {
      return "Absolutely! We offer guest passes and trial sessions so you can experience Crunch Fitness firsthand. Please visit our front desk or check our website for details on how to book your complimentary session! We'd love to show you around.";
    }

    // --- Default / Fallback response ---
    return "I'm sorry, I couldn't quite understand that. 🤔 I'm continuously learning! Perhaps you could try rephrasing your question, or ask me about our **membership plans**, **timings**, **location**, **expert trainers**, **services**, or **how to contact us**.";
  }, [messages.length]); // Added messages.length to dependencies to update welcome message logic

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue('');

    // Simulate bot typing/processing time
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getResponse(userMessage.text),
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, botResponse]);
    }, 700);
  }, [inputValue, getResponse]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    // Main container for the chatbot component
    <div className="fixed bottom-6 right-6 z-[100] font-heading"> {/* Changed font-orbitron to font-heading for consistency */}
      {/* Chat Toggle Button - Neon Glow */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 neon-glow pulse-green group"
          aria-label="Open Crunch Fitness chatbot" // More descriptive aria-label
          aria-expanded={isOpen} // Indicates whether the chatbot is open
        >
          <MessageCircle size={30} className="relative z-10" />
        </button>
      )}

      {/* Chat Window - Glassmorphism and better styling */}
      {isOpen && (
        <div 
          className="glass-morphism rounded-xl shadow-2xl w-80 md:w-96 h-[480px] flex flex-col border border-border overflow-hidden
            transform scale-95 opacity-0 animate-fade-in animate-slide-in-up transition-all duration-300 ease-out"
          style={{ animationFillMode: 'forwards' }}
          role="dialog" // Indicates that this is a dialog window
          aria-modal="true" // Indicates that the dialog is modal (focus is trapped within it)
          aria-labelledby="chatbot-header" // Links to the header of the chatbot for accessibility
        >
          {/* Header - Electric Gradient with Pulse */}
          <div className="relative electric-gradient text-white p-4 rounded-t-xl flex items-center justify-between shadow-md overflow-hidden">
            <div className="absolute inset-0 bg-green-400/5 blur-3xl animate-pulse-slow z-0"></div>
            <div className="relative z-10 flex items-center">
              {/* Optional: Add your gym logo icon here */}
              {/* <img src="/logo-icon.png" alt="Logo" className="h-8 w-8 mr-3" /> */}
              <div>
                <h3 id="chatbot-header" className="font-semibold font-heading text-lg">Crunch Fitness AI</h3> {/* Used font-heading and added id for aria-labelledby */}
                <p className="text-xs opacity-90 font-body">Virtual Assistant</p> {/* Used font-body */}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="relative z-10 p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close chatbot"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Container - Now with `hide-scrollbar` class for complete scrollbar removal */}
          <div 
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-transparent hide-scrollbar"
            role="log" // Indicates that this is a live region that displays new messages
            aria-live="polite" // Announces new content politely (when appropriate)
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                aria-label={message.isBot ? `Bot message: ${message.text}` : `Your message: ${message.text}`} // Added aria-label for each message
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-xl text-base shadow-lg ${
                    message.isBot
                      ? 'bg-card text-foreground rounded-bl-none animate-fade-in animate-slide-in-left'
                      : 'bg-primary text-white rounded-br-none animate-fade-in animate-slide-in-right'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-body">{message.text}</p> {/* Used font-body */}
                  <p className={`text-xs mt-1 text-right ${
                    message.isBot ? 'text-muted-foreground' : 'text-green-100'
                  }`}>
                    <time dateTime={message.timestamp.toISOString()}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time> {/* Used <time> for semantics */}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 bg-background border border-border text-foreground rounded-full
                  focus:outline-none focus:ring-2 focus:ring-primary text-sm font-body placeholder-muted-foreground" 
                aria-label="Type your message" // More descriptive aria-label
              />
              <button
                onClick={handleSendMessage}
                className="bg-primary hover:bg-green-700 text-white p-3 rounded-full transition-colors neon-glow"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;