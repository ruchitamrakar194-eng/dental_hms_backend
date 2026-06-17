const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const dentists = await prisma.user.findMany({
      where: { role: 'dentist' }
    });
    console.log('Dentists in database:', dentists.map(d => ({
      id: d.id,
      name: d.name,
      assistantId: d.assistantId,
      hygienistId: d.hygienistId
    })));

    const assistants = await prisma.user.findMany({
      where: { role: 'dental_assistant' }
    });
    console.log('Assistants in database:', assistants.map(a => ({ id: a.id, name: a.name })));

    const hygienists = await prisma.user.findMany({
      where: { role: 'hygienist' }
    });
    console.log('Hygienists in database:', hygienists.map(h => ({ id: h.id, name: h.name })));

    // Let's link the first dentist to the first assistant and hygienist if they exist
    if (dentists.length > 0) {
      const dentist = dentists[0];
      const assistant = assistants[0];
      const hygienist = hygienists[0];

      if (assistant || hygienist) {
        const updateData = {};
        if (assistant) updateData.assistantId = assistant.id;
        if (hygienist) updateData.hygienistId = hygienist.id;

        const updated = await prisma.user.update({
          where: { id: dentist.id },
          data: updateData
        });
        console.log(`Updated dentist ${dentist.name}:`, {
          name: updated.name,
          assistantId: updated.assistantId,
          hygienistId: updated.hygienistId
        });
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
