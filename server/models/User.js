const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// A shop account. Customers sign up themselves; admins are created with `npm run create-admin`.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Email is invalid'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned from queries unless explicitly asked for
    },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  },
  { timestamps: true }
);

// Hash the password before saving (only when it was set or changed)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare a plain-text password with the stored hash
userSchema.methods.checkPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Never send the password hash to the client
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
