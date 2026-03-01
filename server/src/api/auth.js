const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('../services/mailer');
const { db } = require('../db/setup');

// Middleware for authentication
const auth = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [userId] = await db('users').insert({
      username,
      email,
      password: hashedPassword,
      role: 'user'
    });

    // Create JWT token
    const payload = {
      user: {
        id: userId,
        role: 'user'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ msg: 'Registration failed: ' + err.message });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/otp/request
// @desc    Request an OTP to be sent to user's email
// @access  Public
router.post('/otp/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const code = ('' + crypto.randomInt(100000, 999999));
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(code, salt);

    const expiryMinutes = parseInt(process.env.OTP_EXP_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await db('otp_requests').insert({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      verified: false,
      attempts: 0,
    });

    try {
      await sendOtpEmail(email, code);
    } catch (mailErr) {
      console.error('Failed to send OTP email:', mailErr.message);
      // Allow development fallback where code is returned for testing
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({ msg: 'OTP generated (dev mode)', devCode: code });
      }
      return res.status(500).json({ msg: 'Failed to send OTP' });
    }

    res.json({ msg: 'OTP sent' });
  } catch (err) {
    console.error('OTP request error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/otp/verify
// @desc    Verify OTP and return JWT
// @access  Public
router.post('/otp/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ msg: 'Email and code are required' });
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Fetch latest unverified, unexpired OTP for user
    const nowIso = new Date().toISOString();
    const otp = await db('otp_requests')
      .where({ user_id: user.id, verified: false })
      .andWhere('expires_at', '>', nowIso)
      .orderBy('created_at', 'desc')
      .first();

    if (!otp) {
      return res.status(400).json({ msg: 'No valid OTP. Please request a new one.' });
    }

    // Optional: limit attempts
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
    if (otp.attempts >= maxAttempts) {
      return res.status(429).json({ msg: 'Too many attempts. Request a new OTP.' });
    }

    const isMatch = await bcrypt.compare(code, otp.code_hash);
    await db('otp_requests').where({ id: otp.id }).update({ attempts: otp.attempts + 1 });

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid OTP code' });
    }

    await db('otp_requests').where({ id: otp.id }).update({ verified: true });

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'email', 'role', 'created_at')
      .first();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;