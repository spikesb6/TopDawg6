/* Build It content: the roadmap, land checks, permits, team guidance and durability principles.
   Code references are to the 2021/2024 IRC, IECC and NEC as typically adopted. Local amendments always win. */

const PHASES = [
  {
    id: "finance", name: "Dream & finance", days: "2–8 weeks", share: 0,
    blurb: "Decide what you are building and prove you can pay for all of it before you spend a dollar on land.",
    who: ["Construction lender", "Financial advisor or CPA", "You"],
    steps: [
      { id: "f1", t: "Write your must-haves, nice-to-haves and deal-breakers",
        d: "List bedrooms, baths, garage, single-story or two, office, storage, accessibility needs and how long you plan to live there. Rank everything. This list settles arguments later when the budget gets tight.",
        pro: "Top custom builders run a programming session before any drawing: room by room, how you actually live (where shoes go, where groceries land, who works from home)." },
      { id: "f2", t: "Set a total all-in budget, not just a house price",
        d: "All-in means land + site work + construction + design and engineering + permits and fees + loan costs + furniture and landscaping + 10–15% contingency. Use the Budget tab.",
        pro: "Experienced builders never start without a contingency line. 10% is the floor for a first build; 15% if the lot has unknowns.", crit: true },
      { id: "f3", t: "Pull your credit and talk to two or three construction lenders",
        d: "Construction loans are different from regular mortgages: usually 20–25% down, interest-only payments during the build, and money released in draws as work is inspected. Ask about one-time close (construction-to-permanent) versus two-time close.",
        pro: "Ask each lender for their draw schedule, how fast draws are funded, whether they lend to owner-builders, and what they require from the builder (license, financials, references)." },
      { id: "f4", t: "Get a construction loan pre-approval letter",
        d: "Sellers and builders take you seriously with a letter in hand. It also tells you your real ceiling.",
        pro: "Keep your credit untouched until closing: no new cars, cards or job changes." },
      { id: "f5", t: "Decide how you will build: hire a general contractor or be the owner-builder",
        d: "A general contractor (GC) runs subs, schedule and code compliance for a fee of roughly 10–20%. As an owner-builder you save that fee but take on scheduling, liability, insurance and every mistake. Many lenders will not lend to first-time owner-builders. See the Team tab.",
        pro: "If you have no construction experience, the safest path is a GC on a fixed-price or cost-plus-with-a-cap contract, plus your own independent inspector.", crit: true },
      { id: "f6", t: "Open a dedicated bank account and a project binder",
        d: "Every dollar in and out of the build goes through one account. The binder (paper or cloud folder) holds contracts, permits, invoices, lien waivers, photos and inspection reports.",
        pro: "Builders who stay on budget track committed costs (signed contracts) as well as paid costs. Committed cost is where overruns show up first." }
    ]
  },
  {
    id: "land", name: "Find & buy land", days: "1–6 months", share: 0,
    blurb: "The lot decides your budget, your foundation, your utilities and your permits. Most expensive surprises in home building are buried in the dirt.",
    who: ["Real estate agent who knows land", "Land surveyor", "Geotechnical engineer", "Attorney or title company"],
    steps: [
      { id: "l1", t: "Confirm zoning allows the home you want",
        d: "Call the planning or zoning office with the parcel number. Ask: allowed use, minimum lot size, setbacks (front, side, rear), maximum height, lot coverage, and whether accessory buildings are allowed.",
        pro: "Get the answers in writing or by email, and keep them. Verbal answers from a counter clerk are not approvals.", crit: true },
      { id: "l2", t: "Read the deed restrictions, HOA covenants and plat notes",
        d: "These can set minimum square footage, materials, roof pitch, fences, outbuildings and even who must approve your plans.",
        pro: "Ask the title company for copies of every recorded document, not a summary." },
      { id: "l3", t: "Make your offer with due diligence contingencies",
        d: "Write the contract so you can walk away with your deposit if the survey, soils, perc test, utilities, zoning or financing fail. Ask for a 30–90 day feasibility period.",
        pro: "Never buy raw land with a clean, contingency-free offer as a beginner. The feasibility period is the cheapest insurance you will ever buy.", crit: true },
      { id: "l4", t: "Order a boundary survey (and topographic survey)",
        d: "A licensed surveyor marks the corners, shows easements and encroachments, and maps slopes. Your designer needs the topo to place the house and plan drainage.",
        pro: "Top builders design the house around the topography and sun, not the other way round. A walkout basement on a sloped lot can be cheaper than fighting the slope." },
      { id: "l5", t: "Get a soils (geotechnical) report",
        d: "A geotech drills test borings and reports bearing capacity, expansive clay, groundwater and fill. Your foundation design depends on it.",
        pro: "Expansive clay, uncompacted fill and high groundwater are the top causes of foundation failure. A $1,500–$4,000 report can save a $60,000 repair.", crit: true },
      { id: "l6", t: "Confirm water and sewer, or test for well and septic",
        d: "Public: get the tap fees and the distance to the main in writing. Private: a perc (percolation) test proves the soil can take a septic system, and nearby well records show likely depth and yield.",
        pro: "A failed perc test can make a lot unbuildable. Do it before closing, never after.", crit: true },
      { id: "l7", t: "Price power, gas and internet to the build site",
        d: "Call each utility with the parcel address. Bringing power a long distance can run thousands per hundred feet. Ask if service is overhead or underground and who pays for trenching.",
        pro: "Get written utility quotes during due diligence and put them straight into your budget." },
      { id: "l8", t: "Check the flood map, wetlands and environmental risks",
        d: "Look up the parcel on the FEMA Flood Map Service Center. Ask about wetlands, protected trees or species, wildfire zones and past uses (old farms or industrial sites may need a Phase I environmental check).",
        pro: "Even outside a mapped flood zone, walk the lot during a heavy rain. Watch where the water goes. That is where your house should not be." },
      { id: "l9", t: "Confirm legal access and driveway approval",
        d: "The lot must touch a public road or have a recorded access easement. Ask the road authority whether a driveway (curb cut) permit is available where you want it.",
        pro: "Landlocked parcels and shared private roads without a maintenance agreement cause lifelong headaches." },
      { id: "l10", t: "Close with title insurance",
        d: "Title insurance protects you if someone later claims the land or a lien surfaces. Review the title commitment for exceptions before closing.",
        pro: "Have a real estate attorney review any easement or exception you do not understand.", crit: true }
    ]
  },
  {
    id: "design", name: "Design & engineering", days: "2–6 months", share: 0,
    blurb: "Every hour spent on paper saves days in the field. Finish the decisions now, while changes cost an eraser instead of a change order.",
    who: ["Architect or residential designer", "Structural engineer", "Civil engineer (site and drainage)", "HVAC designer or energy rater"],
    steps: [
      { id: "d1", t: "Hire a designer or architect and buy or draw plans",
        d: "Stock plans are cheaper but must be adapted to your lot, climate and local code. Custom plans fit better. Either way you need a full permit set: site plan, foundation, floor plans, elevations, sections, framing, and electrical layout.",
        pro: "Orient the house for the sun: in most of North America, long side and main windows facing south, with overhangs sized to shade summer sun and let winter sun in." },
      { id: "d2", t: "Have a structural engineer design the foundation and framing",
        d: "The engineer uses your soils report to size footings, rebar, beams, headers, shear walls and hold-downs. Many areas require engineering for wind, snow or seismic loads.",
        pro: "Insist on a continuous load path: roof tied to walls, walls tied to floors, floors tied to foundation, with real hardware at every link.", crit: true },
      { id: "d3", t: "Get a grading and drainage plan",
        d: "Shows finished grades, where roof and surface water goes, swales, culverts and any retention required by your jurisdiction.",
        pro: "The ground must fall at least 6 inches in the first 10 feet away from the foundation (IRC R401.3). The best builders do more." },
      { id: "d4", t: "Run a load calculation for heating and cooling (Manual J, S and D)",
        d: "Sizes the system to the house you are actually building instead of a rule of thumb. Oversized systems short-cycle, leave humidity behind and wear out early.",
        pro: "Put the ducts inside the conditioned space, never in a vented attic. It is one of the biggest energy and comfort upgrades you can make for free on paper." },
      { id: "d5", t: "Specify the wall, roof and foundation assemblies",
        d: "Decide insulation type and R-values, air barrier, water-resistive barrier, vapor control and windows for your climate zone. These choices decide whether the house rots, molds or lasts.",
        pro: "Building Science Corporation’s rule: control rain first, then air, then vapor, then heat. Continuous exterior insulation and a rainscreen gap behind siding are signs of a builder who builds for a century." , crit: true },
      { id: "d6", t: "Choose finishes and fixtures before you bid",
        d: "Flooring, tile, cabinets, counters, plumbing fixtures, lighting, appliances and hardware. Each one undecided becomes an allowance, and allowances are where budgets break.",
        pro: "Builders who finish on budget have a complete selections sheet signed before the contract. Leave allowances only where you truly cannot decide yet." },
      { id: "d7", t: "Get an independent review of the plans",
        d: "Pay an experienced builder, inspector or second architect to review the set for constructability, missing details and code problems.",
        pro: "Cheap insurance: a few hundred dollars to catch a missing beam, an impossible stair or a window that blocks the furnace flue." }
    ]
  },
  {
    id: "team", name: "Build your team", days: "3–8 weeks", share: 0,
    blurb: "The people you hire decide the quality of the house more than any material. Vet them like you are hiring for a job you cannot fire them from.",
    who: ["General contractor or lead subs", "Independent home inspector", "Attorney for contract review"],
    steps: [
      { id: "t1", t: "Get at least three bids on the same plans and specifications",
        d: "Give every bidder identical documents and a bid form so you compare like for like. Ask each one what is excluded.",
        pro: "The low bid is often the one that left something out. Line up the exclusions side by side before comparing totals.", crit: true },
      { id: "t2", t: "Verify license, insurance and workers’ comp",
        d: "Look up the license on your state board. Get certificates of insurance sent directly from the insurance agent (general liability and workers’ comp), naming you as additional insured.",
        pro: "If an uninsured worker gets hurt on your lot, you can be liable. No certificate, no start.", crit: true },
      { id: "t3", t: "Call references and visit homes they built 5+ years ago",
        d: "New homes all look good. Ask past clients: Was it on budget? On time? How did they handle problems? Would you hire them again?",
        pro: "Look at the old homes for cracked drywall, sticking doors, stained soffits and bad grading. That is how this builder’s work ages." },
      { id: "t4", t: "Sign a written contract with scope, price, schedule and payment terms",
        d: "It should list the plans by date, the spec sheet, allowances, draw schedule, retainage, change-order process, warranty, cleanup, insurance and dispute resolution. See the Team tab.",
        pro: "Have a construction attorney read it before you sign. Never sign a contract that lets payments run ahead of work.", crit: true },
      { id: "t5", t: "Hire your own third-party inspector",
        d: "Code inspectors check the minimum. Your own inspector works for you and checks quality at key points: before the pour, before drywall and at the end.",
        pro: "Schedule the visits in writing with the GC up front so nobody covers work before your inspector sees it." },
      { id: "t6", t: "Set up builder’s risk insurance",
        d: "Covers the structure during construction against fire, theft, vandalism and storms. Your lender will require it.",
        pro: "Confirm who holds the policy (you or the GC) and that materials stored on site are covered." }
    ]
  },
  {
    id: "permits", name: "Permits & approvals", days: "2–16 weeks", share: 0,
    blurb: "No permit, no build. Permits put a trained inspector on your side at every critical point. See the Permits tab for your list.",
    who: ["Building department", "Health department (septic and well)", "HOA review board", "Utility companies"],
    steps: [
      { id: "p1", t: "Get HOA or architectural review approval (if any)",
        d: "Usually comes first because the building department may not accept plans the HOA has not approved.",
        pro: "Submit a complete package the first time: plans, site plan, colors and materials." },
      { id: "p2", t: "Submit for your building permit",
        d: "Usually needs the full plan set, site plan, engineering letters, energy compliance report and any septic or well approvals.",
        pro: "Ask the plan reviewer which inspections they require and in what order. Write them into your schedule.", crit: true },
      { id: "p3", t: "Apply for the site permits: grading, erosion control, driveway, utilities",
        d: "Disturbing an acre or more usually needs a stormwater (NPDES) permit and a stormwater plan. Driveways onto public roads need a curb-cut permit.",
        pro: "Erosion control goes in before the first bulldozer, not after the first storm." },
      { id: "p4", t: "Answer plan review comments and pick up the permit",
        d: "Reviewers send corrections. Your designer revises and resubmits.",
        pro: "Read every condition printed on the approved permit. They are requirements, not suggestions." },
      { id: "p5", t: "Post the permit card on site and keep the approved plans there",
        d: "Inspectors check that work matches the stamped set. Keep it dry and visible at the front of the lot.",
        pro: "Any change from the approved plans needs a revision approved by the department before you build it." }
    ]
  },
  {
    id: "site", name: "Site prep", days: "1–4 weeks", share: 7,
    blurb: "Get the house in the right spot, at the right height, with water and mud under control from day one.",
    who: ["Excavator", "Surveyor", "Utility crews"],
    steps: [
      { id: "s1", t: "Call 811 before any digging",
        d: "Free service that marks buried utility lines. Required by law in every US state.",
        pro: "Wait the full required time and do not dig until every utility has responded.", crit: true },
      { id: "s2", t: "Install erosion and sediment control",
        d: "Silt fence, a gravel construction entrance and inlet protection per your plan.",
        pro: "Keep it maintained all job long. Stop-work orders for mud in the street are common and avoidable." },
      { id: "s3", t: "Have the surveyor stake the house corners and set the elevation",
        d: "The surveyor places the house exactly per the site plan, meeting setbacks, and sets the finished floor height.",
        pro: "Set the finished floor high enough that water drains away on every side. Too low is the most common siting mistake and almost impossible to fix later.", crit: true },
      { id: "s4", t: "Clear, strip topsoil and stockpile it",
        d: "Remove trees and vegetation in the house area. Save topsoil for final landscaping instead of buying it back.",
        pro: "Protect trees you are keeping with fencing at the drip line. Root damage kills trees two or three years later." },
      { id: "s5", t: "Bring temporary power, water and a toilet to the site",
        d: "Temporary power pole, a water source for masonry and cleanup, a portable toilet and a dumpster.",
        pro: "A clean, organized site is a safer, faster site. Good builders sort waste and keep materials off the ground." }
    ]
  },
  {
    id: "foundation", name: "Foundation", days: "2–5 weeks", share: 11,
    blurb: "Everything sits on this. It is the one part of the house you can never really redo. Build it like the house depends on it, because it does.",
    who: ["Excavator", "Foundation or concrete crew", "Waterproofing installer", "Plumber (under-slab)", "Structural engineer"],
    steps: [
      { id: "fo1", t: "Excavate to firm, undisturbed soil below the frost line",
        d: "Footings bear on undisturbed or engineer-approved compacted soil, at least 12 inches below grade and below the local frost depth.",
        pro: "If the excavator hits soft spots, fill or water, stop and call the geotech or engineer. Never bury a soft spot.", crit: true },
      { id: "fo2", t: "Set footing forms and rebar exactly per the engineered plans",
        d: "Size, spacing, laps and chairs as drawn. Rebar needs 3 inches of concrete cover where concrete is cast against earth.",
        pro: "Rebar on chairs, never lying in the dirt. Laps tied, corners bent continuous. Add a ground electrode (Ufer) per NEC before the pour." },
      { id: "fo3", t: "Footing inspection before pouring",
        d: "The building inspector checks depth, width, soil, rebar and forms.",
        pro: "Hold point. Have your own inspector look too. Take photos of all rebar with a tape measure in frame.", gate: true },
      { id: "fo4", t: "Pour footings with the specified mix",
        d: "Use the strength the engineer specified (often 3,000–4,000 psi). No water added at the truck to make it flow easier.",
        pro: "Adding water to the truck weakens concrete. Pros use a plasticizer instead and keep the batch ticket for every truck." },
      { id: "fo5", t: "Build foundation walls or stem walls with anchor bolts",
        d: "Anchor bolts (typically 1/2 inch, max 6 feet apart and within 12 inches of each plate end) or straps tie the house to the foundation.",
        pro: "Put a capillary break (foam sill gasket or membrane) between concrete and wood. Concrete wicks water; wood rots." },
      { id: "fo6", t: "Rough-in under-slab plumbing and test it",
        d: "Drain lines under the slab are placed and pressure or water tested.",
        pro: "Hold point. Once the slab is poured, a missed or leaking pipe means jackhammers. Photograph every line with dimensions.", gate: true },
      { id: "fo7", t: "Prep the slab: gravel, vapor barrier, insulation, radon pipe, termite treatment",
        d: "Compacted gravel base, a vapor retarder under the slab, rigid insulation where required, and termite pretreatment in termite regions.",
        pro: "Use a 10–15 mil vapor barrier (ASTM E1745 Class A) with taped seams instead of 6 mil code minimum. Add a passive radon pipe now for a few hundred dollars." },
      { id: "fo8", t: "Pre-pour slab inspection",
        d: "Inspector checks base, barrier, reinforcement, plumbing and any embedded items.",
        pro: "Hold point. Do not let the pump truck arrive until the inspection is signed.", gate: true },
      { id: "fo9", t: "Pour, finish and cure the slab properly",
        d: "Keep concrete moist for at least 7 days (wet cure, curing blankets or curing compound). It reaches design strength around 28 days.",
        pro: "Cut control joints within the first day. Do not load walls on green concrete faster than the engineer allows." },
      { id: "fo10", t: "Waterproof foundation walls and install the footing drain",
        d: "Waterproofing (not just damp-proofing) on basement walls, a perforated drain in washed gravel wrapped in filter fabric at the footing, draining to daylight or a sump.",
        pro: "Add a drainage mat over the waterproofing. Water that can drain never builds pressure against the wall." },
      { id: "fo11", t: "Foundation and drainage inspection before backfill",
        d: "Inspector (and your own) checks waterproofing, drains and wall bracing.",
        pro: "Hold point. Backfill only after walls are braced or the floor is framed, in layers, compacted, with no big rocks or debris against the wall.", gate: true },
      { id: "fo12", t: "Get a foundation location survey",
        d: "Surveyor confirms the foundation is where the plans say and meets setbacks.",
        pro: "Many lenders and towns require it before framing. It catches a setback mistake while it is still fixable." }
    ]
  },
  {
    id: "framing", name: "Framing & dry-in", days: "3–8 weeks", share: 17,
    blurb: "The skeleton and the skin. The goal is a house that is square, plumb, strong and closed against water as fast as possible.",
    who: ["Framing crew", "Roofer", "Window installer", "Truss supplier"],
    steps: [
      { id: "fr1", t: "Check lumber and set sill plates",
        d: "Treated sill plates on the gasket, bolted down. Use lumber at 19% moisture content or less.",
        pro: "Pros check moisture with a pin meter. Wet lumber shrinks after drywall and causes nail pops and cracks." },
      { id: "fr2", t: "Frame floors, walls and stairs to the plans",
        d: "Walls square, plumb and straight. Headers, beams and point loads exactly as engineered.",
        pro: "Check every wall with a string line and level before sheathing. Good framers stack loads straight down to the foundation." },
      { id: "fr3", t: "Set roof trusses or rafters with the specified hardware",
        d: "Truss layout per the truss drawings, bracing per the manufacturer, hurricane ties or clips at each bearing point.",
        pro: "Never cut or notch a truss. Any damaged truss needs a repair letter from the truss engineer." },
      { id: "fr4", t: "Install sheathing, hold-downs and shear nailing",
        d: "Wall and roof sheathing nailed to the engineered schedule, with hold-downs and straps installed.",
        pro: "Overdriven nails cut shear strength. Set nail guns to drive flush. Your inspector should check the nailing pattern." },
      { id: "fr5", t: "Install the water-resistive barrier (house wrap)",
        d: "Lapped shingle-style so water always flows over the layer below, never behind it. Taped seams.",
        pro: "Shingle-fashion is the rule that beats every leak: upper layers over lower layers, always." },
      { id: "fr6", t: "Install windows and doors with sill pans and proper flashing",
        d: "Sloped sill pan, flashing tape in the right order (sill, jambs, head), head flashing over the WRB.",
        pro: "Test a few windows with a hose before siding goes on. Window leaks are the most common source of rot in new homes.", crit: true },
      { id: "fr7", t: "Dry in the roof: underlayment, drip edge, ice barrier, flashing",
        d: "Self-adhered ice barrier at eaves and valleys in cold climates, drip edge, step flashing at every wall and kick-out flashing where a roof meets a wall.",
        pro: "Missing kick-out flashing is one of the most expensive small mistakes in housing. It dumps water into the wall below." },
      { id: "fr8", t: "Framing inspection",
        d: "Usually after rough-ins are done (some towns inspect separately). Checks structure, fire blocking, hold-downs and nailing.",
        pro: "Hold point. Your own inspector walks it too. Fix every item on both lists before insulation.", gate: true }
    ]
  },
  {
    id: "roughin", name: "Rough-ins (plumbing, electrical, HVAC)", days: "2–5 weeks", share: 14,
    blurb: "The pipes, wires and ducts that go inside the walls. Everything here is buried behind drywall, so get it right and document it now.",
    who: ["Plumber", "Electrician", "HVAC contractor", "Low-voltage installer"],
    steps: [
      { id: "r1", t: "Walk the house with each trade before they start",
        d: "Confirm fixture, outlet, switch, light and register locations with the plans in hand. Mark them on the studs.",
        pro: "Best builders do a pre-rough walk with the owner and every trade. It catches the vanity light that would land behind the mirror." },
      { id: "r2", t: "Rough-in plumbing: supply, drains, vents, gas",
        d: "Drains sloped properly (typically 1/4 inch per foot for small lines), vents to the roof, supply lines protected with nail plates.",
        pro: "Use a manifold (home-run) water system with shutoffs for each fixture. Keep water lines out of exterior walls in cold climates." },
      { id: "r3", t: "Rough-in electrical",
        d: "Panel, circuits, boxes and wiring per NEC: GFCI and AFCI protection where required, smoke and CO alarm locations.",
        pro: "Add spare conduit from the panel to the attic and crawlspace, and wire for future EV charging and solar now. It costs little during rough-in." },
      { id: "r4", t: "Rough-in HVAC per the Manual D duct design",
        d: "Equipment location, supply and return ducts, bath and kitchen exhaust to the outside, fresh-air ventilation.",
        pro: "Seal every duct joint with mastic. Every bathroom fan vents outdoors, never into the attic." },
      { id: "r5", t: "Rough-in low voltage: internet, Wi-Fi access points, security, cameras",
        d: "Run network cable to the office, TV spots and ceiling Wi-Fi locations.",
        pro: "Cheap now, painful later. A central network spot with power is worth planning." },
      { id: "r6", t: "Pressure test plumbing and gas lines",
        d: "Drain and supply systems are tested by water or air at the pressure and duration your inspector requires.",
        pro: "Hold point. Leave the test gauge on for the inspector to see.", gate: true },
      { id: "r7", t: "Rough-in inspections: plumbing, electrical, mechanical",
        d: "Each trade’s work is inspected before anything is covered.",
        pro: "Hold point. Never insulate until every rough inspection is passed.", gate: true, crit: true },
      { id: "r8", t: "Photo and video every wall before insulation",
        d: "Go room by room and capture every wall, floor and ceiling with a tape measure visible.",
        pro: "This map is priceless for every future repair, shelf or TV mount. Save it in your project binder.", crit: true }
    ]
  },
  {
    id: "insulation", name: "Air sealing, insulation & drywall", days: "2–5 weeks", share: 0,
    blurb: "The thermal shell. Done well, the house is quiet, comfortable, dry and cheap to run for generations.",
    who: ["Insulation contractor", "Energy rater (blower door)", "Drywall crew"],
    steps: [
      { id: "i1", t: "Air seal every gap and penetration",
        d: "Seal top plates, rim joists, wire and pipe holes, window and door gaps, and the attic hatch.",
        pro: "Air leaks carry far more moisture into walls than vapor through drywall. Air sealing is the cheapest, highest-value step in the whole build.", crit: true },
      { id: "i2", t: "Install insulation to the specified R-values with no gaps",
        d: "Batts cut neatly around wires and boxes, no compression; spray foam or blown insulation per spec.",
        pro: "Grade I install quality matters as much as the R-value printed on the bag." },
      { id: "i3", t: "Insulation and energy inspection",
        d: "Inspector checks R-values, coverage and air sealing.",
        pro: "Hold point. Walk it yourself with a flashlight before drywall.", gate: true },
      { id: "i4", t: "Run a mid-construction blower door test (pre-drywall)",
        d: "A rater depressurizes the house and finds leaks while they are still easy to fix.",
        pro: "Code in most climate zones is 3 air changes per hour at 50 pascals (ACH50) or less. Strong builders target 1.5 or lower; Passive House targets 0.6." },
      { id: "i5", t: "Hang, tape and finish drywall",
        d: "Moisture-resistant board in wet areas, cement board and a waterproofing membrane behind shower tile.",
        pro: "Hold the house at normal temperature and humidity during taping. Order a level 4 or 5 finish where light rakes across walls." },
      { id: "i6", t: "Waterproof and flood-test showers",
        d: "Apply the waterproofing membrane, then plug the drain and fill the pan for 24 hours before tile.",
        pro: "Hold point. A 24-hour flood test is what separates showers that last 40 years from ones that rot the subfloor in five.", gate: true }
    ]
  },
  {
    id: "exterior", name: "Exterior finishes", days: "3–8 weeks", share: 12,
    blurb: "The house’s raincoat and curb appeal. Overlap like shingles, leave air to dry, and send water far away.",
    who: ["Roofer", "Siding installer", "Gutter installer", "Mason", "Excavator for final grade"],
    steps: [
      { id: "e1", t: "Install finished roofing per manufacturer instructions",
        d: "Shingles, metal or tile with the specified nailing and starter course. Ridge and soffit ventilation balanced for vented attics.",
        pro: "Follow the manufacturer’s instructions exactly or the warranty is void. Ask for the enhanced warranty registration." },
      { id: "e2", t: "Install siding over a rainscreen gap",
        d: "Siding with flashing at every window, door, deck ledger and transition.",
        pro: "A 1/4 to 3/4 inch drainage gap behind siding lets the wall dry. It is common practice in Scandinavia and the Pacific Northwest and adds decades of life." },
      { id: "e3", t: "Install gutters and downspouts that discharge far away",
        d: "Downspouts piped or extended at least several feet away, ideally to daylight or a dry well.",
        pro: "Never connect downspouts to the footing drain. That sends roof water straight to the foundation." },
      { id: "e4", t: "Final grade sloping away from the house",
        d: "Ground falls at least 6 inches in 10 feet away from the foundation on all sides; swales carry water around the house.",
        pro: "Keep siding at least 6 inches (8 is better) above soil and 2 inches above roofs and decks.", crit: true },
      { id: "e5", t: "Driveway, walks and patios sloped away",
        d: "Concrete or paving with proper base and slope away from the house.",
        pro: "A patio that slopes toward the house is a foundation leak on a schedule." },
      { id: "e6", t: "Exterior paint, caulk and sealing",
        d: "Prime all cut ends of trim and siding. Caulk where the manufacturer calls for it, and nowhere that blocks drainage.",
        pro: "Back-prime wood siding and trim on all six sides." }
    ]
  },
  {
    id: "interior", name: "Interior finishes", days: "4–10 weeks", share: 25,
    blurb: "What you see and touch every day. Sequence matters: protect finished work from the trades that come after.",
    who: ["Cabinet installer", "Countertop fabricator", "Flooring installer", "Trim carpenter", "Painter", "Tile setter"],
    steps: [
      { id: "n1", t: "Prime and paint walls and ceilings",
        d: "First coats go on before trim and cabinets for clean lines and faster work.",
        pro: "Light the room with a work light at a low angle to catch drywall flaws before paint." },
      { id: "n2", t: "Install cabinets, then template and install countertops",
        d: "Cabinets level and secured to studs. Countertops are measured after cabinets are in.",
        pro: "Check appliance dimensions and clearances against the actual model numbers before cabinets are ordered." },
      { id: "n3", t: "Install tile, flooring and stairs",
        d: "Check subfloor flatness to the flooring maker’s spec. Acclimate wood flooring and measure moisture.",
        pro: "Protect finished floors with breathable floor protection until move-in." },
      { id: "n4", t: "Install interior doors and trim",
        d: "Doors hung plumb with even gaps; casing, base and crown installed.",
        pro: "Look at the reveal around each door. Even gaps tell you the framing was square." },
      { id: "n5", t: "Trim-out plumbing, electrical and HVAC",
        d: "Fixtures, outlets, switches, lights, registers, appliances and water heater connected.",
        pro: "Commission the HVAC: check airflow at each register against the design, and set the refrigerant charge by measurement." },
      { id: "n6", t: "Final paint and touch-up",
        d: "Final coats after trim and fixtures.",
        pro: "Keep labeled leftover paint for every color for future touch-ups." }
    ]
  },
  {
    id: "final", name: "Final inspections, closeout & move-in", days: "2–4 weeks", share: 7,
    blurb: "Finishing well is a discipline. This is where you protect your money and your warranty.",
    who: ["Building inspector", "Your independent inspector", "Lender", "General contractor"],
    steps: [
      { id: "c1", t: "Final trade inspections and the final building inspection",
        d: "Plumbing, electrical, mechanical, energy and building finals.",
        pro: "Hold point. Ask the inspector to point out anything they noted but did not fail.", gate: true },
      { id: "c2", t: "Final blower door test and energy certificate",
        d: "Confirms the airtightness and energy code results.",
        pro: "Keep the report. It adds resale value and proves the house was built tight." },
      { id: "c3", t: "Get the certificate of occupancy (CO)",
        d: "Legal permission to live in the home. Your lender and insurer need it.",
        pro: "Never move in or move furniture in before the CO is issued.", crit: true, gate: true },
      { id: "c4", t: "Do a punch-list walk with your inspector",
        d: "Room by room, write down every defect, gap, scratch and anything not working, with photos.",
        pro: "Use blue tape to mark each item. Put the list in writing and get a completion date.", crit: true },
      { id: "c5", t: "Collect final unconditional lien waivers from the GC, every sub and every supplier",
        d: "Proves everyone who worked on your home has been paid and cannot put a lien on your title.",
        pro: "Release retainage only after the punch list is complete and every final lien waiver is in hand.", crit: true },
      { id: "c6", t: "Collect the closeout package",
        d: "Warranties, manuals, as-built drawings, paint colors, appliance serial numbers, the rough-in photos, inspection reports and contact list for every trade.",
        pro: "Top builders hand over a binder. Ask for it in your contract." },
      { id: "c7", t: "Close the construction loan or convert to your permanent mortgage",
        d: "Final draw and conversion or refinance into the permanent loan.",
        pro: "Get the final title update showing no liens before the last draw is released." },
      { id: "c8", t: "Update insurance, utilities and your property tax record",
        d: "Switch from builder’s risk to a homeowner’s policy before move-in; set utilities in your name.",
        pro: "Ask your insurer about discounts for impact-rated roofing, sprinklers or monitored alarms." }
    ]
  },
  {
    id: "live", name: "Live in it & maintain it", days: "Forever", share: 0,
    blurb: "Houses that last forever are houses that get looked after. The first year tells you everything.",
    who: ["You", "Your builder (warranty)"],
    steps: [
      { id: "v1", t: "Keep a running warranty list from day one",
        d: "Note settling cracks, sticking doors, drafts or leaks as they appear, with photos and dates.",
        pro: "Typical warranty: 1 year workmanship, 2 years systems, 10 years structure. Read yours." },
      { id: "v2", t: "Do an 11-month warranty walk with your inspector",
        d: "Find everything covered under the 1-year warranty and submit it in writing before it expires.",
        pro: "This is the most skipped step in new home ownership and one of the most valuable.", crit: true },
      { id: "v3", t: "Set up a maintenance calendar",
        d: "HVAC filters every 1–3 months, gutters twice a year, caulk and paint checks yearly, roof and attic inspection after big storms, water heater flush yearly, smoke and CO alarm tests monthly.",
        pro: "Walk the outside of the house in a heavy rain once a year. Water tells you the truth." },
      { id: "v4", t: "Watch indoor humidity and test for radon",
        d: "Keep humidity roughly between 30% and 50%. Test radon after you move in.",
        pro: "A $20 hygrometer catches moisture problems before mold does." }
    ]
  }
];

