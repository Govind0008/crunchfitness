import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, User, Bot, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  confidence?: number;
  intent?: string;
}

interface ConversationContext {
  lastIntent: string;
  userGoals: string[];
  mentionedServices: string[];
  preferredTrainers: string[];
  currentTopic: string;
  conversationFlow: string[];
}

const EnhancedChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "🌟 Welcome to Crunch Fitness! I'm your AI-powered fitness companion. I understand natural conversation and can help with anything from workout plans to nutrition advice. What's on your mind today?",
      isBot: true,
      timestamp: new Date(),
      confidence: 1.0,
      intent: 'greeting'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [context, setContext] = useState<ConversationContext>({
    lastIntent: 'greeting',
    userGoals: [],
    mentionedServices: [],
    preferredTrainers: [],
    currentTopic: 'general',
    conversationFlow: ['greeting']
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Enhanced gym data with accurate pricing and real trainer information
  const gymData = {
    membership: {
      daily: {
        price: '₹300',
        name: 'Daily Pass',
        duration: '1 Day',
        benefits: ['Full gym access for one day', 'All equipment usage', 'Trial experience'],
        idealFor: 'first-time visitors, travelers, trial sessions'
      },
      monthly: {
        price: '₹3,000',
        name: '1 Month Plan',
        duration: '1 Month',
        benefits: ['Complete gym access', 'All equipment usage', 'Locker facility', 'Basic guidance'],
        idealFor: 'short-term goals, trying out the gym'
      },
      quarterly: {
        price: '₹6,500',
        name: '3 Month Plan',
        duration: '3 Months',
        benefits: ['Complete gym access', 'All equipment usage', 'Locker facility', 'Trainer consultation', 'Progress tracking'],
        idealFor: 'fitness beginners, seasonal training',
        savings: 'Save ₹2,500 vs monthly'
      },
      halfYearly: {
        price: '₹8,000',
        name: '6 Month Plan',
        duration: '6 Months',
        benefits: ['Complete gym access', 'All equipment usage', 'Locker facility', 'Regular trainer consultation', 'Diet guidance', 'Progress tracking'],
        idealFor: 'serious fitness goals, body transformation',
        savings: 'Save ₹10,000 vs monthly'
      },
      yearly: {
        price: '₹12,000',
        name: '12 Month Plan',
        duration: '12 Months',
        benefits: ['Complete gym access', 'All equipment usage', 'Premium locker facility', 'Personal training sessions', 'Complete diet planning', 'Progress tracking', 'Priority support'],
        idealFor: 'long-term fitness commitment, maximum savings',
        savings: 'Save ₹24,000 vs monthly - Best Value!'
      }
    },
    timings: {
      weekdays: '6:00 AM - 10:00 PM',
      saturday: '6:00 AM - 10:00 PM',
      sunday: '6:00 AM - 12:00 PM (Noon)',
      peakHours: '6:00 AM - 9:00 AM, 6:00 PM - 9:00 PM',
      offPeakHours: '9:00 AM - 6:00 PM'
    },
    location: {
      area: 'Wakad, Pune',
      fullAddress: 'Pink City Road, Wakad, Pune - 411057',
      landmarks: 'Near Phoenix MarketCity, opposite KPIT',
      parking: 'Free parking available'
    },
    contact: {
      phone: '+91-8483048363',
      email: 'Crunchfitness680@gmail.com',
      website: 'https://www.crunchfitness.fitness/',
      whatsapp: '+91-9762904097'
    },
    trainers: [
      {
        name: 'Nilima Patil',
        title: 'Founder & Head Trainer',
        specializations: ['Holistic Fitness', 'Business Strategy', 'Overall Wellness', 'Leadership Training'],
        certifications: ['Certified Fitness Professional', 'Business Management', 'Holistic Health Coach'],
        bio: "The visionary behind Crunch Fitness, Nilima leads with a passion for transforming lives through sustainable fitness and a community-driven approach.",
        experience: '10+ years',
        availability: 'Available for consultations by appointment',
        personalityTraits: ['visionary', 'passionate', 'community-focused'],
        successStories: 'Founded and built Crunch Fitness from ground up, transformed thousands of lives',
        isOwner: true
      },
      {
        name: 'Gaurav Dhawale',
        title: 'Gym Manager & Operations Head',
        specializations: ['Client Relations', 'Facility Management', 'Operations', 'Member Support'],
        certifications: ['Gym Management Certified', 'Operations Excellence', 'Customer Relations'],
        bio: "Gaurav ensures the smooth operation of Crunch Fitness, focusing on member satisfaction and optimizing the gym environment for everyone.",
        experience: '7+ years',
        availability: 'Monday-Sunday during gym hours',
        personalityTraits: ['organized', 'supportive', 'efficient'],
        successStories: 'Maintains 95% member satisfaction rate, streamlined gym operations'
      },
      {
        name: 'Vikas Jadhav',
        title: 'Fitness Consultant & Advisor',
        specializations: ['Program Development', 'Strategic Planning', 'Fitness Consulting', 'Training Design'],
        certifications: ['Fitness Program Designer', 'Strategic Planning', 'Advanced Training Methods'],
        bio: "With vast experience in the fitness industry, Vikas provides expert consultation, shaping innovative training programs and growth strategies for the gym.",
        experience: '3+ years',
        availability: 'Available for program consultations',
        personalityTraits: ['strategic', 'innovative', 'analytical'],
        successStories: 'Designed 50+ custom training programs, improved member results by 40%'
      },
      {
        name: 'Sheetal Sutar',
        title: 'Fitness Consultant & Advisor',
        specializations: ['Program Development', 'Strategic Planning', 'Women\'s Fitness', 'Lifestyle Coaching'],
        certifications: ['Advanced Fitness Consultant', 'Women\'s Health Specialist', 'Lifestyle Coach'],
        bio: "With vast experience in the fitness industry, Sheetal provides expert consultation, shaping innovative training programs and growth strategies for the gym.",
        experience: '7+ years',
        availability: 'Available for consultations and program design',
        personalityTraits: ['experienced', 'strategic', 'dedicated'],
        successStories: 'Specialized in women\'s fitness, helped 200+ women achieve their goals'
      },
      {
        name: 'Rushikesh Zurange',
        title: 'Strength & Conditioning Coach',
        specializations: ['Weight Training', 'Functional Fitness', 'Strength Building', 'Athletic Performance'],
        certifications: ['Strength & Conditioning Specialist', 'Functional Training Expert', 'Athletic Performance Coach'],
        bio: "Passionate about building strength and resilience, Rushikesh designs personalized programs that push boundaries and deliver tangible results.",
        experience: '5+ years',
        availability: 'Monday-Saturday morning and evening slots',
        personalityTraits: ['intense', 'results-driven', 'technical'],
        successStories: 'Helped clients increase strength by 150% on average, trained competitive athletes'
      },
      {
        name: 'Gaurav Gaikwad',
        title: 'Certified Personal Trainer',
        specializations: ['Fat Loss', 'Muscle Gain', 'Endurance Training', 'Body Transformation'],
        certifications: ['Certified Personal Trainer', 'Nutrition Specialist', 'Body Transformation Expert'],
        bio: "Dedicated to guiding clients through effective training journeys, Gaurav focuses on sustainable progress and holistic well-being.",
        experience: '5+ years',
        availability: 'All days, flexible timing',
        personalityTraits: ['dedicated', 'holistic', 'motivational'],
        successStories: 'Achieved 85% success rate in body transformation goals'
      },
      {
        name: 'Arjun Kamble',
        title: 'CrossFit & HIIT Specialist',
        specializations: ['CrossFit', 'HIIT', 'Athletic Performance', 'High-Intensity Training'],
        certifications: ['CrossFit Level 2', 'HIIT Specialist', 'Athletic Performance Coach'],
        bio: "Arjun brings high energy to every session, specializing in CrossFit and HIIT to help members unlock their peak physical potential.",
        experience: '10+ years',
        availability: 'Early morning and evening CrossFit sessions',
        personalityTraits: ['high-energy', 'challenging', 'peak-performance-focused'],
        successStories: 'Coached 500+ members in CrossFit, improved athletic performance across all levels'
      },
      {
        name: 'Rohit Pote',
        title: 'Nutrition & Lifestyle Coach',
        specializations: ['Diet Planning', 'Weight Management', 'Lifestyle Coaching', 'Nutritional Guidance'],
        certifications: ['Certified Nutritionist', 'Weight Management Specialist', 'Lifestyle Coach'],
        bio: "Rohit empowers clients with balanced nutrition strategies, ensuring their diet complements their training for optimal health and fitness.",
        experience: '8+ years',
        availability: 'Available for nutrition consultations all days',
        personalityTraits: ['knowledgeable', 'balanced', 'health-focused'],
        successStories: 'Helped 300+ clients achieve sustainable weight management through proper nutrition'
      },
      {
        name: 'Rahul Sahu',
        title: 'Functional Training Expert',
        specializations: ['Mobility', 'Core Strength', 'Injury Prevention', 'Functional Movement'],
        certifications: ['Functional Training Specialist', 'Mobility Expert', 'Injury Prevention Certified'],
        bio: "Rahul specializes in enhancing body movement and stability through functional training, helping members move better and prevent injuries.",
        experience: '5+ years',
        availability: 'Available for functional training and mobility sessions',
        personalityTraits: ['movement-focused', 'preventive', 'technical'],
        successStories: 'Reduced injury rates by 60% among his clients, improved mobility for 400+ members'
      },
      {
        name: 'Rahul Saware',
        title: 'Bodybuilding Coach',
        specializations: ['Hypertrophy', 'Advanced Lifting Techniques', 'Bodybuilding', 'Contest Prep'],
        certifications: ['Professional Bodybuilding Coach', 'Advanced Lifting Techniques', 'Contest Preparation'],
        bio: "A dedicated bodybuilding coach, Rahul guides clients through progressive overload and precise techniques to maximize muscle growth and definition.",
        experience: '5+ years',
        availability: 'Specialized bodybuilding sessions by appointment',
        personalityTraits: ['precise', 'dedicated', 'detail-oriented'],
        successStories: 'Prepared 20+ clients for bodybuilding competitions, achieved 90% success rate'
      },
      {
        name: 'Swapnil Bhile',
        title: 'Personal Trainer & Motivator',
        specializations: ['General Fitness', 'Client Motivation', 'Beginner Training', 'Fitness Fundamentals'],
        certifications: ['Certified Personal Trainer', 'Motivational Coaching', 'Beginner Specialist'],
        bio: "Swapnil is passionate about inspiring individuals to embark on their fitness journeys, providing constant motivation and adaptable training plans.",
        experience: '2+ years',
        availability: 'Perfect for beginners, available all days',
        personalityTraits: ['motivational', 'inspiring', 'beginner-friendly'],
        successStories: 'Successfully onboarded 150+ fitness beginners, 95% member retention rate'
      },
      {
        name: 'Pooja Bansode',
        title: 'Ladies Fitness Specialist',
        specializations: ['Women\'s Health', 'Pre/Post Natal Fitness', 'Yoga', 'Female-specific Training'],
        certifications: ['Women\'s Health Specialist', 'Pre/Post Natal Certified', 'Yoga Instructor'],
        bio: "Pooja empowers women through specialized fitness programs, focusing on their unique health needs and promoting confidence and strength.",
        experience: '3+ years',
        availability: 'Ladies-only sessions and women\'s health consultations',
        personalityTraits: ['empowering', 'understanding', 'confidence-building'],
        successStories: 'Specialized women\'s programs, helped 100+ women through different life stages'
      }
    ],
    services: [
      { 
        name: 'Zumba Classes', 
        description: 'High-energy dance fitness combining Latin rhythms with cardio movements',
        schedule: 'Mon, Wed, Fri - 7PM | Sat - 10AM',
        duration: '45 minutes',
        calories: '400-600 burned per session',
        keywords: ['zumba', 'dance', 'cardio', 'fun', 'latin', 'music']
      },
      { 
        name: 'CrossFit Training', 
        description: 'Varied functional movements at high intensity for total body conditioning',
        schedule: 'Daily - 6AM, 7AM, 6PM, 7PM',
        duration: '60 minutes',
        calories: '500-800 burned per session',
        keywords: ['crossfit', 'hiit', 'functional', 'wod', 'intense', 'strength']
      },
      { 
        name: 'Weight Training', 
        description: 'Systematic strength building with progressive overload principles',
        schedule: 'Personal sessions available all operating hours',
        duration: '45-90 minutes',
        calories: '300-500 burned per session',
        keywords: ['weight', 'strength', 'muscle', 'gym equipment', 'lifting', 'gains']
      },
      { 
        name: 'Yoga & Pilates', 
        description: 'Mind-body practices for flexibility, core strength, and mental wellness',
        schedule: 'Yoga: Daily 7AM, 6:30PM | Pilates: Tue, Thu, Sat 8AM',
        duration: '60-75 minutes',
        calories: '200-400 burned per session',
        keywords: ['yoga', 'pilates', 'flexibility', 'mindfulness', 'core', 'balance']
      },
      { 
        name: 'Personal Training', 
        description: 'One-on-one customized training with certified professionals',
        schedule: 'Available by appointment',
        duration: '45-60 minutes',
        calories: '400-700 burned per session',
        keywords: ['personal training', 'one-on-one', 'custom workout', 'trainer', 'individual']
      },
      { 
        name: 'Nutrition Consultation', 
        description: 'Personalized meal planning and dietary guidance for optimal results',
        schedule: 'Available by appointment',
        duration: '30-60 minutes',
        keywords: ['nutrition', 'diet', 'meal plan', 'eating', 'food', 'weight loss', 'healthy']
      }
    ],
    workoutPlans: {
      beginner: {
        name: 'Fitness Foundation',
        duration: '4-6 weeks',
        frequency: '3-4 times per week',
        focus: 'Building basic strength and cardio endurance',
        exercises: ['bodyweight squats', 'push-ups', 'planks', 'walking', 'basic machines']
      },
      intermediate: {
        name: 'Strength Builder',
        duration: '8-12 weeks',
        frequency: '4-5 times per week',
        focus: 'Progressive strength training and cardio improvement',
        exercises: ['compound lifts', 'free weights', 'circuit training', 'running', 'group classes']
      },
      advanced: {
        name: 'Peak Performance',
        duration: '12+ weeks',
        frequency: '5-6 times per week',
        focus: 'Specialized training for specific goals',
        exercises: ['olympic lifts', 'plyometrics', 'sport-specific training', 'advanced techniques']
      }
    }
  };

  // Enhanced NLP for intent recognition
  const analyzeIntent = useCallback((input: string): { intent: string; confidence: number; entities: string[] } => {
    const lowercaseInput = input.toLowerCase();
    const entities: string[] = [];
    
    // Intent patterns with confidence scoring
    const intentPatterns = {
      greeting: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon', 'namaste', 'start', 'hii', 'helo'],
        confidence: 0.9
      },
      membership: {
        patterns: ['membership', 'plan', 'price', 'cost', 'sign up', 'join', 'fee', 'subscription', 'how much', 'rate', 'charge', 'enroll', 'register', 'cheap', 'affordable', 'best plan', 'recommend plan', 'daily pass', 'monthly', 'quarterly', 'annual', 'yearly', '1 month', '3 month', '6 month', '12 month', 'trial'],
        confidence: 0.9
      },
      location: {
        patterns: ['location', 'where', 'address', 'find', 'wakad', 'pune', 'direction', 'map', 'reach', 'how to come', 'parking', 'landmark', 'nearby', 'situated'],
        confidence: 0.9
      },
      timings: {
        patterns: ['time', 'open', 'hour', 'schedule', 'when', 'timing', 'close', 'opening', 'closing', 'weekday', 'weekend', 'sunday', 'saturday', 'today', 'busy', 'crowded', 'peak'],
        confidence: 0.9
      },
      trainers: {
        patterns: ['trainer', 'coach', 'instructor', 'personal training', 'pt', 'trainer available', 'meet trainer', 'who trains', 'staff', 'nilima', 'gaurav', 'vikas', 'sheetal', 'rushikesh', 'arjun', 'rohit', 'rahul', 'swapnil', 'pooja'],
        confidence: 0.8
      },
      services: {
        patterns: ['class', 'service', 'zumba', 'crossfit', 'yoga', 'pilates', 'hiit', 'cardio', 'group class', 'activities', 'programs', 'what do you offer', 'facilities'],
        confidence: 0.8
      },
      nutrition: {
        patterns: ['diet', 'nutrition', 'food', 'meal', 'eating', 'calories', 'protein', 'supplement', 'weight loss diet', 'what to eat', 'meal plan', 'macro', 'fat loss diet', 'bulk', 'cut', 'healthy eating'],
        confidence: 0.8
      },
      workout_plan: {
        patterns: ['workout plan', 'exercise routine', 'training program', 'fitness plan', 'routine', 'beginner workout', 'how to start', 'gym routine', 'weekly plan', 'split', 'push pull', 'full body'],
        confidence: 0.8
      },
      equipment: {
        patterns: ['equipment', 'machine', 'weights', 'dumbbells', 'treadmill', 'gym gear', 'barbell', 'bench press', 'cable', 'squat rack', 'powerlifting', 'free weights', 'cardio machine', 'facilities available'],
        confidence: 0.8
      },
      contact: {
        patterns: ['contact', 'phone', 'call', 'email', 'website', 'reach', 'talk', 'whatsapp', 'number', 'message us', 'enquiry', 'inquiry', 'connect'],
        confidence: 0.9
      },
      help: {
        patterns: ['help', 'assist', 'support', 'what can you do', 'guide', 'what can you help', 'capabilities', 'options', 'menu'],
        confidence: 0.9
      },
      goals: {
        patterns: ['goal', 'target', 'achieve', 'want to', 'lose weight', 'gain muscle', 'get fit', 'transform', 'fat loss', 'build muscle', 'weight gain', 'slim', 'toned', 'six pack', 'stamina', 'strength', 'endurance', 'flexible', 'beginner', 'new to gym', 'first time'],
        confidence: 0.8
      }
    };

    // Find matching intent
    let bestIntent = 'general';
    let bestConfidence = 0.3;

    for (const [intent, data] of Object.entries(intentPatterns)) {
      const matches = data.patterns.filter(pattern => lowercaseInput.includes(pattern));
      if (matches.length > 0) {
        const confidence = Math.min(data.confidence + (matches.length - 1) * 0.1, 1.0);
        if (confidence > bestConfidence) {
          bestIntent = intent;
          bestConfidence = confidence;
          entities.push(...matches);
        }
      }
    }

    // Extract specific entities
    gymData.trainers.forEach(trainer => {
      if (lowercaseInput.includes(trainer.name.toLowerCase())) {
        entities.push(trainer.name);
      }
    });

    gymData.services.forEach(service => {
      if (service.keywords?.some(keyword => lowercaseInput.includes(keyword))) {
        entities.push(service.name);
      }
    });

    return { intent: bestIntent, confidence: bestConfidence, entities };
  }, []);

  // Context-aware response generation
  const generateResponse = useCallback((input: string, analysis: { intent: string; confidence: number; entities: string[] }): string => {
    const { intent, entities } = analysis;
    
    // Update context
    setContext(prev => ({
      ...prev,
      lastIntent: intent,
      currentTopic: intent,
      conversationFlow: [...prev.conversationFlow, intent].slice(-5)
    }));

    // Response generators by intent
    const responseGenerators = {
      greeting: () => {
        const greetings = [
          "Hello! 💪 Ready to crush your fitness goals today? I'm here to help with anything from workout plans to nutrition advice!",
          "Hey there! 🌟 Welcome to Crunch Fitness! Whether you're a beginner or a pro, I've got you covered. What brings you here today?",
          "Hi! 🔥 Your personal AI fitness coach is ready! From memberships to meal plans, I can help with everything. What's your fitness question?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
      },

      membership: () => {
        if (entities.some(e => ['daily', 'day', 'trial', 'one day'].some(term => e.includes(term)))) {
          return `Our **Daily Pass** (${gymData.membership.daily.price}) is perfect for ${gymData.membership.daily.idealFor}! 

**What you get:**
• ${gymData.membership.daily.benefits.join('\n• ')}

Great for trying us out before committing to a longer plan! Ready to experience Crunch Fitness?`;
        }
        
        if (entities.some(e => ['monthly', '1 month', 'month'].some(term => e.includes(term)))) {
          return `Our **1 Month Plan** (${gymData.membership.monthly.price}) is ideal for ${gymData.membership.monthly.idealFor}! 

**Benefits include:**
• ${gymData.membership.monthly.benefits.join('\n• ')}

Perfect for short-term goals or getting started with us!`;
        }
        
        if (entities.some(e => ['quarterly', '3 month', 'three month'].some(term => e.includes(term)))) {
          return `Our **3 Month Plan** (${gymData.membership.quarterly.price}) is great for ${gymData.membership.quarterly.idealFor}! 

**Benefits include:**
• ${gymData.membership.quarterly.benefits.join('\n• ')}

💰 **${gymData.membership.quarterly.savings}** compared to monthly plans!`;
        }
        
        if (entities.some(e => ['6 month', 'six month', 'half year'].some(term => e.includes(term)))) {
          return `Our **6 Month Plan** (${gymData.membership.halfYearly.price}) is perfect for ${gymData.membership.halfYearly.idealFor}! 

**Benefits include:**
• ${gymData.membership.halfYearly.benefits.join('\n• ')}

💰 **${gymData.membership.halfYearly.savings}** - Great value for serious fitness goals!`;
        }
        
        if (entities.some(e => ['yearly', '12 month', 'annual', 'year'].some(term => e.includes(term)))) {
          return `Our **12 Month Plan** (${gymData.membership.yearly.price}) offers the ${gymData.membership.yearly.savings}

**Premium benefits include:**
• ${gymData.membership.yearly.benefits.join('\n• ')}

This is our most popular plan for serious fitness enthusiasts!`;
        }
        
        return `💪 **Crunch Fitness Membership Plans:**

🏃 **Daily Pass - ${gymData.membership.daily.price}**
Perfect for: ${gymData.membership.daily.idealFor}

📅 **1 Month - ${gymData.membership.monthly.price}**
Perfect for: ${gymData.membership.monthly.idealFor}

⭐ **3 Months - ${gymData.membership.quarterly.price}** 
Perfect for: ${gymData.membership.quarterly.idealFor}
${gymData.membership.quarterly.savings}

🔥 **6 Months - ${gymData.membership.halfYearly.price}**
Perfect for: ${gymData.membership.halfYearly.idealFor}
${gymData.membership.halfYearly.savings}

🏆 **12 Months - ${gymData.membership.yearly.price}** *Most Popular*
Perfect for: ${gymData.membership.yearly.idealFor}
${gymData.membership.yearly.savings}

Which duration fits your fitness goals? I can provide detailed benefits for any plan!`;
      },

      location: () => {
        return `📍 **Find Us Here:**
${gymData.location.fullAddress}

🗺️ **Landmarks:** ${gymData.location.landmarks}
🚗 **Parking:** ${gymData.location.parking}

We're easily accessible and in the heart of Wakad! Need directions or want to know about nearby amenities?`;
      },

      timings: () => {
        const now = new Date();
        const currentHour = now.getHours();
        const day = now.getDay(); // 0=Sun, 6=Sat

        let currentStatus = '';
        if (day === 0) {
          // Sunday: 6 AM – 12 PM (Noon)
          currentStatus = (currentHour >= 6 && currentHour < 12) ? '🟢 **Currently OPEN**' : '🔴 **Currently CLOSED**';
        } else if (day === 6) {
          // Saturday: 6 AM – 10 PM
          currentStatus = (currentHour >= 6 && currentHour < 22) ? '🟢 **Currently OPEN**' : '🔴 **Currently CLOSED**';
        } else {
          // Mon–Fri: 6 AM – 10 PM
          currentStatus = (currentHour >= 6 && currentHour < 22) ? '🟢 **Currently OPEN**' : '🔴 **Currently CLOSED**';
        }

        return `⏰ **Gym Timings:**

**Mon – Fri:** ${gymData.timings.weekdays}
**Saturday:** ${gymData.timings.saturday}
**Sunday:** ${gymData.timings.sunday}

${currentStatus}

**💡 Pro Tip:**
• **Peak Hours:** ${gymData.timings.peakHours} (busier)
• **Off-Peak:** ${gymData.timings.offPeakHours} (less crowded)

Perfect for early birds and night owls! When do you prefer to work out?`;
      },

      trainers: () => {
        // If specific trainer mentioned
        const mentionedTrainer = gymData.trainers.find(trainer => 
          entities.some(entity => trainer.name.toLowerCase().includes(entity.toLowerCase()))
        );
        
        if (mentionedTrainer) {
          return `🏋️ **Meet ${mentionedTrainer.name} - ${mentionedTrainer.title}**

**Specializations:** ${mentionedTrainer.specializations.join(', ')}
**Experience:** ${mentionedTrainer.experience}
**Certifications:** ${mentionedTrainer.certifications.join(', ')}

**About:** ${mentionedTrainer.bio}

**Success Story:** ${mentionedTrainer.successStories}
**Available:** ${mentionedTrainer.availability}

Would you like to book a consultation with ${mentionedTrainer.name}?`;
        }

        // If specific specialization mentioned
        const specializations = ['strength', 'nutrition', 'yoga', 'crossfit', 'weight loss', 'muscle gain'];
        const mentionedSpec = specializations.find(spec => 
          input.toLowerCase().includes(spec) || entities.some(e => e.includes(spec))
        );

        if (mentionedSpec) {
          const matchingTrainers = gymData.trainers.filter(trainer => 
            trainer.specializations.some(s => s.toLowerCase().includes(mentionedSpec))
          );
          
          if (matchingTrainers.length > 0) {
            return `🎯 **Perfect Match for ${mentionedSpec.charAt(0).toUpperCase() + mentionedSpec.slice(1)}:**

${matchingTrainers.map(trainer => 
              `**${trainer.name}** - ${trainer.title}
• Specializes in: ${trainer.specializations.filter(s => s.toLowerCase().includes(mentionedSpec)).join(', ')}
• ${trainer.successStories}`
            ).join('\n\n')}

Which trainer interests you most? I can share more details!`;
          }
        }

        return `👥 **Meet Our Expert Training Team:**

${gymData.trainers.map((trainer) =>
          `**${trainer.name}** - ${trainer.title}
🎯 ${trainer.specializations.slice(0, 3).join(', ')}
⭐ ${trainer.successStories}
${trainer.personalityTraits.map(trait => `#${trait}`).join(' ')}`
        ).join('\n\n')}

Tell me about your fitness goals - I'll recommend the perfect trainer for you!`;
      },

      services: () => {
        // If specific service mentioned
        const mentionedService = gymData.services.find(service => 
          entities.some(entity => service.keywords?.some(keyword => entity.includes(keyword)))
        );

        if (mentionedService) {
          return `🔥 **${mentionedService.name}**

${mentionedService.description}

📅 **Schedule:** ${mentionedService.schedule}
⏱️ **Duration:** ${mentionedService.duration}
🔥 **Calories Burned:** ${mentionedService.calories}

All classes are available to active Crunch Fitness members. Want to try a session or learn about our membership plans?`;
        }

        return `💪 **Our Amazing Services & Classes:**

${gymData.services.map(service => 
          `**${service.name}**
${service.description}
📅 ${service.schedule} | 🔥 ${service.calories}`
        ).join('\n\n')}

Which class excites you most? I can share detailed schedules and help you get started!`;
      },

      nutrition: () => {
        const rohit = gymData.trainers.find(t => t.name === 'Rohit Pote')!;
        return `🥗 **Nutrition is 70% of your fitness journey!**

Proper diet amplifies your gym results significantly. At Crunch Fitness we offer:
• Personalized meal plans tailored to your goals
• Macro counting & calorie guidance
• Supplement recommendations
• Pre/post-workout nutrition advice
• Weight loss & muscle gain diet planning

**Meet ${rohit.name} — ${rohit.title}**
🎯 Specializes in: ${rohit.specializations.join(', ')}
⭐ Experience: ${rohit.experience}
💡 ${rohit.bio}
✅ ${rohit.successStories}
📅 ${rohit.availability}

Whether your goal is fat loss, muscle gain, or overall health — the right nutrition plan makes all the difference. Ask me about specific diet tips or book a consultation!`;
      },

      workout_plan: () => {
        const plans = Object.entries(gymData.workoutPlans);
        return `🏋️ **Customized Workout Plans for Every Level:**

${plans.map(([level, plan]) => 
          `**${plan.name} (${level.charAt(0).toUpperCase() + level.slice(1)})**
⏰ Duration: ${plan.duration}
📅 Frequency: ${plan.frequency}
🎯 Focus: ${plan.focus}
💪 Key Exercises: ${plan.exercises.join(', ')}`
        ).join('\n\n')}

Tell me about your current fitness level and goals - I'll recommend the perfect program and match you with the right trainer!`;
      },

      equipment: () => {
        const lowInput = input.toLowerCase();

        if (lowInput.includes('powerlifting') || lowInput.includes('squat rack') || lowInput.includes('barbell') || lowInput.includes('deadlift')) {
          return `🏆 **Powerlifting Area — Our Crown Jewel:**

Most members don't know we have a **dedicated competition-grade powerlifting zone!**

**What's inside:**
• 🏋️ Olympic barbells & calibrated plates
• 🔲 Competition-standard squat racks
• 🔩 Deadlift platform with proper flooring
• ⚖️ Bench press stations

**Expert coaching available:**
👨‍💼 **Rushikesh Zurange** — Strength & Powerlifting Coach | 7+ years
👨‍💼 **Rahul Saware** — Bodybuilding Coach | 5+ years

Whether you're prepping for a competition or just want to lift heavy, this area was made for you. Want to schedule a walkthrough?`;
        }

        if (lowInput.includes('treadmill') || lowInput.includes('cardio machine') || lowInput.includes('cycle') || lowInput.includes('elliptical')) {
          return `🏃 **Cardio Equipment Zone:**

Our modern cardio section is packed with:
• 🏃 Treadmills (commercial-grade with incline & speed control)
• 🚴 Stationary bikes & spin bikes
• ⚡ Elliptical cross-trainers
• 🔄 Rowing machines
• 📺 Entertainment screens on most machines

**Pro Tip from our trainers:** Combine 20–30 mins cardio with strength training for maximum fat loss results!

Best for: Weight loss, stamina building, warm-up & cool-down. Want a recommended cardio routine?`;
        }

        if (lowInput.includes('dumbbell') || lowInput.includes('free weight') || lowInput.includes('bench')) {
          return `💪 **Free Weights & Strength Zone:**

Our free weights area includes:
• 🏋️ Dumbbells: 2.5kg to 50kg range
• 🔩 Barbells & EZ curl bars
• 🛏️ Flat, incline & decline benches
• 🔧 Weight plates (rubber & iron)

**Space & Safety:**
Spacious layout with proper mirror coverage for form checks. Rubber flooring to protect equipment and your joints.

**Perfect for:** Compound lifts, isolation exercises, progressive overload training.

Want a free weights workout plan? Tell me your goal!`;
        }

        return `🏋️ **Our World-Class Equipment & Facilities:**

**Cardio Zone:**
• Commercial treadmills, bikes, ellipticals & rowers
• Entertainment displays on key machines

**Free Weights Area:**
• Dumbbells: 2.5kg–50kg | Barbells | EZ bars
• Flat, incline, decline benches

**Strength & Cable Machines:**
• Full cable pulley systems (lat pulldown, seated row, etc.)
• Chest press, leg press, leg curl/extension
• Shoulder press & functional trainers

**🏆 Exclusive Powerlifting Zone:**
• Olympic squat racks & deadlift platforms
• Calibrated competition plates & barbells
• (A hidden gem — most gyms don't have this!)

**Group Fitness Studio:**
• Dedicated space for Zumba, Yoga & CrossFit

Ask me about a specific piece of equipment or tell me your goal and I'll show you exactly what to use!`;
      },

      goals: () => {
        const lowInput = input.toLowerCase();
        const rohit     = gymData.trainers.find(t => t.name === 'Rohit Pote')!;
        const rushikesh = gymData.trainers.find(t => t.name === 'Rushikesh Zurange')!;
        const pooja     = gymData.trainers.find(t => t.name === 'Pooja Bansode')!;
        const rahulSahu = gymData.trainers.find(t => t.name === 'Rahul Sahu')!;

        if (lowInput.includes('weight loss') || lowInput.includes('fat loss') || lowInput.includes('slim') || lowInput.includes('lose weight')) {
          return `🔥 **Weight Loss Transformation Plan:**

**Best approach for fat loss at Crunch Fitness:**
• Zumba & HIIT classes (burn 400–800 cal/session)
• Strength training to boost metabolism
• Personalized nutrition plan by **${rohit.name}** (${rohit.experience} experience)
• Cardio equipment — treadmills, cycles, cross-trainers

**Recommended trainer: ${rohit.name}**
${rohit.bio}
✅ ${rohit.successStories}

**Best membership for weight loss:** 6 Month plan (₹8,000) — gives you enough time for a real transformation!

Ready to start? Ask me about our membership plans or contact us to book a consultation!`;
        }

        if (lowInput.includes('muscle') || lowInput.includes('bulk') || lowInput.includes('strength') || lowInput.includes('gain') || lowInput.includes('bodybuilding')) {
          return `💪 **Muscle Building & Strength Plan:**

**Best approach for muscle gain at Crunch Fitness:**
• Progressive weight training with free weights & machines
• Powerlifting area — competition-grade equipment
• Customised hypertrophy programs
• Nutrition support for bulking

**Recommended trainers:**
🏋️ **${rushikesh.name}** — ${rushikesh.title} | ${rushikesh.experience}
${rushikesh.successStories}

🥇 **Rahul Saware** — Bodybuilding Coach | 5+ years
Prepared 20+ clients for competitions, 90% success rate

**Best membership:** 6–12 Month plan for serious muscle gains!

Want to know more about strength training or meet our coaches?`;
        }

        if (lowInput.includes('beginner') || lowInput.includes('new to gym') || lowInput.includes('first time') || lowInput.includes('starting')) {
          return `🌟 **Welcome to Your Fitness Journey!**

Starting out is the most important step. Here's what we recommend for beginners:

**Week 1–2:** Gym orientation + basic equipment walkthrough
**Month 1:** Full body workout 3x/week (guided by our trainers)
**Month 2–3:** Split training + nutrition basics

**Best trainer for beginners: Swapnil Bhile**
Certified Personal Trainer & Motivator | 2+ years
Perfect for beginners — 95% member retention rate!

**Recommended start:** 3 Month plan (₹6,500) — enough time to build real habits!

Don't worry, every champion was once a beginner. Our team will guide you every step of the way. Want to book a free orientation visit?`;
        }

        if (lowInput.includes('flexible') || lowInput.includes('yoga') || lowInput.includes('mobility') || lowInput.includes('injury')) {
          return `🧘 **Flexibility, Mobility & Injury Prevention:**

**Best approach:**
• Yoga classes — Daily 7AM & 6:30PM
• Pilates — Tue, Thu, Sat 8AM
• Functional training for mobility

**Recommended trainer: ${rahulSahu.name}** — ${rahulSahu.title}
${rahulSahu.bio}
✅ ${rahulSahu.successStories}

**For ladies:** ${pooja.name} (${pooja.title}) also offers yoga & women's health programs!

Flexibility training complements all other workouts and reduces injury risk significantly. Interested in our class schedule?`;
        }

        return `🎯 **Let's Find Your Perfect Fitness Plan:**

Tell me your goal and I'll give you a full roadmap! Here's what we can help with:

🔥 **Fat Loss / Weight Loss**
→ Cardio + HIIT + Nutrition by Rohit Pote

💪 **Muscle Gain / Bodybuilding**
→ Strength training + Powerlifting area + Rushikesh / Rahul Saware

⚡ **CrossFit / Athletic Performance**
→ Daily CrossFit sessions with Arjun Kamble (10+ years)

🧘 **Flexibility / Mobility**
→ Yoga, Pilates + Rahul Sahu's functional training

👩 **Women's Fitness**
→ Ladies-only programs with Pooja Bansode

🌟 **Complete Beginner**
→ Guided start with Swapnil Bhile

Which goal resonates with you? Type it out and I'll give you a detailed plan!`;
      },

      contact: () => {
        return `📞 **Get In Touch With Us:**

**Phone:** ${gymData.contact.phone}
**WhatsApp:** ${gymData.contact.whatsapp} (Quick responses!)
**Email:** ${gymData.contact.email}
**Website:** ${gymData.contact.website}

**Visit Us:**
${gymData.location.fullAddress}

**Best Times to Call:**
• Weekdays: 9 AM - 8 PM
• Weekends: 10 AM - 6 PM

Need immediate help? WhatsApp is fastest! What would you like to discuss?`;
      },

      help: () => {
        return `🤖 **I'm Your AI Fitness Assistant - Here's How I Can Help:**

**💪 Fitness Planning:**
• Personalized workout recommendations
• Goal-specific program design
• Exercise technique guidance

**👥 Expert Matching:**
• Find the perfect trainer for your goals
• Learn about specializations and certifications

**🏋️ Gym Services:**
• Class schedules and descriptions
• Equipment availability and usage
• Membership plan comparisons

**🥗 Nutrition Guidance:**
• Meal planning basics
• Nutrition consultation booking
• Diet tips and recommendations

**📍 Practical Info:**
• Timings, location, and contact details
• Membership pricing and benefits

Just ask me anything in natural language - I understand context and remember our conversation! What interests you most?`;
      }
    };

    // Generate response based on intent
    const generator = responseGenerators[intent as keyof typeof responseGenerators];
    if (generator) {
      return generator();
    }

    // Fallback with context-aware smart suggestions
    return `I want to make sure I give you the right info! 🤔 Here's what I can help with at Crunch Fitness:

💳 **Memberships** → "What are the membership prices?"
🏋️ **Equipment** → "What equipment do you have?"
👥 **Trainers** → "Tell me about your trainers"
📅 **Classes** → "What classes are available?"
🥗 **Nutrition** → "I need a diet plan"
🎯 **Goals** → "I want to lose weight / build muscle"
⏰ **Timings** → "What are your gym timings?"
📍 **Location** → "Where are you located?"

Just type your question naturally — like "I'm a beginner, how do I start?" and I'll guide you step by step! 💪`;
  }, []);

  // Enhanced message handling with typing simulation
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
    setInputValue('');
    setIsBotTyping(true);

    // Analyze intent and generate response
    const analysis = analyzeIntent(textToSend);
    const response = generateResponse(textToSend, analysis);

    // Simulate realistic typing delay based on response length
    const typingDelay = Math.min(Math.max(response.length * 20, 1000), 4000);

    setTimeout(() => {
      setIsBotTyping(false);
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isBot: true,
        timestamp: new Date(),
        confidence: analysis.confidence,
        intent: analysis.intent
      };
      setMessages(prevMessages => [...prevMessages, botResponse]);
    }, typingDelay);
  }, [inputValue, analyzeIntent, generateResponse]);

  // Smart quick actions based on context
  const getSmartQuickActions = useCallback(() => {
    const baseActions = ["Membership Plans", "Our Trainers", "Class Schedule"];
    
    if (context.lastIntent === 'greeting') {
      return ["I want to lose weight", "Show me trainers", "Membership pricing", "Gym timings"];
    }
    if (context.lastIntent === 'membership') {
      return ["Compare all plans", "Schedule visit", "Payment options", "Trial session"];
    }
    if (context.lastIntent === 'trainers') {
      return ["Book consultation", "Trainer specializations", "Training costs", "Success stories"];
    }
    if (context.lastIntent === 'services') {
      return ["Class timings", "Book a class", "Equipment info", "Nutrition advice"];
    }
    
    return baseActions.concat(["Contact Info", "Location & Directions", "Current Offers"]);
  }, [context.lastIntent]);

  const quickActions = getSmartQuickActions();

  // Auto-scroll functionality
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // Auto-open on first visit — desktop only (skip on mobile to avoid covering the screen)
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;
    const hasVisited = sessionStorage.getItem('hasVisitedChatbot');
    if (!hasVisited) {
      setTimeout(() => setIsOpen(true), 1000);
      sessionStorage.setItem('hasVisitedChatbot', 'true');
    }
  }, []);

  // Auto-focus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleQuickActionClick = useCallback((actionText: string) => {
    handleSendMessage(actionText);
  }, [handleSendMessage]);

  const areQuickActionsVisible = inputValue.trim() === '' && !isBotTyping;

  return (
    <div className="fixed bottom-5 right-5 z-[100] sm:bottom-7 sm:right-7">

      {/* ── Toggle Button ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Coach Crunch chatbot"
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 32px rgba(16,185,129,0.45)' }}
        >
          {/* pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#10b981' }} />
          <MessageCircle size={26} className="text-white relative z-10" />
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-400 border-2 border-black rounded-full flex items-center justify-center">
            <Sparkles size={10} className="text-black" />
          </span>
        </button>
      )}

      {/* ── Chat Window ── */}
      {isOpen && (
        <div
          className="flex flex-col rounded-2xl overflow-hidden border border-gray-700/60 shadow-2xl w-[92vw] max-w-[400px]"
          style={{
            height: 'min(600px, 60vh)',
            background: 'linear-gradient(160deg, #0f0f0f 0%, #111827 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.15)',
            animation: 'chatSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chatbot-header"
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0"
            style={{ background: 'linear-gradient(90deg,#064e3b,#065f46)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <Bot size={18} className="text-green-400" />
              </div>
              <div>
                <h3 id="chatbot-header" className="font-heading font-bold text-white text-sm leading-none">Coach Crunch</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-300 text-[10px] font-body">Online • Ready to help</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Close chatbot"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#10b981 transparent' }}
            role="log"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                style={{ animation: 'msgFadeUp 0.25s ease both' }}
              >
                <div className={`flex items-end gap-2 max-w-[85%] ${message.isBot ? '' : 'flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                    message.isBot ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-700'
                  }`}>
                    {message.isBot
                      ? <Bot size={13} className="text-green-400" />
                      : <User size={13} className="text-gray-300" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm font-body leading-relaxed break-words ${
                    message.isBot
                      ? 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm'
                      : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-br-sm'
                  }`}
                    style={{ maxWidth: '100%', wordBreak: 'break-word' }}
                  >
                    <div
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: message.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      }}
                    />
                    <time
                      dateTime={message.timestamp.toISOString()}
                      className={`block text-right mt-1 text-[10px] ${message.isBot ? 'text-gray-500' : 'text-green-100/70'}`}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isBotTyping && (
              <div className="flex justify-start" style={{ animation: 'msgFadeUp 0.25s ease both' }}>
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                    <Bot size={13} className="text-green-400" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {areQuickActionsVisible && (
            <div className="px-4 pb-3 pt-2 border-t border-gray-800 flex-shrink-0">
              <p className="text-[10px] font-heading text-gray-500 uppercase tracking-wider mb-2">Quick actions</p>
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickActionClick(action)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-green-500/10 border border-gray-700 hover:border-green-500/50 text-gray-300 hover:text-green-400 rounded-full text-xs font-body transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0 bg-gray-900/50">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about memberships, trainers, timings…"
                  rows={1}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 focus:border-green-500/60 text-white placeholder-gray-500 rounded-xl text-sm font-body resize-none focus:outline-none transition-colors duration-200"
                  style={{ minHeight: '42px', maxHeight: '112px' }}
                />
                {inputValue.length > 100 && (
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-gray-600">{inputValue.length}/500</span>
                )}
              </div>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isBotTyping}
                aria-label="Send message"
                className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-600 font-body mt-2">
              Coach Crunch • Wakad, Pune
            </p>
          </div>
        </div>
      )}

      {/* keyframes — plain style tag, no jsx prop */}
      <style>{`
        @keyframes chatSlideUp {
          from { transform: translateY(24px) scale(0.96); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes msgFadeUp {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default EnhancedChatbot;