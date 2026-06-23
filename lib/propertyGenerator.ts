import { Property, PropertyType, SellerPersonality, SellerProfile, InvestorLevel } from './types';
import { uniqueId } from './utils';

const STREETS = [
  'Oak Street', 'Maple Avenue', 'Elm Drive', 'Cedar Lane', 'Pine Road',
  'Willow Way', 'Birch Blvd', 'Sunset Blvd', 'Harbor View', 'Lakeside Dr',
  'Mountain Pass', 'River Road', 'Valley View', 'Hillcrest Ave', 'Magnolia St',
  'Peach Tree Ln', 'Cypress Court', 'Palmetto Blvd', 'Bayshore Dr', 'Ridgeline Rd',
];

const CITIES: Record<string, string> = {
  'Phoenix': 'AZ', 'Tampa': 'FL', 'Dallas': 'TX', 'Atlanta': 'GA',
  'Charlotte': 'NC', 'Nashville': 'TN', 'Denver': 'CO', 'Las Vegas': 'NV',
  'Jacksonville': 'FL', 'Austin': 'TX', 'Memphis': 'TN', 'Detroit': 'MI',
  'Cleveland': 'OH', 'Baltimore': 'MD', 'Indianapolis': 'IN',
};

const SELLER_NAMES = [
  'Robert Mitchell', 'Sandra Hayes', 'Carlos Rivera', 'Patricia Donnelly',
  'James Thornton', 'Linda Carpenter', 'Michael O\'Brien', 'Dorothy Walsh',
  'Kevin Anderson', 'Barbara Johnson', 'Thomas Reed', 'Margaret Sullivan',
  'William Baker', 'Nancy Foster', 'George Harrison',
];

const SELLER_BACKSTORIES: Record<SellerPersonality, string[]> = {
  'Distressed': [
    'Going through a difficult divorce and needs to sell quickly.',
    'Behind on mortgage payments and facing foreclosure.',
    'Lost job and can\'t keep up with expenses.',
    'Medical bills have overwhelmed the finances.',
  ],
  'Emotional': [
    'This was their childhood home and it\'s hard to let go.',
    'Recently lost a spouse and can\'t maintain the property.',
    'Family memories make every showing painful.',
    'Downsizing after kids left but emotionally attached.',
  ],
  'Investor': [
    'Seasoned investor liquidating a property from their portfolio.',
    'Looking to 1031 exchange into a larger deal.',
    'Tired landlord ready to exit the rental game.',
    'Rebalancing portfolio and needs liquidity.',
  ],
  'Landlord': [
    'Long-time landlord burned out by problem tenants.',
    'Managing properties from out of state is too difficult.',
    'Wants to retire and cash out.',
    'Tenant just moved out after 8 years and doesn\'t want to deal with finding new ones.',
  ],
  'Heir': [
    'Inherited this property from a grandparent and doesn\'t want it.',
    'Part of an estate being settled among siblings.',
    'Lives out of state and wants to liquidate.',
    'No attachment to the property — purely a financial transaction.',
  ],
  'Stubborn': [
    'Has been trying to sell for 18 months and won\'t budge on price.',
    'Convinced their home is worth more than the market says.',
    'Previous investor tried to lowball them and they\'re resentful.',
    'Doesn\'t actually need to sell — testing the market.',
  ],
  'Luxury Seller': [
    'Upgrading to a larger estate and needs this one sold.',
    'Corporate relocation with a generous package.',
    'Successful entrepreneur who built their dream home and is ready for the next chapter.',
    'High net worth individual selling an investment property at a premium.',
  ],
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 0): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSeller(
  personality: SellerPersonality,
  askingPrice: number,
  arv: number
): SellerProfile {
  const motivations: Record<SellerPersonality, number> = {
    'Distressed': rand(75, 95),
    'Emotional': rand(45, 70),
    'Investor': rand(40, 65),
    'Landlord': rand(55, 80),
    'Heir': rand(65, 90),
    'Stubborn': rand(15, 40),
    'Luxury Seller': rand(30, 55),
  };

  const resistances: Record<SellerPersonality, number> = {
    'Distressed': rand(10, 30),
    'Emotional': rand(40, 70),
    'Investor': rand(30, 55),
    'Landlord': rand(35, 60),
    'Heir': rand(15, 35),
    'Stubborn': rand(70, 95),
    'Luxury Seller': rand(50, 80),
  };

  const discounts: Record<SellerPersonality, number> = {
    'Distressed': randFloat(0.65, 0.80, 2),
    'Emotional': randFloat(0.80, 0.90, 2),
    'Investor': randFloat(0.82, 0.92, 2),
    'Landlord': randFloat(0.78, 0.88, 2),
    'Heir': randFloat(0.70, 0.85, 2),
    'Stubborn': randFloat(0.90, 0.98, 2),
    'Luxury Seller': randFloat(0.88, 0.97, 2),
  };

  return {
    personality,
    name: pickRandom(SELLER_NAMES),
    backstory: pickRandom(SELLER_BACKSTORIES[personality]),
    trust: 20,
    resistance: resistances[personality],
    motivation: motivations[personality],
    minimumAcceptablePrice: Math.round(arv * discounts[personality]),
    askingPrice,
  };
}

