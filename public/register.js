const API_URL = '/api';

// State
let currentUser = {
    email: '',
    mobile: '',
    emailChallengeId: '',
    mobileChallengeId: ''
};

// UI Navigation
function showScreen(screenId, stepNumber) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Update dots
    document.querySelectorAll('.step-dot').forEach(d => {
        d.classList.remove('active');
        d.style.backgroundColor = 'var(--bg-color)';
        d.style.color = 'var(--text-secondary)';
        
        if (parseInt(d.id.split('-')[1]) <= stepNumber) {
            d.classList.add('active');
            d.style.backgroundColor = 'var(--primary-color)';
            d.style.color = 'white';
        }
    });
}

function selectMfa(method) {
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`mfa-${method}`).closest('.radio-card').classList.add('selected');
    document.getElementById(`mfa-${method}`).checked = true;
}

// Password Strength
const passwordInput = document.getElementById('password');
const reqLength = document.getElementById('req-length');
const reqUpper = document.getElementById('req-upper');
const reqNumber = document.getElementById('req-number');
const reqSpecial = document.getElementById('req-special');
const strengthText = document.getElementById('strength-text');

passwordInput.addEventListener('input', (e) => {
    const p = e.target.value;
    let score = 0;
    
    // Check Length
    if (p.length >= 8) { reqLength.classList.add('valid'); score++; }
    else { reqLength.classList.remove('valid'); }
    
    // Check Upper
    if (/[A-Z]/.test(p)) { reqUpper.classList.add('valid'); score++; }
    else { reqUpper.classList.remove('valid'); }
    
    // Check Number
    if (/[0-9]/.test(p)) { reqNumber.classList.add('valid'); score++; }
    else { reqNumber.classList.remove('valid'); }
    
    // Check Special
    if (/[^A-Za-z0-9]/.test(p)) { reqSpecial.classList.add('valid'); score++; }
    else { reqSpecial.classList.remove('valid'); }
    
    if (score === 0) strengthText.textContent = '';
    else if (score <= 2) { strengthText.textContent = 'Weak'; strengthText.style.color = 'var(--error-color)'; }
    else if (score === 3) { strengthText.textContent = 'Medium'; strengthText.style.color = '#eab308'; }
    else { strengthText.textContent = 'Strong'; strengthText.style.color = 'var(--success-color)'; }
});

document.getElementById('toggle-password').addEventListener('click', () => {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
    } else {
        passwordInput.type = 'password';
    }
});

// Registration Form Submit
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = passwordInput.value;
    if (p.length < 8 || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
        showError('register-error', 'Password does not meet minimum strength requirements.');
        return;
    }
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const mobile = document.getElementById('mobile').value;
    
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, mobile, password: p })
        });
        const data = await res.json();
        
        if (!res.ok) {
            showError('register-error', data.error);
            return;
        }
        
        currentUser.email = email;
        currentUser.mobile = mobile;
        
        // Trigger Email OTP
        await triggerEmailOTP();
        
    } catch (err) {
        showError('register-error', 'Server error. Please try again.');
    }
});

async function triggerEmailOTP() {
    const res = await fetch(`${API_URL}/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
    });
    const data = await res.json();
    currentUser.emailChallengeId = data.challengeId;
    
    document.getElementById('display-email').textContent = currentUser.email;
    showScreen('screen-email-otp', 2);
    setupOTPInputs('email-otp-group', verifyEmailOTP);
    startTimer('email-timer', 'resend-email-btn', 180);
}

// OTP Input Handling
function setupOTPInputs(groupId, callback) {
    const group = document.getElementById(groupId);
    const oldInputs = Array.from(group.querySelectorAll('input'));
    
    // Replace nodes to clear old listeners completely
    oldInputs.forEach(input => {
        const newIn = input.cloneNode(true);
        newIn.value = '';
        newIn.classList.remove('error');
        input.parentNode.replaceChild(newIn, input);
    });
    
    const inputs = Array.from(group.querySelectorAll('input'));
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            // Force numeric only
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            
            if (e.target.value !== '' && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            
            const allFilled = inputs.every(i => i.value !== '');
            if (allFilled) {
                const otp = inputs.map(i => i.value).join('');
                callback(otp, group);
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });
    
    // Wait for screen transition animation (300ms) to complete before focusing
    setTimeout(() => {
        if(inputs[0]) inputs[0].focus();
    }, 400);
}

function markOTPError(group, msgElementId, msg) {
    const inputs = group.querySelectorAll('input');
    inputs.forEach(i => i.classList.add('error'));
    const msgEl = document.getElementById(msgElementId);
    msgEl.innerHTML = `<span class="text-error">${msg}</span>`;
}

async function verifyEmailOTP(otp, group) {
    try {
        const res = await fetch(`${API_URL}/verify-email-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId: currentUser.emailChallengeId, otp })
        });
        const data = await res.json();
        
        if (!res.ok) {
            let errorText = 'Incorrect code. Please try again.';
            if (data.attemptsLeft !== undefined) {
                errorText += `<br>You have ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left.`;
            }
            if (data.error === 'Maximum attempts reached') {
                errorText = 'Maximum attempts reached.<br>Please request a new code.';
            }
            markOTPError(group, 'email-otp-err', errorText);
            return;
        }
        
        // Success
        await triggerMobileOTP();
        
    } catch (err) {
        markOTPError(group, 'email-otp-msg', 'Server error.');
    }
}

