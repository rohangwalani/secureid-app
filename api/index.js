const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Mock In-Memory Databases
const users = []; 
const challenges = new Map(); 

// Secrets (Use Env Variables in production)
const JWT_SECRET = 'secureid-super-secret-key-12345';
const SESSION_SECRET = 'secureid-session-secret-98765';

// Helper to generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------------------------------------------------------
// 1. REGISTRATION JOURNEY
// ---------------------------------------------------------

// Register
app.post('/api/register', async (req, res) => {
    const { fullName, email, mobile, password } = req.body;
    
    if (!fullName || !email || !mobile || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'User already exists with this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
        id: crypto.randomUUID(),
        fullName,
        email,
        mobile,
        password: hashedPassword,
        emailVerified: false,
        mobileVerified: false,
        mfaEnabled: false
    };
    
    users.push(newUser);
    
    res.status(201).json({ message: 'User created successfully', userId: newUser.id });
});

// Send Email OTP
app.post('/api/send-email-otp', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const otp = generateOTP();
    const challengeId = crypto.randomUUID();
    
    challenges.set(challengeId, {
        userId: user.id,
        channel: 'email',
        otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
        expiresAt: Date.now() + 3 * 60 * 1000, // 3 mins expiry
        attempts: 0,
        maxAttempts: 3
    });
    
    console.log(`\n[SIMULATED EMAIL]`);
    console.log(`To: ${email}`);
    console.log(`Subject: Your SecureID Verification Code`);
    console.log(`OTP: ${otp}\n`);
    
    res.json({ message: 'Email OTP sent', challengeId });
});

// Verify Email OTP
app.post('/api/verify-email-otp', (req, res) => {
    const { challengeId, otp } = req.body;
    const challenge = challenges.get(challengeId);
    
    if (!challenge || challenge.channel !== 'email') {
        return res.status(400).json({ error: 'Invalid challenge' });
    }
    
    if (Date.now() > challenge.expiresAt) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'OTP expired', code: 'EXPIRED' });
    }
    
    challenge.attempts += 1;
    if (challenge.attempts > challenge.maxAttempts) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'Maximum attempts reached', code: 'MAX_ATTEMPTS' });
    }
    
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (inputHash !== challenge.otpHash) {
        return res.status(400).json({ error: 'Incorrect code', code: 'INVALID_OTP', attemptsLeft: challenge.maxAttempts - challenge.attempts });
    }
    
    // Success
    challenges.delete(challengeId);
    const user = users.find(u => u.id === challenge.userId);
    user.emailVerified = true;
    
    res.json({ message: 'Email verified successfully' });
});

// Send SMS OTP
app.post('/api/send-sms-otp', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const otp = generateOTP();
    const challengeId = crypto.randomUUID();
    
    challenges.set(challengeId, {
        userId: user.id,
        channel: 'sms',
        otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
        expiresAt: Date.now() + 3 * 60 * 1000,
        attempts: 0,
        maxAttempts: 3
    });
    
    console.log(`\n[SIMULATED SMS]`);
    console.log(`To: ${user.mobile}`);
    console.log(`OTP: ${otp}\n`);
    
    res.json({ message: 'SMS OTP sent', challengeId });
});

// Verify SMS OTP
app.post('/api/verify-sms-otp', (req, res) => {
    const { challengeId, otp } = req.body;
    const challenge = challenges.get(challengeId);
    
    if (!challenge || challenge.channel !== 'sms') {
        return res.status(400).json({ error: 'Invalid challenge' });
    }
    
    if (Date.now() > challenge.expiresAt) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'OTP expired', code: 'EXPIRED' });
    }
    
    challenge.attempts += 1;
    if (challenge.attempts > challenge.maxAttempts) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'Maximum attempts reached', code: 'MAX_ATTEMPTS' });
    }
    
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (inputHash !== challenge.otpHash) {
        return res.status(400).json({ error: 'Incorrect code', code: 'INVALID_OTP', attemptsLeft: challenge.maxAttempts - challenge.attempts });
    }
    
    // Success
    challenges.delete(challengeId);
    const user = users.find(u => u.id === challenge.userId);
    user.mobileVerified = true;
    user.mfaEnabled = true;
    
    res.json({ message: 'Mobile verified and MFA enabled successfully' });
});