export function generateProperty(level: InvestorLevel, imageIndex?: number): Property {
  const priceRanges: Record<string, [number, number]> = {
    'Rookie Investor': [40000, 120000],
    'Wholesaler': [60000, 180000],
    'Rehabber': [80000, 250000],
    'Landlord': [100000, 400000],
    'Commercial Investor': [200000, 800000],
    'Developer': [400000, 1500000],
    'Tycoon': [600000, 3000000],
    'Empire Builder': [1000000, 8000000],
  };

  const [minPrice, maxPrice] = priceRanges[level];
  const arv = rand(minPrice, maxPrice);

  const types: PropertyType[] = ['Single Family', 'Condo', 'Duplex', 'Triplex', 'Fourplex'];
  const luxuryTypes: PropertyType[] = ['Waterfront', 'Mansion', 'Penthouse'];
  const commercialTypes: PropertyType[] = ['Retail', 'Office', 'Industrial'];

  let availableTypes = types;
  if (['Commercial Investor', 'Developer', 'Tycoon', 'Empire Builder'].includes(level)) {
    availableTypes = [...types, ...commercialTypes];
  }
  if (['Developer', 'Tycoon', 'Empire Builder'].includes(level)) {
    availableTypes = [...availableTypes, ...luxuryTypes];
  }

  const propertyType = pickRandom(availableTypes);
  const conditionScore = rand(1, 9);
  const repairMultiplier = (10 - conditionScore) / 10;
  const repairEstimate = Math.round(arv * repairMultiplier * randFloat(0.10, 0.25, 2));
  const askingPrice = Math.round(arv * randFloat(0.75, 0.95, 2));

  const personalities: SellerPersonality[] = [
    'Distressed', 'Emotional', 'Investor', 'Landlord', 'Heir', 'Stubborn', 'Luxury Seller',
  ];
  const personality = pickRandom(personalities);

  const cityNames = Object.keys(CITIES);
  const city = pickRandom(cityNames);
  const state = CITIES[city];
  const streetNum = rand(100, 9999);
  const street = pickRandom(STREETS);

  const rentMultiplier: Record<PropertyType, number> = {
    'Single Family': 0.008,
    'Condo': 0.007,
    'Duplex': 0.012,
    'Triplex': 0.016,
    'Fourplex': 0.020,
    'Retail': 0.010,
    'Office': 0.009,
    'Industrial': 0.007,
    'Waterfront': 0.006,
    'Mansion': 0.005,
    'Penthouse': 0.007,
  };

  const estimatedRent = Math.round(arv * rentMultiplier[propertyType]);

  return {
    id: uniqueId(),
    address: `${streetNum} ${street}`,
    city,
    state,
    propertyType,
    askingPrice,
    arv,
    repairEstimate,
    conditionScore,
    condition: conditionScore >= 8 ? 'Excellent' : conditionScore >= 6 ? 'Good' : conditionScore >= 4 ? 'Fair' : conditionScore >= 2 ? 'Poor' : 'Distressed',
    neighborhoodRating: rand(3, 10),
    estimatedRent,
    dealDifficulty: rand(1, 10),
    seller: generateSeller(personality, askingPrice, arv),
    status: 'listed',
    imageIndex: imageIndex ?? rand(0, 11),
  };
}

export function generateDealFeed(level: InvestorLevel, count = 6): Property[] {
  return Array.from({ length: count }, (_, i) => generateProperty(level, i % 12));
}
