const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedPatientData() {
  try {
    // 1. Find a patient
    let patient = await prisma.patient.findFirst({
      where: { name: { contains: 'James' } }
    });

    if (!patient) {
      patient = await prisma.patient.findFirst();
    }

    if (!patient) {
      console.log('No patient found in the database to seed data for.');
      return;
    }

    console.log(`Seeding data for Patient: ${patient.name} (ID: ${patient.id})`);
    const clinicId = patient.clinicId;

    // 2. Add an Appointment
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        patientId: patient.id,
        patientName: patient.name,
        dentistName: 'Dr. Michael Chen',
        type: 'General Checkup',
        date: new Date(new Date().setDate(new Date().getDate() + 2)), // 2 days from now
        time: '10:00 AM',
        duration: 45,
        status: 'Scheduled',
        notes: 'Patient requested a general cleaning and checkup.'
      }
    });
    console.log(`Created Appointment: ${appointment.id}`);

    // 3. Add Treatment Plans
    await prisma.treatmentPlan.createMany({
      data: [
        {
          clinicId,
          patientId: patient.id,
          tooth: '8',
          procedure: 'Porcelain Crown',
          cost: 1200.0,
          status: 'Proposed'
        },
        {
          clinicId,
          patientId: patient.id,
          tooth: '14',
          procedure: 'Root Canal',
          cost: 850.0,
          status: 'Completed'
        },
        {
          clinicId,
          patientId: patient.id,
          tooth: '15',
          procedure: 'Composite Filling',
          cost: 250.0,
          status: 'Accepted'
        }
      ]
    });
    console.log('Created Treatment Plans');

    // 4. Add Odontogram
    const chartData = JSON.stringify({
      '8': 'Cavity',
      '14': 'Crown',
      '15': 'Healthy'
    });
    
    await prisma.odontogram.upsert({
      where: { patientId: patient.id },
      update: { chartData },
      create: { clinicId, patientId: patient.id, chartData }
    });
    console.log('Created Odontogram');

    // 5. Add Invoices
    await prisma.invoice.createMany({
      data: [
        {
          clinicId,
          patientId: patient.id,
          patientName: patient.name,
          date: new Date(),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
          amount: 850.0,
          patientPaid: 100.0,
          insurancePaid: 500.0,
          status: 'Partial',
          items: JSON.stringify([{ description: 'Root Canal', cost: 850.0 }])
        },
        {
          clinicId,
          patientId: patient.id,
          patientName: patient.name,
          date: new Date(),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          amount: 250.0,
          patientPaid: 0.0,
          insurancePaid: 0.0,
          status: 'Unpaid',
          items: JSON.stringify([{ description: 'Composite Filling', cost: 250.0 }])
        }
      ]
    });
    console.log('Created Invoices');

    // 6. Add Prescription
    await prisma.prescription.create({
      data: {
        clinicId,
        patientId: patient.id,
        drug: 'Amoxicillin 500mg',
        dosage: '1 Capsule',
        frequency: '3 times a day',
        duration: '7 Days',
        date: new Date()
      }
    });
    console.log('Created Prescription');

    // 7. Add Lab Case
    await prisma.labCase.create({
      data: {
        clinicId,
        patientId: patient.id,
        patientName: patient.name,
        dentistName: 'Dr. Michael Chen',
        type: 'Crown',
        status: 'Sent',
        expectedDelivery: new Date(new Date().setDate(new Date().getDate() + 7)),
        cost: 300.0,
        notes: 'Please match shade A1 perfectly.',
        attachments: '[]',
        labName: 'Precision Dental Labs',
        crownDetails: {
          create: {
            toothNumber: '8',
            material: 'Zirconia',
            shade: 'A1',
            notes: 'High translucency'
          }
        }
      }
    });
    console.log('Created Lab Case');

    console.log('Successfully seeded all patient data!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPatientData();