const LOT_GROUPS = [
  { name: "Can I legally build here?", items: [
    { id: "zone", t: "Zoning allows a single-family home", how: "Planning or zoning office. Get it in writing." },
    { id: "setback", t: "Setbacks, height and lot coverage fit my house", how: "Compare the zoning rules to your footprint on the survey." },
    { id: "cc", t: "Deed restrictions and HOA rules allow my plans", how: "Title company: copies of every recorded covenant." },
    { id: "access", t: "Legal road access and a driveway permit is possible", how: "Survey plus road authority." },
    { id: "title", t: "Clean title with no unexpected easements or liens", how: "Title commitment, reviewed by an attorney." }
  ]},
  { name: "Can the ground hold a house?", items: [
    { id: "soil", t: "Soils report shows good bearing and no major issues", how: "Geotechnical engineer, test borings." },
    { id: "slope", t: "Slope is buildable (steep lots cost far more)", how: "Topographic survey. Over about 15% slope, get a builder’s price." },
    { id: "flood", t: "Outside the floodplain or flood costs are budgeted", how: "FEMA Flood Map Service Center." },
    { id: "drain", t: "Water drains away from the building spot", how: "Walk it in heavy rain. Look for standing water and erosion." },
    { id: "env", t: "No wetlands, protected species or contamination", how: "County, state environmental agency, Phase I if past industrial or farm use." }
  ]},
  { name: "Can I get utilities?", items: [
    { id: "water", t: "Public water available, or well records look good", how: "Water utility tap quote, or state well database." },
    { id: "sewer", t: "Public sewer available, or perc test passed", how: "Sewer tap quote, or health department perc test." },
    { id: "power", t: "Power is close and the extension cost is known", how: "Electric utility written quote." },
    { id: "net", t: "Internet and phone service is available", how: "Call providers with the exact address." },
    { id: "gas", t: "Gas or propane available (if wanted)", how: "Gas utility or propane supplier." }
  ]},
  { name: "Does the money work?", items: [
    { id: "fees", t: "Impact fees, tap fees and permit fees are known", how: "Building department fee schedule." },
    { id: "sitecost", t: "Site work cost estimated by an excavator", how: "Walk the lot with an excavator; get a written number." },
    { id: "tax", t: "Property taxes after the house is built are affordable", how: "County assessor. Estimate on the finished value." },
    { id: "insure", t: "Homeowner’s insurance is available and affordable", how: "Call two insurers. Wildfire and flood zones can be hard to insure." },
    { id: "cont", t: "My purchase contract has due diligence contingencies", how: "Your agent or attorney." }
  ]}
];

/* Permits. `when` keys gate them on the profile. */
const PERMITS = [
  { id: "hoa", t: "HOA or architectural review approval", by: "HOA", stage: "Before building permit", when: p => p.hoa },
  { id: "zoning", t: "Zoning or land-use approval (if required)", by: "Planning and zoning", stage: "Before building permit" },
  { id: "site", t: "Site plan approval", by: "Planning or building department", stage: "With building permit" },
  { id: "building", t: "Building permit", by: "Building department", stage: "Before any construction" },
  { id: "grading", t: "Grading or land disturbance permit", by: "County or city engineering", stage: "Before clearing" },
  { id: "npdes", t: "Stormwater (NPDES) construction permit and plan", by: "State environmental agency", stage: "Before clearing", when: p => p.acre },
  { id: "drive", t: "Driveway or curb-cut permit", by: "Road authority (city, county or state DOT)", stage: "Before driveway work" },
  { id: "tree", t: "Tree removal permit (if your town protects trees)", by: "City or county", stage: "Before clearing", when: p => p.trees },
  { id: "demo", t: "Demolition permit", by: "Building department", stage: "Before demolition", when: p => p.demo },
  { id: "flood", t: "Floodplain development permit and elevation certificate", by: "Floodplain administrator", stage: "Before building permit", when: p => p.flood },
  { id: "septic", t: "Septic system permit", by: "Health department", stage: "Before building permit", when: p => p.utilities === "private" },
  { id: "well", t: "Well permit", by: "Health department or state water agency", stage: "Before drilling", when: p => p.utilities === "private" },
  { id: "tap", t: "Water and sewer tap or connection permits", by: "Water and sewer utility", stage: "Before utility work", when: p => p.utilities === "public" },
  { id: "elec", t: "Electrical permit", by: "Building department", stage: "Before electrical rough-in" },
  { id: "plumb", t: "Plumbing permit", by: "Building department", stage: "Before plumbing rough-in" },
  { id: "mech", t: "Mechanical (HVAC) permit", by: "Building department", stage: "Before HVAC rough-in" },
  { id: "gasp", t: "Gas piping permit", by: "Building department or gas utility", stage: "Before gas rough-in", when: p => p.gas },
  { id: "address", t: "Address assignment", by: "County addressing or 911 office", stage: "Before permits or utilities" },
  { id: "co", t: "Certificate of occupancy", by: "Building department", stage: "Before move-in" }
];

