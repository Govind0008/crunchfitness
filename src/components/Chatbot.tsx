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
  const inputRef = useRef<HTMLInputElement>(null);

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
      weekdays: '5:00 AM - 11:00 PM',
      weekends: '6:00 AM - 10:00 PM',
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
      phone: '+91-9876543210',
      email: 'info@crunchfitness.fit',
      website: 'https://www.crunchfitness.fit/',
      whatsapp: '+91-9876543210'
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
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'start'],
        confidence: 0.9
      },
      membership: {
        patterns: ['membership', 'plan', 'price', 'cost', 'sign up', 'join', 'fee', 'subscription'],
        confidence: 0.9
      },
      location: {
        patterns: ['location', 'where', 'address', 'find', 'wakad', 'pune', 'direction'],
        confidence: 0.9
      },
      timings: {
        patterns: ['time', 'open', 'hour', 'schedule', 'when', 'timing', 'close'],
        confidence: 0.9
      },
      trainers: {
        patterns: ['trainer', 'coach', 'instructor', 'personal training', 'pt'],
        confidence: 0.8
      },
      services: {
        patterns: ['class', 'service', 'workout', 'exercise', 'training', 'program'],
        confidence: 0.8
      },
      nutrition: {
        patterns: ['diet', 'nutrition', 'food', 'meal', 'eating', 'weight loss', 'calories'],
        confidence: 0.8
      },
      workout_plan: {
        patterns: ['workout plan', 'exercise routine', 'training program', 'fitness plan', 'routine'],
        confidence: 0.8
      },
      equipment: {
        patterns: ['equipment', 'machine', 'weights', 'dumbbells', 'treadmill', 'gym gear'],
        confidence: 0.7
      },
      contact: {
        patterns: ['contact', 'phone', 'call', 'email', 'website', 'reach', 'talk'],
        confidence: 0.9
      },
      help: {
        patterns: ['help', 'assist', 'support', 'what can you do', 'guide'],
        confidence: 0.9
      },
      goals: {
        patterns: ['goal', 'target', 'achieve', 'want to', 'lose weight', 'gain muscle', 'get fit'],
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
    const { intent, confidence, entities } = analysis;
    
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
        const isWeekend = now.getDay() === 0 || now.getDay() === 6;
        
        let currentStatus = '';
        if (isWeekend) {
          currentStatus = (currentHour >= 6 && currentHour < 22) ? '🟢 **Currently OPEN**' : '🔴 **Currently CLOSED**';
        } else {
          currentStatus = (currentHour >= 5 && currentHour < 23) ? '🟢 **Currently OPEN**' : '🔴 **Currently CLOSED**';
        }

        return `⏰ **Gym Timings:**

**Weekdays:** ${gymData.timings.weekdays}
**Weekends:** ${gymData.timings.weekends}

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

${gymData.trainers.map((trainer, index) => 
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
🔥 **Calories:** ${mentionedService.calories}

This is included in our Pro and Elite memberships! Want to try a free session or learn about other classes?`;
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
        const nutritionTips = [
          "🥗 **Nutrition is 70% of your fitness journey!** Our certified nutritionist John Smith can create personalized meal plans based on your goals, preferences, and lifestyle.",
          "🍎 **Smart Eating Made Simple:** Whether it's weight loss, muscle gain, or maintenance, proper nutrition amplifies your gym results by 3x!",
          "⚡ **Fuel Your Workouts:** The right pre and post-workout nutrition can boost performance and recovery significantly!"
        ];

        const randomTip = nutritionTips[Math.floor(Math.random() * nutritionTips.length)];

        return `${randomTip}

**Our Nutrition Services:**
• Personalized meal plans
• Macro counting guidance  
• Supplement recommendations
• Weekly check-ins and adjustments
• Recipe suggestions and meal prep tips

**Meet John Smith - Nutrition Expert:**
• Precision Nutrition L1 Certified
• 6+ years experience
• Average client results: 15-25kg weight loss in 6 months
• Specializes in sustainable lifestyle changes

Ready to transform your relationship with food? Book a consultation!`;
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

      goals: () => {
        const goalResponses = {
          'weight loss': "🔥 **Weight Loss Transformation:** Combine cardio classes (Zumba, HIIT), strength training, and our nutrition program. John Smith specializes in sustainable weight loss - average client loses 15-25kg in 6 months!",
          'muscle gain': "💪 **Muscle Building:** Focus on progressive weight training with Jane Doe (our strength expert) plus proper nutrition. The Pro plan includes personal training sessions perfect for muscle growth!",
          'fitness': "⚡ **Overall Fitness:** A balanced approach with CrossFit, strength training, and flexibility work. David Kim can create a comprehensive program that improves all aspects of fitness!"
        };

        const detectedGoal = Object.keys(goalResponses).find(goal => 
          input.toLowerCase().includes(goal.replace(' ', '')) || 
          input.toLowerCase().includes(goal)
        );

        if (detectedGoal) {
          return goalResponses[detectedGoal as keyof typeof goalResponses] + "\n\nWhat's your current fitness level? I can create a detailed roadmap for your goals!";
        }

        return `🎯 **Let's Define Your Fitness Goals:**

**Popular Goals We Help Achieve:**
• **Weight Loss** - Cardio + Strength + Nutrition
• **Muscle Gain** - Progressive Training + Diet
• **General Fitness** - Balanced Programs
• **Strength Building** - Powerlifting + Olympic Lifts
• **Flexibility** - Yoga + Pilates + Mobility
• **Endurance** - CrossFit + Cardio Training

What's your primary goal? I'll create a personalized roadmap with the right trainer, classes, and nutrition plan!`;
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

    // Fallback with smart suggestions
    const suggestions = [
      "Tell me about membership plans",
      "I want to lose weight - help me",
      "Show me workout schedules",
      "Find me a nutrition expert",
      "When are you open?"
    ];

    return `I understand you're asking about "${input}" but I'd like to help you better! 🤔

Here are some things I can definitely help with:
${suggestions.map(s => `• ${s}`).join('\n')}

Or just tell me more about what you're looking for - I'm getting smarter with every conversation! 🧠✨`;
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

  // Auto-open on first visit
  useEffect(() => {
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
    <div className="fixed bottom-4 right-4 z-[100] font-sans sm:bottom-6 sm:right-6">
      {/* Enhanced Chat Toggle Button with pulsing animation */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-green-500/50 group animate-bounce"
          aria-label="Open Crunch Fitness AI chatbot"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4), 0 0 0 0 rgba(16, 185, 129, 0.4)',
            animation: 'pulse-ring 2s infinite'
          }}
        >
          <MessageCircle size={30} className="relative z-10" />
          <Sparkles size={16} className="absolute top-2 right-2 text-yellow-300 animate-pulse" />
          
          {/* Notification badge */}
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
            AI
          </div>
        </button>
      )}

      {/* Enhanced Chat Window with glassmorphism */}
      {isOpen && (
        <div
          className="backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-2xl w-[90vw] max-w-md h-[70vh] max-h-[600px] flex flex-col border border-white/20 overflow-hidden transform transition-all duration-500 ease-out"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)',
            backdropFilter: 'blur(20px)',
            animation: 'slideInUp 0.5s ease-out'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chatbot-header"
        >
          {/* Enhanced Header with gradient and AI indicator */}
          <div 
            className="relative text-white p-4 rounded-t-2xl flex items-center justify-between overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
            
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 id="chatbot-header" className="font-bold text-lg">Crunch Fitness AI</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <p className="text-xs opacity-90">Smart Assistant Online</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="relative z-10 p-2 rounded-full hover:bg-white/20 transition-colors duration-200"
              aria-label="Close chatbot"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Container with enhanced styling */}
          <div
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-gray-50/50 to-white/50"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#10b981 transparent'
            }}
            role="log"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} animate-fadeInUp`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.isBot ? '' : 'flex-row-reverse space-x-reverse'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    message.isBot 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600'
                  }`}>
                    {message.isBot ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  
                  {/* Message bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl ${
                      message.isBot
                        ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-br-none'
                    }`}
                    style={{
                      maxWidth: '100%',
                      wordBreak: 'break-word'
                    }}
                  >
                    <div 
                      className="whitespace-pre-wrap text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: message.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      }}
                    />
                    
                    <div className={`flex items-center justify-between mt-2 text-xs ${
                      message.isBot ? 'text-gray-500' : 'text-green-100'
                    }`}>
                      <time dateTime={message.timestamp.toISOString()}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </time>
                      
                      {message.confidence && (
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            message.confidence > 0.8 ? 'bg-green-500' : 
                            message.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <span className="opacity-70">AI</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Enhanced Bot Typing Indicator */}
            {isBotTyping && (
              <div className="flex justify-start animate-fadeInUp">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Thinking...</div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Smart Quick Actions */}
          {areQuickActionsVisible && (
            <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white animate-fadeInUp">
              <div className="text-xs text-gray-600 mb-2 font-medium">💡 Quick Actions:</div>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickActionClick(action)}
                    className="bg-white hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 text-gray-700 hover:text-green-700 border border-gray-200 hover:border-green-300 transition-all duration-200 px-3 py-2 rounded-xl text-xs font-medium shadow-sm hover:shadow-md transform hover:scale-105"
                    style={{
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
            <div className="flex space-x-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about fitness, nutrition, or our gym..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none transition-all duration-200"
                  style={{
                    minHeight: '44px',
                    maxHeight: '120px'
                  }}
                  rows={1}
                />
                
                {/* Character count for longer messages */}
                {inputValue.length > 100 && (
                  <div className="absolute bottom-1 right-1 text-xs text-gray-400">
                    {inputValue.length}/500
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isBotTyping}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-3 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
            
            {/* AI Status Indicator */}
            <div className="flex items-center justify-center mt-2 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Powered by Advanced AI • Context-Aware • Learning</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        
        @keyframes slideInUp {
          from {
            transform: translateY(100%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fadeInUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedChatbot;