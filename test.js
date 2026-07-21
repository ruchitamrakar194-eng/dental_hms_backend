require('dotenv').config();
const prisma = require('./src/config/db');
const labCaseService = require('./src/modules/labCases/labCase.service');

async function test() {
  try {
    const cases = await labCaseService.listLabCases({ clinicId: 'clinic-1', userId: 'u1', role: 'dentist' });
    console.log('LIST LAB CASES PERSISTED COMMENTS:');
    cases.forEach(c => {
      console.log(`Case ID: ${c.id} | Type: ${c.type} | Comments Count: ${c.comments ? c.comments.length : 0}`);
    });
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