const VETTING = [
  "License verified on the state board website, active, no open complaints",
  "General liability certificate sent by the agent, naming you as additional insured",
  "Workers’ comp certificate (or proof of legal exemption)",
  "Three references from homes finished in the last 2 years, all called",
  "One home visited that is 5+ years old",
  "Bid is itemized and lists exclusions and allowances",
  "Proposed schedule with start date and substantial completion date",
  "Checked court records and the Better Business Bureau for lawsuits and liens",
  "Lender approved the builder",
  "Contract reviewed by a construction attorney"
];

const CONTRACT = [
  ["Scope", "Plans listed by sheet and date, the spec and selections sheet attached."],
  ["Price type", "Fixed price, or cost-plus with a guaranteed maximum price (GMP). Avoid open-ended cost-plus as a beginner."],
  ["Allowances", "Each one listed with a dollar amount and what happens if you go over or under."],
  ["Draw schedule", "Payments tied to finished, inspected milestones, never to dates."],
  ["Retainage", "5–10% held from each payment until punch list and final lien waivers."],
  ["Change orders", "In writing, priced, with time impact, signed by both of you before the work starts."],
  ["Lien waivers", "Conditional waiver with every draw request, unconditional after payment, from GC, subs and suppliers."],
  ["Schedule", "Start date, completion date, and what happens if it is late."],
  ["Insurance", "GC carries general liability and workers’ comp; who carries builder’s risk."],
  ["Warranty", "Terms in writing: typically 1 year workmanship, 2 years systems, 10 years structure."],
  ["Inspections", "Your right to have your own inspector on site at named hold points."],
  ["Termination and disputes", "How either side can end the contract, and mediation or arbitration terms."]
];

