'use strict';
const prisma = require('../../config/db');

/**
 * Get daily stats for a specific clinic
 */
const getStats = async (clinicId) => {
  const isGlobal = clinicId === 'all';
  const whereClinic = isGlobal ? {} : { clinicId };

  // 1. Total Patients
  const totalPatients = await prisma.patient.count({
    where: whereClinic
  });

  // 2. Appointments Today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const appointmentsToday = await prisma.appointment.count({
    where: {
      ...whereClinic,
      date: {
        gte: todayStart,
        lt: todayEnd
      }
    }
  });

  // 3. Net Billings (Total Revenue)
  const invoices = await prisma.invoice.findMany({
    where: whereClinic,
    select: { amount: true }
  });
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  // 4. Checked In queue count (active inflow)
  const pendingCases = await prisma.appointment.count({
    where: {
      ...whereClinic,
      workflowStage: 'CHECKED_IN'
    }
  });

  // 5. Generate 6-month chart timeline data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueChart = [];
  const intakeChart = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthIndex = d.getMonth();
    const monthLabel = months[monthIndex];
    const year = d.getFullYear();

    const mStart = new Date(year, monthIndex, 1);
    const mEnd = new Date(year, monthIndex + 1, 1);

    // Monthly revenue
    const mInvoices = await prisma.invoice.findMany({
      where: {
        ...whereClinic,
        date: { gte: mStart, lt: mEnd }
      },
      select: { amount: true }
    });
    const monthlyRev = mInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    revenueChart.push({ month: monthLabel, Revenue: monthlyRev || 0 });

    // Monthly patient registrations count
    const monthlyPats = await prisma.patient.count({
      where: {
        ...whereClinic,
        createdAt: { gte: mStart, lt: mEnd }
      }
    });
    intakeChart.push({ month: monthLabel, Count: monthlyPats || 0 });
  }

  return {
    stats: {
      totalPatients,
      appointmentsToday,
      totalRevenue,
      pendingCases
    },
    revenueChart,
    intakeChart
  };
};

/**
 * Get AI-driven clinic insights (opportunities, recalls, VIP outreach lists)
 */
const getInsights = async (clinicId) => {
  const isGlobal = clinicId === 'all';
  const whereClinic = isGlobal ? {} : { clinicId };

  // 1. Untreated Cases Opportunity
  const untreatedPlans = await prisma.treatmentPlan.findMany({
    where: {
      ...whereClinic,
      status: 'Proposed'
    },
    select: { cost: true }
  });
  const untreatedSum = untreatedPlans.reduce((sum, p) => sum + p.cost, 0);

  // 2. Hygiene Recall Gap
  const totalPats = await prisma.patient.count({ where: whereClinic });
  const futureApts = await prisma.appointment.groupBy({
    by: ['patientId'],
    where: {
      ...whereClinic,
      date: { gte: new Date() }
    }
  });
  const recallGapPct = totalPats > 0
    ? Math.round(((totalPats - futureApts.length) / totalPats) * 100)
    : 0;

  // 3. Top 5 VIP Treatment Opportunities
  const topPlansGroup = await prisma.treatmentPlan.groupBy({
    by: ['patientId'],
    where: {
      ...whereClinic,
      status: 'Proposed'
    },
    _sum: {
      cost: true
    },
    orderBy: {
      _sum: {
        cost: 'desc'
      }
    },
    take: 5
  });

  const topPatients = await Promise.all(
    topPlansGroup.map(async (item, idx) => {
      const pat = await prisma.patient.findFirst({
        where: { id: item.patientId }
      });
      return `${idx + 1}. ${pat?.name || 'Patient'} ($${item._sum.cost || 0})`;
    })
  );

  const subtext = topPatients.length > 0 
    ? topPatients.join('\n') 
    : 'No outstanding proposed procedures.';

  return [
    {
      id: 'bi-1',
      type: 'revenue',
      title: 'Untreated Cases Opportunity',
      desc: `$${untreatedSum.toLocaleString()} untreated treatment opportunities`,
      metric: `$${untreatedSum.toLocaleString()}`,
      subtext: 'High-value cases proposed but not scheduled',
      trend: '+12% this month',
      color: 'from-blue-500/10 to-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-400'
    },
    {
      id: 'bi-2',
      type: 'hygiene',
      title: 'Hygiene Recall Gap',
      desc: `${recallGapPct}% patients overdue for hygiene`,
      metric: `${recallGapPct}%`,
      subtext: 'Overdue for regular 6-month prophylaxis',
      trend: 'Actionable recall list ready',
      color: 'from-rose-500/10 to-amber-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
    },
    {
      id: 'bi-3',
      type: 'top_patients',
      title: 'Top 5 High-Value Patients',
      desc: 'Patients with highest treatment opportunity value',
      metric: 'Top Patients',
      subtext,
      trend: 'Suggested VIP outreach',
      color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
    }
  ];
};

module.exports = {
  getStats,
  getInsights
};
