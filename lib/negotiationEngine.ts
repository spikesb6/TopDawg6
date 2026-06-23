import { NegotiationLogEntry, NegotiationState, Property, NegotiationAction, SellerPersonality } from './types';
import { uniqueId } from './utils';

const RAPPORT_MESSAGES: Record<SellerPersonality, string[]> = {
  'Distressed': [
    "I understand you're going through a tough time. I want to help you get out of this situation quickly.",
    "I've helped many families in similar situations find a way out. Let's see what we can do.",
  ],
  'Emotional': [
    "This home has clearly meant a lot to you. I promise to treat it with the respect it deserves.",
    "I can see how much care went into this place. That speaks well of you.",
  ],
  'Investor': [
    "I respect your experience in this market. Let's talk numbers like professionals.",
    "I've closed dozens of deals myself. I know how to make a clean, quick close.",
  ],
  'Landlord': [
    "After years of managing tenants, you deserve to cash out and relax. I can make that happen.",
    "I know exactly what it's like dealing with property management headaches.",
  ],
  'Heir': [
    "I know settling an estate can be complicated. I can make this part easy.",
    "My goal is to simplify this for you and your family. Let's get you to the finish line.",
  ],
  'Stubborn': [
    "I'm not here to waste your time. I respect your position and want to find common ground.",
    "I've done my homework on this property and I'm serious about making a deal.",
  ],
  'Luxury Seller': [
    "I recognize the quality of this property and I'm prepared to bring a serious offer.",
    "This is clearly a premium asset. I have the resources to close at the right price.",
  ],
};

const MOTIVATION_RESPONSES: Record<SellerPersonality, string[]> = {
  'Distressed': [
    '"I need this sold in the next 30 days or I lose everything. Cash is king right now."',
    '"The bank has been calling. I just need out."',
  ],
  'Emotional': [
    '"My kids grew up in this house. It\'s not just about money."',
    '"I want it to go to someone who will actually love it."',
  ],
  'Investor': [
    '"I\'m looking at a 1031 exchange. Timing matters more than squeezing every dollar."',
    '"I need clean paper, no contingencies, and a fast close."',
  ],
  'Landlord': [
    '"Tenant just moved out after 8 years. Last thing I want is another turnover."',
    '"I\'m done being a landlord. Done. Just make me an offer I can live with."',
  ],
  'Heir': [
    '"There are three siblings involved. The faster this closes, the better."',
    '"I never even wanted this property. I just need to liquidate my share."',
  ],
  'Stubborn': [
    '"I\'m not in a rush. I\'ve had 12 lowballs already. I know what this is worth."',
    '"The market will come to me. I\'ve waited this long."',
  ],
  'Luxury Seller': [
    '"I\'m looking at the new development on the south end. I need the proceeds from this."',
    '"I have multiple interested buyers. What separates you?"',
  ],
};

