'use strict';
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const hashPassword = async (plain) => {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

const comparePassword = async (plain, hashed) => {
  return bcrypt.compare(plain, hashed);
};

module.exports = { hashPassword, comparePassword };
