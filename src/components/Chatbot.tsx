import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface Trainer {
  name: string;
  specializations: string[];
  certifications: string[];
  bio: string;
  image?: string;
}

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
  const [isBotTyping, setIsBotTyping] = useState(false);
  // Removed showQuickActions state. Its visibility will now be derived.

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggested Quick Action buttons - these will always be available now
  const quickActions = [
    "Membership Plans",
    "Club Timings",
    "Our Location",
    "Expert Trainers",
    "Services & Classes",
    "Contact Info"
  ];

  // Scrolls to the bottom of the messages container whenever new messages arrive or bot typing state changes.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // Opens the chatbot automatically on the first visit to the site (using sessionStorage).
  useEffect(() => {
    const hasVisited = sessionStorage.getItem('hasVisitedChatbot');
    if (!hasVisited) {
      setIsOpen(true);
      sessionStorage.setItem('hasVisitedChatbot', 'true');
    }
  }, []);

  // Auto-focuses the input field when the chatbot window opens for better usability.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // --- Gym Data Structure (same as before) ---
  const gymData = {
    membership: {
      basic: { price: '₹999', name: 'Basic', benefits: ['Access to gym equipment', 'Locker room', 'Basic fitness assessment', 'Mobile app access', 'Community support'] },
      pro: { price: '₹1,499', name: 'Pro', benefits: ['Everything in Basic', 'Limited personal training sessions', 'Nutrition consultation', 'Group fitness classes', 'Premium locker', 'Guest passes'] },
      elite: { price: '₹1,999', name: 'Elite', benefits: ['Everything in Pro', 'Unlimited personal training', 'VIP locker room access', 'Massage therapy', 'Custom nutrition meal plans', 'Unlimited guest passes'] }
    },
    timings: '5 AM to 10 PM, Monday to Sunday',
    location: 'Wakad, Pune',
    contact: '+91-9876543210',
    email: 'info@crunchfitness.fit',
    website: 'https://www.crunchfitness.fit/',

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

  // Determines the bot's response based on user input.
  const getResponse = useCallback((userInput: string): string => {
    const input = userInput.toLowerCase();

    // --- Greetings & General ---
    if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
      if (messages.length <= 2) {
        return "Welcome to Crunch Fitness! 🎉 I'm your dedicated virtual assistant, ready to help you crush your fitness goals. What's on your mind today?";
      }
      return "Hey there! How can I continue helping you on your fitness journey at Crunch Fitness?";
    }
    if (input.includes('how are you')) {
      return "I'm a virtual assistant, so I don't have feelings, but I'm fully charged and ready to help you with anything about Crunch Fitness! How can I make your day more productive?";
    }
    if (input.includes('what can you do') || input.includes('help')) {
      return "I'm here to provide details about our **membership plans**, **club timings**, **location**, introduce you to our **expert trainers** and their specializations, explain our exciting **services and classes**, or tell you how to **contact us**. What sparks your interest?";
    }
    if (input.includes('thank') || input.includes('thanks') || input.includes('appreciate')) {
        return "You're most welcome! I'm always happy to help you on your fitness journey. Is there anything else I can clarify or assist you with?";
    }

    // --- Membership Pricing & Details ---
    const membershipKeywords = ['membership', 'plan', 'price', 'cost', 'sign up', 'join'];
    if (membershipKeywords.some(keyword => input.includes(keyword))) {
        if (input.includes('basic')) {
            return `Our **Basic** membership is a fantastic start at just ${gymData.membership.basic.price} per month! It gives you: ${gymData.membership.basic.benefits.join(', ')}. Ready to get started?`;
        }
        if (input.includes('pro')) {
            return `Level up with our **Pro** membership for ${gymData.membership.pro.price} per month. This popular plan includes: ${gymData.membership.pro.benefits.join(', ')}. It's perfect for those seeking more!`;
        }
        if (input.includes('elite')) {
            return `Experience the ultimate with our **Elite** membership at ${gymData.membership.elite.price} per month. It offers: ${gymData.membership.elite.benefits.join(', ')}. This is our most comprehensive package for unparalleled results!`;
        }
        return `We offer three amazing membership options designed to fit various needs and goals:
• **Basic**: ${gymData.membership.basic.price}/month
• **Pro**: ${gymData.membership.pro.price}/month
• **Elite**: ${gymData.membership.elite.price}/month
Which plan aligns best with your fitness aspirations, or would you like a detailed breakdown of a specific one?`;
    }

    // --- Location ---
    if (input.includes('location') || input.includes('where') || input.includes('address') || input.includes('find you') || input.includes('wakad') || input.includes('pune')) {
      return `Crunch Fitness Club is conveniently located in **${gymData.location}**. You can find us on Pink City Road. We're easy to get to, and there's ample parking! Do you need directions?`;
    }

    // --- Timings ---
    if (input.includes('time') || input.includes('open') || input.includes('hour') || input.includes('6 am') || input.includes('morning') || input.includes('evening')) {
      return `Great news! We're open every day, **${gymData.timings}**! So whether you're an early bird or prefer late-night workouts, we're here for you. Yes, 6 AM is definitely an option! What time works best for you?`;
    }

    // --- Trainers & Specializations ---
    const trainerKeywords = ['trainer', 'coach', 'instructor', 'expert', 'personal training'];
    if (trainerKeywords.some(keyword => input.includes(keyword))) {
        const foundTrainer = gymData.trainers.find(trainer =>
            input.includes(trainer.name.toLowerCase().replace('trainer ', '')) ||
            trainer.specializations.some(s => input.includes(s.toLowerCase()))
        );
        if (foundTrainer) {
            return `Fantastic choice! Here's more about ${foundTrainer.name}:
**Specializations**: ${foundTrainer.specializations.join(', ')}
**Certifications**: ${foundTrainer.certifications.join(', ')}
**Bio**: ${foundTrainer.bio}
Would you like to schedule a free consultation with ${foundTrainer.name} to discuss your goals?`;
        }

        if (input.includes('certified') || input.includes('best certified') || input.includes('most certified')) {
            const allCerts = [...new Set(gymData.trainers.flatMap(t => t.certifications))].join(', ');
            return `Our trainers hold a variety of esteemed certifications including: ${allCerts}. This ensures you're getting top-tier guidance! Are you looking for a trainer with a specific certification?`;
        }

        const allTrainerNames = gymData.trainers.map(t => t.name).join(', ');
        return `Our team of expert trainers, including **${allTrainerNames}**, are all highly certified and passionate about helping you achieve your goals. To help me narrow it down, what kind of training or specialization are you most interested in (e.g., weight loss, strength, yoga, nutrition)?`;
    }

    // --- Services/Classes ---
    const serviceKeywords = ['class', 'service', 'offer', 'what do you have', 'workout'];
    if (serviceKeywords.some(keyword => input.includes(keyword)) ||
        gymData.services.some(s => s.keywords?.some(k => input.includes(k)))) {

        const foundService = gymData.services.find(service =>
            input.includes(service.name.toLowerCase().replace(' classes', '').replace(' training', '')) ||
            service.keywords?.some(k => input.includes(k))
        );

        if (foundService) {
            return `You're asking about **${foundService.name}**! ${foundService.description} Many of our services, like this one, are included in our Pro and Elite memberships. Would you like to see the class schedule or learn how to join?`;
        }

        const serviceNames = gymData.services.map(s => s.name).join(', ');
        return `We offer a wide range of exciting services and classes to keep your workouts dynamic and effective! These include: **${serviceNames}**. Which one piques your interest, or would you like to see our full class schedule?`;
    }

    // --- Contact ---
    if (input.includes('contact') || input.includes('call') || input.includes('phone') || input.includes('number') || input.includes('email') || input.includes('website')) {
      let contactInfo = `You can easily reach us by phone at **${gymData.contact}** during working hours. `;
      if (input.includes('email')) {
          contactInfo += `For inquiries, feel free to email us at **${gymData.email}**. `;
      }
      if (input.includes('website') || input.includes('online')) {
          contactInfo += `And for more details, member sign-up, and online forms, visit our official website at **${gymData.website}**. `;
      }
      return contactInfo.trim() + " How would you prefer to get in touch?";
    }

    // --- Trial / First visit ---
    if (input.includes('trial') || input.includes('first visit') || input.includes('demo') || input.includes('guest pass') || input.includes('visit') || input.includes('experience')) {
      return "Absolutely! We'd love for you to experience Crunch Fitness firsthand. We offer guest passes and trial sessions. Please visit our front desk, or check the 'Join Us' section on our website for details on how to book your complimentary session! When would you like to come by?";
    }

    // --- Default / Fallback response ---
    return "I'm sorry, I couldn't quite understand that. 🤔 I'm continuously learning! Perhaps you could try rephrasing your question, or select one of the common topics below:";
  }, [messages.length]); // messages.length is in dependencies to ensure getResponse can correctly determine if it's the first interaction.

  // Handles sending a message, either from typing or a button click.
  const handleSendMessage = useCallback((messageText?: string) => {
    const textToSend = messageText || inputValue;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue(''); // Clear input only if typed, not for button clicks

    setIsBotTyping(true); // Show typing indicator

    setTimeout(() => {
      const botResponseText = getResponse(userMessage.text);
      setIsBotTyping(false); // Hide typing indicator
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponseText,
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, botResponse]);
    }, 700);
  }, [inputValue, getResponse]);

  // Handles 'Enter' key press for input field.
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handles click on quick action buttons.
  const handleQuickActionClick = useCallback((actionText: string) => {
    setInputValue(actionText); // Set input value to button text (optional, but good UX)
    handleSendMessage(actionText); // Directly send the message
  }, [handleSendMessage]);

  // Determine if quick actions should be visible:
  // They are visible if the input field is empty AND the bot is not currently typing.
  const areQuickActionsVisible = inputValue.trim() === '' && !isBotTyping;


  return (
    // Main container for the chatbot. Uses fixed positioning and responsive sizing for mobile.
    <div className="fixed bottom-4 right-4 z-[100] font-heading sm:bottom-6 sm:right-6">
      {/* Chat Toggle Button - Visible when the chat window is closed. */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 neon-glow pulse-green group"
          aria-label="Open Crunch Fitness chatbot"
          aria-expanded={isOpen}
        >
          <MessageCircle size={30} className="relative z-10" />
        </button>
      )}

      {/* Chat Window - Visible when open. Features glassmorphism effect and animations. */}
      {isOpen && (
        <div
          className="glass-morphism rounded-xl shadow-2xl w-[90vw] max-w-sm md:max-w-md h-[70vh] max-h-[500px] flex flex-col border border-border overflow-hidden
            transform scale-95 opacity-0 animate-fade-in animate-slide-in-up transition-all duration-300 ease-out"
          style={{ animationFillMode: 'forwards' }} // Ensures the animation state persists
          role="dialog" // ARIA role for a dialog window
          aria-modal="true" // Indicates that the dialog is modal
          aria-labelledby="chatbot-header" // Links to the header for accessibility
        >
          {/* Header Section - Displays bot name and close button. */}
          <div className="relative electric-gradient text-white p-4 rounded-t-xl flex items-center justify-between shadow-md overflow-hidden">
            <div className="absolute inset-0 bg-green-400/5 blur-3xl animate-pulse-slow z-0"></div> {/* Background pulse effect */}
            <div className="relative z-10 flex items-center">
              <div>
                <h3 id="chatbot-header" className="font-semibold font-heading text-lg">Crunch Fitness AI</h3>
                <p className="text-xs opacity-90 font-body">Virtual Assistant</p>
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

          {/* Messages Container - Displays conversation history, with scrollability and hidden scrollbar. */}
          <div
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-transparent hide-scrollbar"
            role="log" // ARIA role for live region
            aria-live="polite" // Announces new content politely
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                aria-label={message.isBot ? `Bot message: ${message.text}` : `Your message: ${message.text}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-xl text-base shadow-lg ${
                    message.isBot
                      ? 'bg-card text-foreground rounded-bl-none animate-fade-in animate-slide-in-left'
                      : 'bg-primary text-white rounded-br-none animate-fade-in animate-slide-in-right'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-body">{message.text}</p>
                  <p className={`text-xs mt-1 text-right ${
                    message.isBot ? 'text-muted-foreground' : 'text-green-100'
                  }`}>
                    <time dateTime={message.timestamp.toISOString()}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </p>
                </div>
              </div>
            ))}

            {/* Bot Typing Indicator */}
            {isBotTyping && (
              <div className="flex justify-start">
                <div className="bg-card text-foreground px-4 py-2 rounded-xl text-base shadow-lg rounded-bl-none animate-fade-in animate-pulse">
                  <p className="font-body">...</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} /> {/* Reference for auto-scrolling */}
          </div>

          {/* Quick Action Buttons (now conditionally rendered based on inputValue and isBotTyping) */}
          {areQuickActionsVisible && (
            <div className="p-4 border-t border-border bg-card grid grid-cols-2 gap-2 text-sm md:grid-cols-3 md:gap-3 animate-fade-in">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickActionClick(action)}
                  className="bg-transparent text-primary border border-primary-light hover:bg-primary-light/20 transition-colors px-3 py-2 rounded-full font-body text-xs md:text-sm text-center truncate"
                  aria-label={`Ask about ${action}`}
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input Area - Where the user types messages. */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex space-x-3">
              <input
                type="text"
                ref={inputRef} // Attach ref for auto-focus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 bg-background border border-border text-foreground rounded-full
                  focus:outline-none focus:ring-2 focus:ring-primary text-sm font-body placeholder-muted-foreground"
                aria-label="Type your message"
              />
              <button
                onClick={() => handleSendMessage()} // Call without argument if sending from input
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