function calcSellerResponse(
  state: NegotiationState,
  property: Property,
  action: NegotiationAction,
  offerAmount?: number
): { message: string; trustChange: number; resistanceChange: number; sellerCounter?: number } {
  const seller = property.seller;
  const minPrice = seller.minimumAcceptablePrice;
  const personality = seller.personality;
  const currentTrust = state.trustBuilt;
  const currentResistance = seller.resistance - state.motivationRevealed;

  switch (action) {
    case 'build_rapport': {
      const msg = RAPPORT_MESSAGES[personality][Math.floor(Math.random() * 2)];
      const trustGain = Math.random() < 0.7 ? Math.floor(Math.random() * 15) + 8 : Math.floor(Math.random() * 5) + 2;
      const resistanceChange = trustGain > 10 ? -Math.floor(trustGain / 2) : 0;
      return { message: `"${msg.split('"')[1] ?? 'Thanks for saying that.'}"`, trustChange: trustGain, resistanceChange };
    }
    case 'ask_questions': {
      const questions = [
        "What's your ideal timeline for closing?",
        "Have you had other offers on the property?",
        "What would make this deal easy for you?",
        "Are there any repairs you're aware of that we should discuss?",
        "What are your plans after the sale?",
      ];
      const q = questions[Math.floor(Math.random() * questions.length)];
      const trustGain = Math.floor(Math.random() * 8) + 3;
      return {
        message: `You ask: "${q}" — Seller responds thoughtfully, sharing more about their situation.`,
        trustChange: trustGain,
        resistanceChange: -5,
      };
    }
    case 'explore_motivation': {
      const motivationMsg = MOTIVATION_RESPONSES[personality][Math.floor(Math.random() * 2)];
      const trustGain = Math.floor(Math.random() * 10) + 5;
      return {
        message: `Seller opens up: ${motivationMsg}`,
        trustChange: trustGain,
        resistanceChange: -10,
      };
    }
    case 'make_offer':
    case 'counter_offer': {
      if (!offerAmount) return { message: 'No offer amount provided.', trustChange: 0, resistanceChange: 0 };
      const trustBonus = Math.floor(currentTrust / 10);
      const effectiveMinPrice = minPrice - (trustBonus * 500);

      if (offerAmount >= seller.askingPrice) {
        return {
          message: `"Full asking price? You\'ve got yourself a deal!" Seller accepts immediately.`,
          trustChange: 10,
          resistanceChange: -100,
          sellerCounter: offerAmount,
        };
      }

      if (offerAmount >= effectiveMinPrice) {
        const margin = offerAmount - effectiveMinPrice;
        if (margin > 5000 || currentResistance < 30) {
          return {
            message: `"I appreciate the offer. After considering everything... let's do it."`,
            trustChange: 5,
            resistanceChange: -100,
            sellerCounter: offerAmount,
          };
        } else {
          const counter = Math.round((offerAmount + effectiveMinPrice) / 2 / 1000) * 1000;
          return {
            message: `"You're getting warmer. I could do ${formatOffer(counter)} if you can close quickly."`,
            trustChange: 3,
            resistanceChange: -15,
            sellerCounter: counter,
          };
        }
      }

      const gap = effectiveMinPrice - offerAmount;
      if (gap > effectiveMinPrice * 0.15) {
        const counter = Math.round(effectiveMinPrice * 1.05 / 1000) * 1000;
        if (currentResistance > 60) {
          return {
            message: `"${offerAmount < minPrice * 0.7 ? "That's insulting. I've had better offers from wholesalers." : "I appreciate the interest, but we're miles apart."} My bottom is ${formatOffer(counter)}."`,
            trustChange: offerAmount < minPrice * 0.6 ? -15 : -5,
            resistanceChange: 5,
            sellerCounter: counter,
          };
        } else {
          return {
            message: `"I hear you, but I need at least ${formatOffer(counter)} to make this work for me."`,
            trustChange: 0,
            resistanceChange: 0,
            sellerCounter: counter,
          };
        }
      }

      const counter = Math.round((offerAmount * 0.4 + effectiveMinPrice * 0.6) / 1000) * 1000;
      return {
        message: `"We're getting closer. How about we meet somewhere in the middle — ${formatOffer(counter)}?"`,
        trustChange: 2,
        resistanceChange: -8,
        sellerCounter: counter,
      };
    }
    case 'walk_away': {
      if (currentResistance < 40 && state.rounds > 1) {
        return {
          message: `"Wait — don\'t leave. Let me think about your last offer... okay, ${formatOffer(Math.round(minPrice * 1.02 / 1000) * 1000)}. That\'s my final answer."`,
          trustChange: 0,
          resistanceChange: -50,
          sellerCounter: Math.round(minPrice * 1.02 / 1000) * 1000,
        };
      }
      return {
        message: `"I understand. If you change your mind, you know where to find me." Deal lost.`,
        trustChange: 0,
        resistanceChange: 0,
      };
    }
    default:
      return { message: '', trustChange: 0, resistanceChange: 0 };
  }
}

function formatOffer(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function processNegotiationAction(
  state: NegotiationState,
  property: Property,
  action: NegotiationAction,
  offerAmount?: number
): NegotiationState {
  const response = calcSellerResponse(state, property, action, offerAmount);
  const newLog: NegotiationLogEntry[] = [...state.log];

  const actionLabels: Record<NegotiationAction, string> = {
    build_rapport: 'Built Rapport',
    ask_questions: 'Asked Questions',
    explore_motivation: 'Explored Motivation',
    make_offer: `Made Offer: ${offerAmount ? formatOffer(offerAmount) : ''}`,
    counter_offer: `Counter Offer: ${offerAmount ? formatOffer(offerAmount) : ''}`,
    walk_away: 'Walked Away',
  };

  newLog.push({
    id: uniqueId(),
    actor: 'player',
    action: actionLabels[action],
    message: actionLabels[action],
    trustChange: response.trustChange,
    resistanceChange: response.resistanceChange,
  });

  newLog.push({
    id: uniqueId(),
    actor: 'seller',
    action: 'Response',
    message: response.message,
  });

  const newTrust = Math.min(100, state.trustBuilt + response.trustChange);
  const newMotivationRevealed = Math.min(100, state.motivationRevealed + Math.abs(response.resistanceChange));

  let dealAccepted = state.dealAccepted;
  let dealRejected = state.dealRejected;
  let agreedPrice = state.agreedPrice;

  if ((action === 'make_offer' || action === 'counter_offer') && response.sellerCounter) {
    if (offerAmount && offerAmount >= response.sellerCounter) {
      dealAccepted = true;
      agreedPrice = offerAmount;
    }
  }

  if (action === 'walk_away') {
    if (response.sellerCounter) {
      dealAccepted = true;
      agreedPrice = response.sellerCounter;
    } else {
      dealRejected = true;
    }
  }

  return {
    ...state,
    currentOffer: offerAmount ?? state.currentOffer,
    sellerCounterOffer: response.sellerCounter ?? state.sellerCounterOffer,
    trustBuilt: newTrust,
    motivationRevealed: newMotivationRevealed,
    rounds: state.rounds + 1,
    log: newLog,
    dealAccepted,
    dealRejected,
    agreedPrice,
  };
}

export function initNegotiationState(property: Property): NegotiationState {
  return {
    propertyId: property.id,
    currentOffer: 0,
    sellerCounterOffer: property.seller.askingPrice,
    trustBuilt: 0,
    motivationRevealed: 0,
    rounds: 0,
    log: [],
    dealAccepted: false,
    dealRejected: false,
  };
}
