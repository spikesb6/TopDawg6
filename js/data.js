/* ============================================================
   ServiceOS — data model, workflow definition, seed data
   ============================================================ */

const STAGES = [
  'Arrived', 'Checked In', 'Waiting Dispatch', 'Assigned', 'Diagnosis',
  'Waiting Approval', 'Waiting Parts', 'Repair', 'QC', 'Wash', 'Ready', 'Delivered'
];

// Milestones logged to the vehicle timeline when a stage is entered.
const STAGE_MILESTONES = {
  'Arrived':          ['Arrival'],
  'Checked In':       ['Check-In Complete'],
  'Waiting Dispatch': ['Sent to Dispatch'],
  'Assigned':         ['Technician Assigned'],
  'Diagnosis':        ['Diagnosis Started'],
  'Waiting Approval': ['Diagnosis Completed', 'Estimate Sent'],
  'Waiting Parts':    ['Customer Approved', 'Parts Ordered'],
  'Repair':           ['Repair Started'],
  'QC':               ['Repair Completed', 'QC Started'],
  'Wash':             ['QC Passed', 'Wash Started'],
  'Ready':            ['Ready for Delivery'],
  'Delivered':        ['Delivered']
};

// Minutes allowed in each stage before it counts as a bottleneck (red).
// Yellow warning fires at 70% of the SLA.
const SLA = {
  'Arrived': 10,
  'Checked In': 10,
  'Waiting Dispatch': 15,
  'Assigned': 20,          // waiting after assignment / after diagnosis queue
  'Diagnosis': 45,
  'Waiting Approval': 30,
  'Waiting Parts': 30,
  'Repair': 120,
  'QC': 20,
  'Wash': 20,
  'Ready': 60,
  'Delivered': Infinity
};

const ALERT_REASONS = {
  'Arrived':          'Vehicle has not been checked in',
  'Checked In':       'Write-up finished but not sent to dispatch',
  'Waiting Dispatch': 'No technician assigned — dispatch bottleneck',
  'Assigned':         'Technician has not started diagnosis',
  'Diagnosis':        'Diagnosis is running long',
  'Waiting Approval': 'Customer approval is stalling the job',
  'Waiting Parts':    'Parts are holding the repair',
  'QC':               'Vehicle is sitting in quality control',
  'Wash':             'Vehicle is stuck in the wash queue',
  'Ready':            'Customer has not been notified / picked up'
};

// Who owns fixing a stall in each stage.
const STAGE_OWNER = {
  'Arrived': 'Advisor', 'Checked In': 'Advisor', 'Waiting Dispatch': 'Dispatcher',
  'Assigned': 'Technician', 'Diagnosis': 'Technician', 'Waiting Approval': 'Advisor',
  'Waiting Parts': 'Parts', 'Repair': 'Technician', 'QC': 'Technician',
  'Wash': 'Porter', 'Ready': 'Advisor'
};

const ROLES = [
  { id: 'manager',    name: 'Manager',    desc: 'Command center + analytics', home: 'dashboard' },
  { id: 'advisor',    name: 'Advisor',    desc: 'Intake + customer updates',  home: 'intake' },
  { id: 'dispatcher', name: 'Dispatcher', desc: 'Assign work to techs',       home: 'dispatch' },
  { id: 'technician', name: 'Technician', desc: 'Tablet job view',            home: 'tech' },
  { id: 'parts',      name: 'Parts',      desc: 'Parts status board',         home: 'parts' }
];

const ADVISORS = ['Sarah Nguyen', 'Mike Torres', 'Andre Bell'];

const PRIORITIES = ['Normal', 'High', 'Comeback', 'Warranty'];
const PRIORITY_COLOR = { Normal: '', High: 'orange', Comeback: 'purple', Warranty: 'blue' };

const PARTS_STATUSES = ['Needed', 'Ordered', 'Delayed', 'Received', 'Ready'];

