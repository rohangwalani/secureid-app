const API_URL = '/api';

let loginState = {
    email: '',
    method: 'email', // email, sms, auth
    challengeId: ''
};

// UI Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function selectLoginMfa(method) {
    loginState.method = method;
    document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`mfa-login-${method}`).closest('.radio-card').classList.add('selected');
    document.getElementById(`mfa-login-${method}`).checked = true;
}

document.getElementById('toggle-password').addEventListener('click', () => {
    const p = document.getElementById('password');
    if (p.type === 'password') {
        p.type = 'text';
    } else {
        p.type = 'password';
    }
});

// Login Form Submit
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const emailInput = document.getElementById('email');
    const pwdInput = document.getElementById('password');
    const icon = document.getElementById('email-error-icon');
    
    // Reset errors
    errorEl.style.display = 'none';
    emailInput.classList.remove('error');
    pwdInput.classList.remove('error');
    icon.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (!res.ok) {
            showError('login-error', 'Invalid email or password. Please try again.');
            document.getElementById('email').style.borderColor = 'var(--error-color)';
            document.getElementById('password').style.borderColor = 'var(--error-color)';
            document.getElementById('email-error-icon').style.display = 'block';
            document.getElementById('toggle-password').style.color = 'var(--error-color)';
            return;
        }
        
        document.getElementById('email').style.borderColor = 'var(--border-color)';
        document.getElementById('password').style.borderColor = 'var(--border-color)';
        document.getElementById('email-error-icon').style.display = 'none';
        document.getElementById('toggle-password').style.color = 'var(--text-secondary)';

        if (data.mfaRequired) {
            loginState.email = email;
            showScreen('screen-choose-method');
        } else {
            fetchProfile();
        }
        
    } catch (err) {
        errorEl.textContent = 'Server error. Please try again.';
        errorEl.style.display = 'block';
    }
});

// Trigger MFA OTP
document.getElementById('send-otp-btn').addEventListener('click', async () => {
    if (loginState.method === 'auth') {
        alert('Authenticator App simulation is not hooked to backend in this demo. Please use Email or SMS.');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/send-login-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: loginState.email, method: loginState.method })
        });
        const data = await res.json();
        
        if (!res.ok) {
            alert('Failed to send OTP: ' + data.error);
            return;
        }
        
        loginState.challengeId = data.challengeId;
        
        // Setup Screen
        const iconWrapper = document.getElementById('otp-icon-wrapper');
        const title = document.getElementById('otp-title');
        
        if (loginState.method === 'email') {
            iconWrapper.innerHTML = '<i data-lucide="mail"></i>';
            iconWrapper.style.backgroundColor = '#eff6ff';
            iconWrapper.style.color = '#1d4ed8';
            title.textContent = 'Email Verification';
            document.getElementById('display-target').textContent = loginState.email;
        } else {
            iconWrapper.innerHTML = '<i data-lucide="message-square"></i>';
            iconWrapper.style.backgroundColor = '#dcfce7';
            iconWrapper.style.color = '#16a34a';
            title.textContent = 'Mobile Verification';
            document.getElementById('display-target').textContent = 'your registered mobile';
        }
        lucide.createIcons();
        
        showScreen('screen-verify-otp');
        setupOTPInputs('login-otp-group', verifyLoginOTP);
        startTimer('login-timer', 'resend-login-btn', 165); // 02:45 as per mockup
        
    } catch (err) {
        alert('Server error.');
    }
});


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

async function verifyLoginOTP(otp, group) {
    try {
        const res = await fetch(`${API_URL}/verify-login-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId: loginState.challengeId, otp })
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
            markOTPError(group, 'login-otp-err', errorText);
            return;
        }
        
        // Success
        fetchProfile();
        
    } catch (err) {
        markOTPError(group, 'login-otp-msg', 'Server error.');
    }
}

async function fetchProfile() {
    try {
        const res = await fetch(`${API_URL}/me`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('dash-name').textContent = data.fullName;
            showScreen('screen-dashboard');
        } else {
            showScreen('screen-login');
        }
    } catch (err) {
        showScreen('screen-login');
    }
}

// Check session on load
window.addEventListener('DOMContentLoaded', () => {
    fetchProfile();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST' });
    showScreen('screen-login');
    document.getElementById('login-form').reset();
});

document.getElementById('test-jwt-btn').addEventListener('click', async () => {
    try {
        // 1. Get token
        const tokenRes = await fetch(`${API_URL}/token`, { method: 'POST' });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error('Failed to get JWT token');
        
        // 2. Hit protected route
        const protectedRes = await fetch(`${API_URL}/protected`, {
            headers: { 'Authorization': `Bearer ${tokenData.token}` }
        });
        const protectedData = await protectedRes.json();
        
        if (protectedRes.ok) {
            alert(`JWT Test Success!\nServer says: ${protectedData.message}\nUser ID: ${protectedData.userId}`);
        } else {
            alert(`JWT Test Failed!\nError: ${protectedData.error}`);
        }
    } catch (err) {
        alert(err.message);
    }
});

document.getElementById('resend-login-btn').addEventListener('click', () => {
    document.getElementById('send-otp-btn').click();
});

function startTimer(displayId, btnId, duration, resendDelay = 30) {
    let timer = duration;
    let resendTimer = resendDelay;
    const display = document.getElementById(displayId);
    const displayParent = display.parentElement;
    displayParent.innerHTML = `Code expires in <strong class="text-primary" id="${displayId}"></strong>`;
    const newDisplay = document.getElementById(displayId);
    
    const btn = document.getElementById(btnId);
    btn.disabled = true;
    btn.className = 'link-btn text-primary';
    
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
            btn.className = 'btn';
        }
    }, 1000);
}