// ---------------------------------------------------------
// 2. LOGIN JOURNEY
// ---------------------------------------------------------

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    // Check lockout
    if (user.lockoutUntil && Date.now() < user.lockoutUntil) {
        return res.status(403).json({ error: 'Account temporarily locked due to too many failed attempts. Try again later.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
            user.lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 mins lockout
        }
        return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    // Reset lockout
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    
    if (!user.mfaEnabled) {
        return res.status(403).json({ error: 'MFA is not enabled on this account.' });
    }
    
    res.json({
        mfaRequired: true,
        email: user.email // sending email so frontend can trigger MFA
    });
});

// Send Login OTP
app.post('/api/send-login-otp', (req, res) => {
    const { email, method } = req.body; // method: 'email' or 'sms'
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const otp = generateOTP();
    const challengeId = crypto.randomUUID();
    
    challenges.set(challengeId, {
        userId: user.id,
        channel: method,
        otpHash: crypto.createHash('sha256').update(otp).digest('hex'),
        expiresAt: Date.now() + 3 * 60 * 1000,
        attempts: 0,
        maxAttempts: 3
    });
    
    if (method === 'email') {
        console.log(`\n[SIMULATED EMAIL - LOGIN]`);
        console.log(`To: ${email}`);
        console.log(`OTP: ${otp}\n`);
    } else {
        console.log(`\n[SIMULATED SMS - LOGIN]`);
        console.log(`To: ${user.mobile}`);
        console.log(`OTP: ${otp}\n`);
    }
    
    res.json({ message: 'Login OTP sent', challengeId });
});

// Verify Login OTP
app.post('/api/verify-login-otp', (req, res) => {
    const { challengeId, otp } = req.body;
    const challenge = challenges.get(challengeId);
    
    if (!challenge) {
        return res.status(400).json({ error: 'Invalid challenge' });
    }
    
    if (Date.now() > challenge.expiresAt) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'OTP expired', code: 'EXPIRED' });
    }
    
    challenge.attempts += 1;
    if (challenge.attempts > challenge.maxAttempts) {
        challenges.delete(challengeId);
        return res.status(400).json({ error: 'Maximum attempts reached', code: 'MAX_ATTEMPTS' });
    }
    
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (inputHash !== challenge.otpHash) {
        return res.status(400).json({ error: 'Incorrect code', code: 'INVALID_OTP', attemptsLeft: challenge.maxAttempts - challenge.attempts });
    }
    
    // Success
    challenges.delete(challengeId);
    
    // Create server-side session
    const sessionId = crypto.randomUUID();
    res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.cookie('userId', challenge.userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 
    });

    res.json({ message: 'Login successful' });
});


// ---------------------------------------------------------
// 3. SESSION / JWT
// ---------------------------------------------------------

// Get Authenticated User (Session-based)
app.get('/api/me', (req, res) => {
    const sessionId = req.cookies.sessionId;
    const userId = req.cookies.userId;
    
    if (!sessionId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        mfaEnabled: user.mfaEnabled
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('sessionId');
    res.clearCookie('userId');
    res.json({ message: 'Logged out successfully' });
});

// Issue JWT Token
app.post('/api/token', (req, res) => {
    const sessionId = req.cookies.sessionId;
    const userId = req.cookies.userId;
    
    if (!sessionId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ token });
});

// Protected Route (JWT-based)
app.get('/api/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ message: 'Access granted', userId: decoded.userId });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});


// Local Dev Server Support
if (require.main === module) {
    const expressApp = express();
    // Serve static files from public directory
    expressApp.use(express.static('public'));
    expressApp.use(app);
    const PORT = process.env.PORT || 3000;
    expressApp.listen(PORT, () => {
        console.log(`SecureID Backend running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