/* ------------------------------------------------------------
   Seed data — timestamps are minutes before "now" so the demo
   always loads with a live-looking floor.
   ------------------------------------------------------------ */

function seedState(now = Date.now()) {
  const min = m => now - m * 60000;

  const techs = [
    { id: 't1', name: 'James Okafor',  skill: 'Master Tech',      jobsToday: 3 },
    { id: 't2', name: 'Alex Rivera',   skill: 'Express / Recall', jobsToday: 5 },
    { id: 't3', name: 'Victor Han',    skill: 'Heavy Line',       jobsToday: 2 },
    { id: 't4', name: 'Chris Dalton',  skill: 'Express',          jobsToday: 4 },
    { id: 't5', name: 'Maya Sinclair', skill: 'Drivability',      jobsToday: 3 }
  ];

  // Helper: build a vehicle whose timeline is a list of [milestone, minutesAgo]
  let vid = 0;
  function vehicle(base, stage, timelinePairs) {
    vid += 1;
    return {
      id: 'v' + vid,
      phone: '(555) 201-88' + String(10 + vid),
      vin: '1C4RJFBG' + String(100000 + vid * 137).slice(0, 6),
      mileage: base.mileage || '48,200',
      visitType: base.visitType || 'Appointment',
      custStatus: base.custStatus || 'Drop-off',
      partsStatus: base.partsStatus || null,
      partsNote: base.partsNote || '',
      techId: base.techId || null,
      flag: null,
      ...base,
      status: stage,
      statusSince: min(timelinePairs[timelinePairs.length - 1][1]),
      events: timelinePairs.map(([label, m]) => ({ label, at: min(m) }))
    };
  }

  const vehicles = [
    vehicle(
      { ro: 'RO-1041', customer: 'David Miles', year: '2021', make: 'Dodge', model: 'Charger',
        concern: 'Check engine light on, occasional rough idle at stops.',
        priority: 'High', advisor: 'Mike Torres', custStatus: 'Waiting' },
      'Waiting Dispatch',
      [['Arrival', 52], ['Check-In Complete', 44], ['Sent to Dispatch', 34]]
    ),
    vehicle(
      { ro: 'RO-1042', customer: 'Lisa Carter', year: '2020', make: 'Dodge', model: 'Durango',
        concern: 'Brake pulsation felt at highway speed.',
        priority: 'Normal', advisor: 'Sarah Nguyen', techId: 't1' },
      'Diagnosis',
      [['Arrival', 96], ['Check-In Complete', 90], ['Sent to Dispatch', 84],
       ['Technician Assigned', 71], ['Diagnosis Started', 12]]
    ),
    vehicle(
      { ro: 'RO-1043', customer: 'Anthony Reed', year: '2019', make: 'Ram', model: '2500',
        concern: 'Transmission slipping under load, warranty claim.',
        priority: 'Warranty', advisor: 'Andre Bell', techId: 't3',
        partsStatus: 'Delayed', partsNote: 'Valve body on backorder — ETA tomorrow AM' },
      'Waiting Parts',
      [['Arrival', 260], ['Check-In Complete', 251], ['Sent to Dispatch', 246],
       ['Technician Assigned', 233], ['Diagnosis Started', 228], ['Diagnosis Completed', 178],
       ['Estimate Sent', 174], ['Customer Approved', 96], ['Parts Ordered', 71]]
    ),
    vehicle(
      { ro: 'RO-1044', customer: 'Kim Brooks', year: '2022', make: 'Jeep', model: 'Grand Cherokee',
        concern: 'Oil change plus open recall Z46 (software).',
        priority: 'Normal', advisor: 'Sarah Nguyen', techId: 't2' },
      'Repair',
      [['Arrival', 118], ['Check-In Complete', 111], ['Sent to Dispatch', 107],
       ['Technician Assigned', 99], ['Diagnosis Started', 94], ['Diagnosis Completed', 66],
       ['Estimate Sent', 64], ['Customer Approved', 41], ['Repair Started', 22]]
    ),
    vehicle(
      { ro: 'RO-1045', customer: 'Omar Lewis', year: '2018', make: 'Chrysler', model: '300',
        concern: 'Intermittent no-start, towed in this morning.',
        priority: 'High', advisor: 'Mike Torres', techId: 't1' },
      'Waiting Approval',
      [['Arrival', 170], ['Check-In Complete', 161], ['Sent to Dispatch', 156],
       ['Technician Assigned', 141], ['Diagnosis Started', 132],
       ['Diagnosis Completed', 46], ['Estimate Sent', 39]]
    ),
    vehicle(
      { ro: 'RO-1046', customer: 'Erica Stone', year: '2023', make: 'Dodge', model: 'Hornet',
        concern: 'Software update per TSB, infotainment freezing.',
        priority: 'Normal', advisor: 'Andre Bell', techId: 't2' },
      'QC',
      [['Arrival', 140], ['Check-In Complete', 133], ['Sent to Dispatch', 128],
       ['Technician Assigned', 117], ['Diagnosis Started', 110], ['Diagnosis Completed', 88],
       ['Estimate Sent', 86], ['Customer Approved', 74], ['Repair Started', 62],
       ['Repair Completed', 24], ['QC Started', 24]]
    ),
    vehicle(
      { ro: 'RO-1047', customer: 'Terry Long', year: '2022', make: 'Ram', model: '1500',
        concern: 'Oil leak from upper pan area, spotting driveway.',
        priority: 'High', advisor: 'Sarah Nguyen' },
      'Waiting Dispatch',
      [['Arrival', 27], ['Check-In Complete', 21], ['Sent to Dispatch', 18]]
    ),
    vehicle(
      { ro: 'RO-1048', customer: 'Nina Cole', year: '2021', make: 'Jeep', model: 'Wrangler',
        concern: 'Tire rotation and multi-point inspection.',
        priority: 'Normal', advisor: 'Mike Torres', techId: 't3' },
      'Ready',
      [['Arrival', 150], ['Check-In Complete', 144], ['Sent to Dispatch', 141],
       ['Technician Assigned', 133], ['Diagnosis Started', 128], ['Diagnosis Completed', 112],
       ['Estimate Sent', 110], ['Customer Approved', 98], ['Repair Started', 90],
       ['Repair Completed', 52], ['QC Started', 52], ['QC Passed', 34],
       ['Wash Started', 34], ['Ready for Delivery', 9]]
    ),
    vehicle(
      { ro: 'RO-1049', customer: 'Marcus Webb', year: '2020', make: 'Jeep', model: 'Gladiator',
        concern: 'A/C blows warm on driver side only.',
        priority: 'Normal', advisor: 'Andre Bell', techId: 't5' },
      'Assigned',
      [['Arrival', 58], ['Check-In Complete', 51], ['Sent to Dispatch', 47],
       ['Technician Assigned', 24]]
    ),
    vehicle(
      { ro: 'RO-1050', customer: 'Paula Diaz', year: '2024', make: 'Ram', model: 'ProMaster',
        concern: 'Fleet unit — brake job quoted last week, parts pre-ordered.',
        priority: 'Normal', advisor: 'Sarah Nguyen', techId: 't4',
        partsStatus: 'Received', partsNote: 'Pads + rotors staged at counter, bay 6' },
      'Waiting Parts',
      [['Arrival', 84], ['Check-In Complete', 78], ['Sent to Dispatch', 74],
       ['Technician Assigned', 66], ['Diagnosis Started', 61], ['Diagnosis Completed', 47],
       ['Estimate Sent', 45], ['Customer Approved', 40], ['Parts Ordered', 38]]
    ),
    vehicle(
      { ro: 'RO-1051', customer: 'Grace Kim', year: '2022', make: 'Chrysler', model: 'Pacifica',
        concern: 'Sliding door not closing on first press.',
        priority: 'Comeback', advisor: 'Mike Torres' },
      'Checked In',
      [['Arrival', 16], ['Check-In Complete', 6]]
    ),
    vehicle(
      { ro: 'RO-1052', customer: 'Hank Porter', year: '2019', make: 'Dodge', model: 'Journey',
        concern: 'Coolant smell after long drives.',
        priority: 'Normal', advisor: 'Andre Bell', custStatus: 'Waiting', visitType: 'Walk-in' },
      'Arrived',
      [['Arrival', 4]]
    ),
    vehicle(
      { ro: 'RO-1053', customer: 'Renee Alston', year: '2023', make: 'Jeep', model: 'Compass',
        concern: 'Wind noise from passenger door seal.',
        priority: 'Normal', advisor: 'Sarah Nguyen', techId: 't4' },
      'Wash',
      [['Arrival', 190], ['Check-In Complete', 182], ['Sent to Dispatch', 178],
       ['Technician Assigned', 170], ['Diagnosis Started', 164], ['Diagnosis Completed', 141],
       ['Estimate Sent', 139], ['Customer Approved', 120], ['Repair Started', 108],
       ['Repair Completed', 55], ['QC Started', 55], ['QC Passed', 26], ['Wash Started', 26]]
    ),
    // Delivered vehicles power the cycle-time analytics.
    vehicle(
      { ro: 'RO-1038', customer: 'Sam Otieno', year: '2021', make: 'Ram', model: '1500',
        concern: 'Battery replacement under warranty.',
        priority: 'Warranty', advisor: 'Mike Torres', techId: 't2' },
      'Delivered',
      [['Arrival', 420], ['Check-In Complete', 413], ['Sent to Dispatch', 409],
       ['Technician Assigned', 398], ['Diagnosis Started', 393], ['Diagnosis Completed', 372],
       ['Estimate Sent', 370], ['Customer Approved', 355], ['Repair Started', 344],
       ['Repair Completed', 318], ['QC Started', 318], ['QC Passed', 305],
       ['Wash Started', 305], ['Ready for Delivery', 290], ['Delivered', 246]]
    ),
    vehicle(
      { ro: 'RO-1039', customer: 'Joy Lin', year: '2022', make: 'Jeep', model: 'Cherokee',
        concern: 'Express oil service + cabin filter.',
        priority: 'Normal', advisor: 'Sarah Nguyen', techId: 't4' },
      'Delivered',
      [['Arrival', 350], ['Check-In Complete', 345], ['Sent to Dispatch', 342],
       ['Technician Assigned', 335], ['Diagnosis Started', 331], ['Diagnosis Completed', 322],
       ['Estimate Sent', 321], ['Customer Approved', 315], ['Repair Started', 308],
       ['Repair Completed', 281], ['QC Started', 281], ['QC Passed', 270],
       ['Wash Started', 270], ['Ready for Delivery', 258], ['Delivered', 210]]
    ),
    vehicle(
      { ro: 'RO-1040', customer: 'Ben Ferris', year: '2020', make: 'Dodge', model: 'Challenger',
        concern: 'State inspection + wiper blades.',
        priority: 'Normal', advisor: 'Andre Bell', techId: 't5' },
      'Delivered',
      [['Arrival', 305], ['Check-In Complete', 297], ['Sent to Dispatch', 293],
       ['Technician Assigned', 271], ['Diagnosis Started', 266], ['Diagnosis Completed', 252],
       ['Estimate Sent', 251], ['Customer Approved', 243], ['Repair Started', 236],
       ['Repair Completed', 214], ['QC Started', 214], ['QC Passed', 200],
       ['Wash Started', 200], ['Ready for Delivery', 188], ['Delivered', 121]]
    )
  ];

  return { vehicles, techs, nextRo: 1054, seededAt: now };
}
