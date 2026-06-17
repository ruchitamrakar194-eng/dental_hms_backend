const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const plansBefore = await prisma.plan.findMany();
    console.log('Plans before update:', plansBefore.map(p => p.name));

    const updateResult = await prisma.plan.updateMany({
      where: { name: 'trail' },
      data: { name: 'Trial' }
    });
    console.log('Update result:', updateResult);

    const plansAfter = await prisma.plan.findMany();
    console.log('Plans after update:', plansAfter.map(p => p.name));
  } catch (err) {
    console.error('Error fixing plan name:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
