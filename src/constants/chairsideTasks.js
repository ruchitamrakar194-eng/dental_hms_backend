'use strict';

const DEFAULT_CHAIRSIDE_TASKS = [
  { id: 'ster-1', category: 'Sterilization', text: 'Sanitize and prep treatment chair', completed: false },
  { id: 'ster-2', category: 'Sterilization', text: 'Autoclave dental mirrors and explorers', completed: false },
  { id: 'ster-3', category: 'Sterilization', text: 'Place protective barriers on handles and switches', completed: false },
  { id: 'ster-4', category: 'Sterilization', text: 'Dispose of biohazard waste from previous session', completed: false },
  { id: 'inst-1', category: 'Instrument', text: 'Confirm high-speed handpiece is clean and tracked', completed: false },
  { id: 'inst-2', category: 'Instrument', text: 'Set up high-volume evacuator (suction) tips', completed: false },
  { id: 'inst-3', category: 'Instrument', text: 'Lay out composite restorative materials and curing light', completed: false },
  { id: 'inst-4', category: 'Instrument', text: 'Prepare articulating paper and polishing burs', completed: false },
  { id: 'stage-1', category: 'Stage', text: 'Review patient medical history & vitals', completed: false },
  { id: 'stage-2', category: 'Stage', text: 'Assist dentist during procedure', completed: false },
  { id: 'stage-3', category: 'Stage', text: 'Review post-op care instructions with patient', completed: false },
];

module.exports = { DEFAULT_CHAIRSIDE_TASKS };