async function triggerMobileOTP() {
    const res = await fetch(`${API_URL}/send-sms-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
    });
    const data = await res.json();
    currentUser.mobileChallengeId = data.challengeId;
    
    document.getElementById('display-mobile').textContent = '+91 ' + currentUser.mobile;
    showScreen('screen-mobile-otp', 3);
    setupOTPInputs('mobile-otp-group', verifyMobileOTP);
    startTimer('mobile-timer', 'resend-mobile-btn', 180);
}

async function verifyMobileOTP(otp, group) {
    try {
        const res = await fetch(`${API_URL}/verify-sms-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId: currentUser.mobileChallengeId, otp })
        });
        const data = await res.json();
        
        if (!res.ok) {
            let errorText = 'Incorrect code. Please try again.';
            if (data.attemptsLeft !== undefined) {
                errorText += `<br>You have ${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left.`;
            }
            if (data.error === 'Maximum attempts reached') {
                errorText = 'Maximum attempts reached.<br>Please request a new code.';
            }
            markOTPError(group, 'mobile-otp-err', errorText);
            return;
        }
        
        // Success, move to MFA setup (mock selection)
        showScreen('screen-setup-mfa', 4);
        
    } catch (err) {
        markOTPError(group, 'mobile-otp-msg', 'Server error.');
    }
}

function handleMfaSelection() {
    if (document.getElementById('mfa-auth').checked) {
        showScreen('screen-authenticator-setup', 4);
    } else {
        finishRegistration();
    }
}

// Add listeners for the authenticator verification dynamically
// We mock this by accepting any 6 digits since the backend only natively does email/sms right now
document.addEventListener('DOMContentLoaded', () => {
    // We can just setup OTP inputs for auth when the screen is shown, or pre-bind it if we want.
    // It's cleaner to bind it when they navigate, but since it's mock, we'll just check it when they type.
});

// We need to trigger the auth OTP setup when screen 6 is shown.
const originalShowScreen = showScreen;
showScreen = function(screenId, stepNumber) {
    originalShowScreen(screenId, stepNumber);
    if (screenId === 'screen-mfa-verification') {
        setupOTPInputs('auth-otp-group', (otp, group) => {
            // Mock success for any 6 digit authenticator code
            setTimeout(() => {
                finishRegistration();
            }, 500);
        });
        startTimer('auth-timer', 'auth-timer', 30);
    }
};

function finishRegistration() {
    showScreen('screen-success', 5);
}

// Utils
function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
}

function startTimer(displayId, btnId, duration, resendDelay = 30) {
    let timer = duration;
    let resendTimer = resendDelay;
    const display = document.getElementById(displayId);
    const displayParent = display.parentElement;
    displayParent.innerHTML = `Code expires in <strong class="text-primary" id="${displayId}"></strong>`;
    const newDisplay = document.getElementById(displayId);
    
    const btn = document.getElementById(btnId);
    btn.disabled = true;
    btn.className = 'link-btn text-primary'; // Reset to link
    
    clearInterval(window[`interval_${displayId}`]);
    
    window[`interval_${displayId}`] = setInterval(() => {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);
        newDisplay.textContent = `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
        
        if (resendTimer > 0) {
            btn.textContent = `Resend code (00:${resendTimer < 10 ? "0" : ""}${resendTimer})`;
            resendTimer--;
        } else if (resendTimer === 0) {
            btn.textContent = `Resend code`;
            btn.disabled = false;
            resendTimer--;
        }

        if (--timer < 0) {
            clearInterval(window[`interval_${displayId}`]);
            displayParent.innerHTML = `<span class="text-error" style="font-weight: 500;">This code has expired.</span>`;
            btn.disabled = false;
            btn.textContent = 'Resend New Code';
            btn.className = 'btn'; // Make it a solid button
        }
    }, 1000);
}

document.getElementById('resend-email-btn').addEventListener('click', triggerEmailOTP);
document.getElementById('resend-mobile-btn').addEventListener('click', triggerMobileOTP);