const RED_FLAGS = [
  "Asks for a large deposit up front (some states cap deposits by law)",
  "Wants cash, or payment to a personal name instead of the company",
  "Says a permit is not needed or offers to build without one",
  "No written contract, or a one-page contract",
  "Bid far below the others with no clear reason",
  "Cannot show a certificate of insurance from their agent",
  "Pushes you to sign today",
  "Will not let your own inspector on site"
];

const PAY_RULES = [
  ["Pay for work done, never work promised", "Every draw matches finished work you or your inspector have seen. Payments stay behind progress, never ahead."],
  ["Keep the deposit small", "Often 10% or less. Some states cap deposits by law. Large deposits are the most common way owners lose money."],
  ["Tie every payment to a passed inspection", "If the inspection for that stage has not passed, the stage is not finished."],
  ["Swap paper for money", "Get a conditional lien waiver with each request. Get the unconditional waiver once the payment clears. Collect them from subs and suppliers too."],
  ["Hold retainage", "Keep 5–10% of each payment until the punch list is done and every final lien waiver is in."],
  ["Pay traceably", "Check, bank transfer or a title company. Never cash. Pay the company named on the contract."],
  ["Change orders before work", "No extra work starts without a signed, priced change order."],
  ["Let a third party hold the money", "On larger builds, a title company or fund-control service can manage draws and collect waivers for you."]
];

