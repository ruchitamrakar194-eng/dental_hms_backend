const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany({
      where: { name: { contains: 'Amara' } }
    });
    console.log('Amara users in DB:', users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      clinicId: u.clinicId,
      status: u.status
    })));

    const clinics = await prisma.clinic.findMany();
    console.log('Clinics in DB:', clinics.map(c => ({ id: c.id, name: c.name })));

    const patients = await prisma.patient.findMany();
    console.log('Patients in DB:', patients.map(p => ({
      id: p.id,
      name: p.name,
      clinicId: p.clinicId
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
