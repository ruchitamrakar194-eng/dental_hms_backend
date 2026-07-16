require('dotenv').config();
const clinicService = require('./src/modules/clinics/clinic.service');

async function test() {
  try {
    const res = await clinicService.deleteClinic('817d953e-d31c-4ebb-9256-c5e005f27c15');
    console.log('SUCCESS:', res);
  } catch(e) {
    console.error('ERROR:', e);
  }
}
test();
