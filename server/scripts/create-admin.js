// Creates an admin account (or turns an existing account into an admin and resets its password).
// Usage (from the server folder):
//   npm run create-admin -- "Your Name" you@example.com "a-strong-password"
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: npm run create-admin -- "Your Name" you@example.com "a-strong-password"');
    process.exitCode = 1;
    return;
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in server/.env');
  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email: email.toLowerCase().trim() });
  const existed = Boolean(user);
  if (!user) user = new User({ name, email });
  user.name = name;
  user.password = password;
  user.role = 'admin';
  await user.save();

  console.log(existed ? `Updated ${user.email}: now an admin, password reset.` : `Created admin account ${user.email}.`);
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
