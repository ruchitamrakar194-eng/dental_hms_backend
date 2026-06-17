'use strict';

// Matches frontend authStore role list exactly
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CLINIC_OWNER: 'clinic_owner',
  DENTIST: 'dentist',
  HYGIENIST: 'hygienist',
  FRONT_DESK: 'front_desk',
  BILLING_STAFF: 'billing_staff',
  LAB_COORDINATOR: 'lab_coordinator',
  DENTAL_ASSISTANT: 'dental_assistant',
  PATIENT: 'patient',
};

// Role hierarchy — higher index = more access
const ROLE_HIERARCHY = [
  ROLES.PATIENT,
  ROLES.DENTAL_ASSISTANT,
  ROLES.HYGIENIST,
  ROLES.FRONT_DESK,
  ROLES.LAB_COORDINATOR,
  ROLES.BILLING_STAFF,
  ROLES.DENTIST,
  ROLES.CLINIC_OWNER,
  ROLES.SUPER_ADMIN,
];

// Roles that are clinic-scoped (must have clinicId)
const CLINIC_SCOPED_ROLES = [
  ROLES.CLINIC_OWNER,
  ROLES.DENTIST,
  ROLES.HYGIENIST,
  ROLES.FRONT_DESK,
  ROLES.BILLING_STAFF,
  ROLES.LAB_COORDINATOR,
  ROLES.DENTAL_ASSISTANT,
  ROLES.PATIENT,
];

module.exports = { ROLES, ROLE_HIERARCHY, CLINIC_SCOPED_ROLES };
