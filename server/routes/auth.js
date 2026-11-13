const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const createToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });

// SIGN UP  →  POST /api/auth/register   body: { name, email, password }
// New accounts are always customers (admins are created with `npm run create-admin`).
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  const user = await User.create({
    name: name == null ? undefined : String(name),
    email: email == null ? undefined : String(email),
    password: password == null ? undefined : String(password),
  });
  res.status(201).json({ token: createToken(user), user });
});

// LOG IN  →  POST /api/auth/login   body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // String(...) makes sure nobody can send an object here to trick the query
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');

  // Same message for "no such user" and "wrong password", so it doesn't reveal which emails exist
  if (!user || !(await user.checkPassword(String(password)))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({ token: createToken(user), user });
});

// WHO AM I  →  GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// EDIT MY DETAILS  →  PUT /api/auth/me   body: { name, email }
// (role and password can't be changed here)
router.put('/me', requireAuth, async (req, res) => {
  const { name, email } = req.body || {};
  if (name !== undefined) req.user.name = String(name);
  if (email !== undefined) req.user.email = String(email);
  await req.user.save(); // runs the schema rules; a taken email gives a 409 (see app.js)
  res.json(req.user);
});

// CHANGE MY PASSWORD  →  PUT /api/auth/me/password   body: { currentPassword, newPassword }
router.put('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Enter your current password and a new password' });
  }
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.checkPassword(String(currentPassword)))) {
    return res.status(400).json({ message: 'Your current password is incorrect' });
  }
  if (String(newPassword) === String(currentPassword)) {
    return res.status(400).json({ message: 'The new password must be different from the current one' });
  }
  user.password = String(newPassword); // hashed by the model before saving (min. 8 characters)
  await user.save();
  res.json({ message: 'Password changed' });
});

module.exports = router;
