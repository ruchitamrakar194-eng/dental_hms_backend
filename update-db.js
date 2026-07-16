require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const labCases = await prisma.labCase.updateMany({
    where: { dentistName: { contains: 'Michael Chen' } },
    data: { dentistName: 'dd' }
  });
  console.log(`Updated ${labCases.count} lab cases`);

  const appointments = await prisma.appointment.updateMany({
    where: { dentistName: { contains: 'Michael Chen' } },
    data: { dentistName: 'dd' }
  });
  console.log(`Updated ${appointments.count} appointments`);

  const patients = await prisma.patient.updateMany({
    where: { dentistName: { contains: 'Michael Chen' } },
    data: { dentistName: 'dd' }
  });
  console.log(`Updated ${patients.count} patients`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
