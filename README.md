# SecureID - Multi-Factor Authentication Flow

This repository contains the implementation for the SecureID IAM Authentication & Registration assignment.

## Features Implemented
- **Pixel-Perfect Responsive UI:** Exactly matches the provided Figma mockups for both Mobile and Web views.
- **Node.js/Express Backend:** Handles all logic for registration, authentication, and session management.
- **MFA Simulation:** Complete simulation of Email and SMS OTP generation and validation.
- **Security Best Practices:** 
  - Passwords hashed using `bcrypt`
  - OTPs hashed using `sha256` (raw OTPs are never stored or returned in API responses)
  - Account lockout after 5 failed login attempts (15-minute lockout)
  - Session cookies configured with `HttpOnly`, `Secure`, and `SameSite: strict`
- **Session & JWT Authentication:** 
  - Standard session authentication for the main dashboard.
  - Dedicated "Test JWT Flow" button on the dashboard to demonstrate stateless `/api/token` and `/api/protected` route authorization.

## How to Run Locally (For Evaluators)

Because this assignment strictly follows the security guideline **"Do not return the OTP in the API response"**, you must run the backend locally to view the simulated OTP codes.

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd secureid-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   node api/index.js
   ```

4. **Access the application:**
   Open your browser and navigate to: [http://localhost:3000/register.html](http://localhost:3000/register.html)

5. **Viewing the OTPs:**
   As you progress through the Registration and Login flows, the simulated Email and SMS OTPs will be printed directly to your terminal console:
   ```text
   [SIMULATED EMAIL]
   To: evaluator@example.com
   Subject: Your SecureID Verification Code
   OTP: 123456
   ```

## Live Deployment (UI Verification)
The frontend UI is also deployed via Vercel for layout verification purposes. Note that to complete the full MFA flow on the live link, access to Vercel Serverless Logs is required to view the generated OTPs. Please use the local running method above for full functional testing.
