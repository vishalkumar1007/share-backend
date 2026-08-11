import bcrypt from 'bcryptjs';
import userModel from '../models/userModel.js';

const ADMIN_EMAIL = 'vishalkumarnke93@gmail.com';
const ADMIN_PASSWORD = 'Abc@1234';

/** Upsert the Multiverse admin account (bcrypt hash, never plaintext). */
export const seedAdminUser = async () => {
  const email = ADMIN_EMAIL.toLowerCase();
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await userModel.findOne({ email });

  if (existing) {
    existing.role = 'admin';
    existing.password = hashed;
    if (!existing.firstName) existing.firstName = 'Vishal';
    if (!existing.lastName) existing.lastName = 'Admin';
    await existing.save();
    console.log(`[seed] admin updated: ${email}`);
    return existing;
  }

  const created = await userModel.create({
    firstName: 'Vishal',
    lastName: 'Admin',
    email,
    password: hashed,
    role: 'admin',
  });
  console.log(`[seed] admin created: ${email}`);
  return created;
};

export { ADMIN_EMAIL };
