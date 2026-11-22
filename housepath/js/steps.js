export const PHASES = [
  { id: "before", title: "Before you spend" },
  { id: "paper", title: "Land, people, and drawings" },
  { id: "price", title: "Price and permission" },
  { id: "build", title: "While it is being built" },
  { id: "move", title: "Finish and move in" },
];

const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

export const STEPS = [
  {
    id: "wish",
    phase: "before",
    title: "Say what the house is for",
    soon: "Write who the house is for, and what can wait.",
    plain:
      "Write down who will live here and what the house must do. Later choices — the lot, the drawings, the price — get checked against this list, so the house does not quietly grow.",
    why: "A bigger house is the usual way a first build goes over budget. This list is how you notice.",
    fields: [
      {
        id: "who",
        type: "text",
        required: true,
        label: "Who will live here?",
        placeholder: "Two adults, one child, a dog",
        missing: "Write down who will live here.",
      },
      {
        id: "must",
        type: "textarea",
        required: true,
        label: "What must the house have?",
        placeholder: "3 bedrooms, a kitchen that fits a table, a bedroom on the first floor",
        hint: "Only the things you would be unhappy without.",
        missing: "Write down what the house must have.",
      },
      {
        id: "later",
        type: "textarea",
        required: true,
        label: "What can wait, or be left out?",
        placeholder: "A deck, a third bathroom, a finished basement",
        hint: "These are the first things to cut if the price is high.",
        missing: "Write down what can wait. “Nothing” is an answer if you mean it.",
      },
    ],
    checks: [
      {
        id: "shared",
        label: "Everyone who is paying has read this list and agreed",
      },
    ],
  },
  {
    id: "budget",
    phase: "before",
    title: "Set the most you can spend",
    soon: "Pick one limit and leave 10% untouched.",
    plain:
      "Pick one number: the most this house can cost, including the land, the build, fees, and surprises. The app holds back 10% of that number as a cushion. You do not plan to spend the cushion.",
    why: "Without a limit, every later yes has nothing to push against.",
    fields: [
      {
        id: "limit",
        type: "money",
        required: true,
        label: "The most this house can cost",
        hint: "Include land, construction, permits, and room for surprises.",
        missing: "Enter the most this house can cost.",
      },
      {
        id: "source",
        type: "text",
        required: true,
        label: "Where is the money coming from?",
        placeholder: "Savings and a construction loan",
        missing: "Write where the money is coming from.",
      },
    ],
    checks: [
      {
        id: "lender",
        label: "I know whether a bank has to approve this number before I hire a builder",
      },
      {
        id: "cushion-ok",
        label: "I understand the 10% cushion is not part of the building plan",
      },
    ],
  },
  {
    id: "land",
    phase: "paper",
    title: "Check the land",
    soon: "Make sure a house like yours is allowed here.",
    plain:
      "The lot decides more than the view. Zoning, flood water, and whether power and water can reach the house all change the price before anyone draws a wall.",
    why: "A beautiful lot that cannot take this house is an expensive surprise.",
    fields: [
      {
        id: "where",
        type: "text",
        required: true,
        label: "Where is the lot?",
        placeholder: "Street, town, or parcel number",
        missing: "Write where the lot is.",
      },
      {
        id: "price",
        type: "money",
        required: true,
        allowZero: true,
        label: "Price of the land",
        hint: "Enter 0 if you already own it and it is paid for.",
        missing: "Enter the land price, or 0 if it is already paid for.",
      },
    ],
    checks: [
      { id: "zoning", label: "The lot is zoned for a house of this size" },
      { id: "flood", label: "I know whether the lot is in a flood area" },
      { id: "utilities", label: "Water, sewer or septic, and power can reach the house" },
      { id: "access", label: "A car can reach the house in every season" },
    ],
  },
  {
    id: "people",
    phase: "paper",
    title: "Hire the builder and the designer",
    soon: "Name who draws the house and who builds it.",
    plain:
      "You need someone to draw the plans and a builder to put a price on them. A builder is often called a general contractor. Ask for a license number and check it with your state. Do not start work on a handshake.",
    why: "The contract is where you decide who pays when the price goes up.",
    fields: [
      {
        id: "builder",
        type: "text",
        required: true,
        label: "Builder",
        placeholder: "Company name",
        missing: "Write the builder’s name, or that you have not hired one yet.",
      },
      {
        id: "license",
        type: "text",
        required: true,
        label: "License",
        placeholder: "License number, or “building it myself”",
        hint: "If you build it yourself, you pull the permits and schedule the inspections.",
        missing: "Write the license number, or that you are building it yourself.",
      },
      {
        id: "designer",
        type: "text",
        required: true,
        label: "Who draws the plans?",
        placeholder: "Designer, architect, or the builder",
        missing: "Write who will draw the plans.",
      },
    ],
    checks: [
      {
        id: "licensed",
        label: "The builder is licensed, or I am building it myself and I know I pull the permits",
      },
      {
        id: "contract",
        label: "We agreed in writing who pays if the price goes up, or I have not hired anyone yet",
      },
    ],
  },
  {
    id: "plans",
    phase: "paper",
    title: "Approve the plans",
    soon: "File the drawings before anyone names a price.",
    plain:
      "Plans are the drawings of the house: each floor, the outside, and where walls, windows, and doors go. A builder cannot give a real price without them, and the town will not permit a rough sketch.",
    why: "If the drawing is wrong, every later step prices the wrong house.",
    fields: [],
    uploads: [
      {
        kind: "plan",
        required: true,
        label: "Plan drawings",
        help: "A PDF or a clear photo of each sheet. You can add more than one.",
        accept: FILE_ACCEPT,
        missing: "Add the plan drawings. A PDF or a photo is fine.",
      },
    ],
    checks: [
      { id: "matches", label: "The drawings include everything on the must-have list" },
      { id: "rooms", label: "I can point to the kitchen, each bedroom, and each bathroom" },
      { id: "walkthrough", label: "The designer or builder walked me through the drawings in plain words" },
      { id: "fits", label: "I have not approved a drawing that I already know I cannot afford" },
    ],
  },
  {
    id: "sheet",
    phase: "price",
    title: "Price it with a build sheet",
    soon: "Put the builder’s price against your limit.",
    plain:
      "A build sheet is the builder’s price list. It names each part of the house and what that part costs, before any work starts. Some builders call it a cost breakdown or a schedule of values. If it does not fit your limit, change the house now. It is much harder after the concrete is poured.",
    why: "This is the last calm moment to make the house smaller, simpler, or stop.",
    confirmSheet: true,
    moneyGate: true,
    fields: [],
    uploads: [
      {
        kind: "build-sheet",
        required: true,
        label: "Build sheet",
        help: "Upload the PDF or photo to keep on file. A .csv spreadsheet can also fill in the amounts.",
        accept: `${FILE_ACCEPT},.csv`,
        missing: "Add the build sheet. A PDF, a photo, or a .csv file is fine.",
      },
    ],
    checks: [
      { id: "matches", label: "The amounts on the money page match the build sheet I uploaded" },
      { id: "waiting", label: "I am not paying for things I said could wait" },
      {
        id: "excluded",
        label: "The builder told me what is not included, such as appliances, a well, or landscaping",
      },
    ],
  },
  {
    id: "permit",
    phase: "price",
    title: "Get the loan and the permit",
    soon: "Have the money and the town’s permission in hand.",
    plain:
      "A building permit is the town’s permission to build. The loan, or your cash, needs to cover the build sheet. Ask which inspections happen, and when. The important one is before any wall is covered.",
    why: "Work without a permit can be torn out. Work without the money stops halfway.",
    moneyGate: true,
    fields: [
      {
        id: "number",
        type: "text",
        required: true,
        label: "Permit number",
        placeholder: "As printed on the permit",
        missing: "Write the permit number.",
      },
    ],
    uploads: [
      {
        kind: "permit",
        required: false,
        label: "Permit, if you have a copy",
        help: "Optional. A photo or PDF stays with the other papers.",
        accept: FILE_ACCEPT,
        missing: "",
      },
    ],
    checks: [
      { id: "funded", label: "The loan or the cash covers at least the build sheet" },
      { id: "issued", label: "The building permit has been issued" },
      { id: "inspections", label: "I know the inspections happen before walls are covered" },
    ],
  },
  {
    id: "foundation",
    phase: "build",
    title: "Prepare the ground and pour the foundation",
    soon: "Stake the corners, then inspect before anything is buried.",
    plain:
      "The foundation is the concrete base of the house. The corners should match the plan. The town inspects this work before it is buried or covered. If the ground is soft or wet, that has to be solved first.",
    why: "A foundation in the wrong place makes the whole drawing wrong.",
    moneyGate: true,
    fields: [],
    checks: [
      { id: "staked", label: "The corners are staked and they match the plan" },
      { id: "soil", label: "The ground was checked before concrete was poured" },
      { id: "poured", label: "The foundation is in" },
      { id: "inspected", label: "The town inspected it before it was buried or covered" },
      { id: "bills", label: "Every bill for this step is on the money page, or nothing has been paid" },
    ],
  },
  {
    id: "frame",
    phase: "build",
    title: "Frame the house and keep the rain out",
    soon: "Walls, roof, windows, and doors, so the house is dry.",
    plain:
      "Framing is the wood or steel skeleton: floors, walls, and roof. After the windows, exterior doors, and roof are on, rain stays out. Walk through before the walls close up. This is when you still feel the size of each room.",
    why: "A room that feels wrong is still fixable here. After drywall, it is a demolition.",
    moneyGate: true,
    fields: [],
    checks: [
      { id: "match", label: "The walls, windows, and doors match the plan" },
      { id: "dry", label: "The roof, windows, and exterior doors are on, so rain stays out" },
      { id: "walk", label: "I walked through and the rooms are the size I expected" },
      {
        id: "changes",
        label: "Any change from the plan was written down, with a price, before work continued",
      },
      { id: "bills", label: "Every bill for this step is on the money page, or nothing has been paid" },
    ],
  },
  {
    id: "rough",
    phase: "build",
    title: "Put in pipes, wires, and heat",
    soon: "Inspect them while the walls are still open.",
    plain:
      "Rough-in means the pipes, wires, and heating ducts that go inside the walls. The town inspects them while they are still visible. Insulation and drywall come after that inspection, not before.",
    why: "Covering a failed inspection means opening the walls again.",
    moneyGate: true,
    fields: [],
    checks: [
      { id: "in", label: "Plumbing, electrical, and heat are in the walls" },
      { id: "inspected", label: "The town inspected them while they were still visible" },
      { id: "open", label: "Insulation and drywall have not started, or that inspection already passed" },
      { id: "places", label: "Outlets, vents, and hose connections are where I will actually use them" },
      { id: "bills", label: "Every bill for this step is on the money page, or nothing has been paid" },
    ],
  },
  {
    id: "inside",
    phase: "build",
    title: "Close the walls and finish the inside",
    soon: "Insulation, drywall, kitchen, baths, floors, and paint.",
    plain:
      "This is insulation, drywall, floors, paint, the kitchen, and the bathrooms. What you see should be what you chose. Write down dents, gaps, and missing pieces as you notice them. That written list is called a punch list.",
    why: "A spoken “they’ll catch it” is how small repairs get forgotten.",
    moneyGate: true,
    fields: [],
    checks: [
      { id: "closed", label: "Insulation and drywall are done" },
      { id: "kitchen", label: "The kitchen and bathrooms match what I approved" },
      { id: "finishes", label: "Floors and paint are what I chose, not a swap I did not agree to" },
      { id: "punch", label: "I wrote a punch list of dents, gaps, and missing pieces" },
      { id: "bills", label: "Every bill for this step is on the money page, or nothing has been paid" },
    ],
  },
  {
    id: "movein",
    phase: "move",
    title: "Finish outside, inspect, and move in",
    soon: "Get the town’s OK before you live there.",
    plain:
      "A certificate of occupancy is the town’s written OK to live in the house. In most places you should not move in without it. Walk every room with the builder. Hold the last payment until the punch-list items you care about are done.",
    why: "The last payment is the leverage you have left.",
    moneyGate: true,
    fields: [],
    uploads: [
      {
        kind: "occupancy",
        required: false,
        label: "Certificate of occupancy, if you have a copy",
        help: "Optional. Keep a photo with the other papers.",
        accept: FILE_ACCEPT,
        missing: "",
      },
    ],
    checks: [
      {
        id: "outside",
        label: "Siding, gutters, and the driveway are done, or I have a written date and price for what is left",
      },
      { id: "co", label: "The town issued the certificate of occupancy" },
      { id: "walk", label: "I walked every room with the builder and the punch list is written down" },
      { id: "hold", label: "The last payment is still held until the punch-list items I care about are done" },
      { id: "under", label: "The money page is not over the limit" },
    ],
  },
];

export const WORDS = [
  ["Plans", "Drawings of each floor and the outside. The price and the permit both come from these."],
  ["Build sheet", "The builder’s list of what each part costs, before the work starts."],
  ["Cushion", "10% of your limit. It is for surprises. It is not money to design with."],
  ["Change order", "A written price for anything that was not on the build sheet. Get it before you say yes."],
  ["Rough-in", "Pipes, wires, and ducts inside the walls, inspected before the walls close."],
  ["Punch list", "Your written list of what is still unfinished or damaged."],
  ["Certificate of occupancy", "The town’s written OK to live in the house."],
];