const PRINCIPLES = [
  { t: "Water first, always", phase: "design", d: "Most houses die from water. Deflect it (roofs, overhangs, flashing), drain it (rainscreens, footing drains), let it dry, and use materials that survive getting wet. This is the core of Building Science Corporation’s approach to durable houses." },
  { t: "Big roof overhangs", phase: "design", d: "Traditional Japanese, Alpine and Craftsman houses survive centuries partly because their roofs keep rain off the walls. Aim for 18–24 inches or more where design allows." },
  { t: "Shingle-fashion everything", phase: "framing", d: "Every layer overlaps the one below it so water runs outward. Roofing, house wrap, window flashing, all of it." },
  { t: "Send water away from the foundation", phase: "exterior", d: "Grade falls 6 inches in the first 10 feet, gutters discharge far from the house, and footing drains run to daylight or a sump." },
  { t: "Break the capillary path", phase: "foundation", d: "Concrete wicks water like a sponge. Use a heavy vapor barrier under slabs, waterproofing on walls and a gasket under sill plates." },
  { t: "Engineer a continuous load path", phase: "design", d: "Roof to walls to floors to foundation, tied with real hardware. This is what keeps a house standing in high winds and earthquakes." },
  { t: "Build tight, ventilate right", phase: "insulation", d: "Seal air leaks and test with a blower door, then bring in fresh air on purpose with a balanced ventilation system (ERV or HRV). Leaky houses are not healthier; they are just uncontrolled." },
  { t: "Right-size the mechanicals", phase: "design", d: "Manual J, S and D calculations, ducts inside the conditioned space. Smaller, properly sized systems last longer and control humidity." },
  { t: "Concrete is made at the site, not the plant", phase: "foundation", d: "Correct mix, no added water, proper rebar cover, moist cure for 7 days. Most cracked foundations were ruined in the first week." },
  { t: "Dry wood, dry walls", phase: "framing", d: "Frame with lumber at 19% moisture or less, and close walls only when everything is dry." },
  { t: "Code is the minimum", phase: "team", d: "Code is the legal floor. Builders whose homes last a century build above it and hire their own inspector to check." },
  { t: "Document what you bury", phase: "roughin", d: "Photos of every wall, footing and buried pipe before it is covered. The next 100 years of repairs depend on it." },
  { t: "Plan for the next owner", phase: "roughin", d: "Accessible shutoffs, spare conduit, labeled panels, and a home binder. A house that is easy to maintain gets maintained." }
];

const COST_SPLIT = [
  ["Site work", 7], ["Foundation", 11], ["Framing", 17], ["Exterior finishes", 12],
  ["Systems (plumbing, electrical, HVAC)", 14], ["Interior finishes", 25], ["Final steps and cleanup", 7], ["Other", 7]
];

const DRAWS = [
  ["Mobilization and permits", 5, "Permits issued, site staked, erosion control in"],
  ["Foundation complete", 15, "Footing and slab or foundation inspections passed"],
  ["Framed and dried in", 20, "Framing up, roof and windows in"],
  ["Rough-ins passed", 15, "Plumbing, electrical and HVAC rough inspections passed"],
  ["Insulation and drywall", 15, "Insulation inspection passed, drywall finished"],
  ["Exterior and interior finishes", 20, "Siding, roofing, cabinets, flooring, trim"],
  ["Final and certificate of occupancy", 10, "CO issued, punch list complete, final lien waivers in"]
];
