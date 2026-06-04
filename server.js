const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { existsSync } = require("fs");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, "inquiries.json");

// ADMIN CREDENTIALS
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Somnath@2026";

const AVAILABLE_CITIES = [
  "Rajkot, Gujarat",
  "Ahmedabad, Gujarat",
  "Surat, Gujarat",
  "Vadodara, Gujarat",
  "Morbi, Gujarat",
  "Jamnagar, Gujarat",
  "Bhavnagar, Gujarat",
  "Mumbai, Maharashtra",
  "Delhi, NCR",
  "Bangalore, Karnataka",
];

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/img", express.static(path.join(__dirname, "img")));

// Session Configuration
app.use(
  session({
    secret: "somnath_secret_key_2026",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 }, // 10 Minutes active session
  }),
);

// Multer Config for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "img")),
  filename: (req, file, cb) =>
    cb(null, "avatar-" + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: storage });

// Global Variables to track login attempts and block time
let loginAttempts = 0;
let blockUntil = null;

// Auth Middleware (Admin session check)
const checkAuth = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Home & Cities Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index1.html"));
});
app.get("/api/cities", (req, res) => {
  res.json(AVAILABLE_CITIES);
});

// Serve Login Page
app.get("/login", (req, res) => {
  // Check if admin is currently blocked
  if (blockUntil && Date.now() < blockUntil) {
    const remainingTime = Math.ceil((blockUntil - Date.now()) / 60000); // Remaining minutes
    return res.send(`
      <script>
        alert('Too many incorrect attempts! Admin panel is blocked. Please try again after ${remainingTime} minutes.');
        window.location.href = '/';
      </script>
    `);
  }
  res.sendFile(path.join(__dirname, "login.html"));
});

// Login Verification API (Called from login.html via buffering)
app.post("/api/verify-login", (req, res) => {
  const { username, password } = req.body;

  // 1. Check if blocked
  if (blockUntil && Date.now() < blockUntil) {
    const remainingTime = Math.ceil((blockUntil - Date.now()) / 60000);
    return res.status(403).json({
      success: false,
      message: `Too many incorrect attempts! Blocked for ${remainingTime} minutes.`,
    });
  }

  // 2. If Username & Password match
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    loginAttempts = 0; // Reset attempts on successful login
    blockUntil = null; // Clear block time
    return res.json({ success: true });
  } else {
    // 3. Handle wrong credentials
    loginAttempts += 1;
    let remainingAttempts = 4 - loginAttempts;

    if (loginAttempts >= 4) {
      blockUntil = Date.now() + 1 * 60 * 60 * 1000; // Current Time + 1 Hour (in milliseconds)
      loginAttempts = 0; // Reset attempts for next cycle after unblock
      return res.json({
        success: false,
        message:
          "4 times wrong password entered! Admin panel is blocked for 1 hour.",
      });
    }

    return res.json({
      success: false,
      message: `Invalid ID or Password! ${remainingAttempts} attempts remaining.`,
    });
  }
});

// Start Onboarding Route
app.get("/start-onboarding", (req, res) => {
  req.session.isAuthenticating = true;
  res.redirect("/onboarding");
});

// Serve Onboarding Page
app.get("/onboarding", (req, res) => {
  if (req.session.isAuthenticating) {
    res.sendFile(path.join(__dirname, "onboarding.html"));
  } else {
    res.redirect("/login");
  }
});

// Save Profile details and Activate full Admin access
app.post(
  "/save-onboarding",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      req.session.isAdmin = true;
      delete req.session.isAuthenticating;
      res.redirect("/admin");
    } catch (error) {
      res.status(500).send("Profile processing failed.");
    }
  },
);

// Logout Route
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Secure Admin Panel Route
app.get("/admin", checkAuth, async (req, res) => {
  let inquiries = [];
  if (existsSync(DATA_FILE)) {
    try {
      inquiries = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    } catch (err) {}
  }
  let rows = inquiries
    .map(
      (item) => `
    <tr>
      <td>${item.clientName}</td>
      <td>${item.phone}</td>
      <td>${item.location}</td>
      <td>${new Date(item.createdAt).toLocaleString()}</td>
    </tr>
  `,
    )
    .join("");

  res.send(`
    <html>
    <head><title>Admin Panel</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-slate-50 font-sans p-8">
      <div class="max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div><h1 class="text-2xl font-bold text-slate-800">Somnath Engineering</h1><p class="text-sm text-slate-500">Inquiries Dashboard</p></div>
          <a href="/logout" class="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors">Logout</a>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-900 text-white">
                <th class="p-4 font-semibold text-sm">Client Name</th>
                <th class="p-4 font-semibold text-sm">Phone Number</th>
                <th class="p-4 font-semibold text-sm">Location</th>
                <th class="p-4 font-semibold text-sm">Date & Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">${rows || '<tr><td colspan="4" class="p-8 text-center text-slate-400">No inquiries received yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Submit Inquiry Route
app.post("/submit-inquiry", async (req, res) => {
  try {
    let { clientName, phone, location } = req.body;
    clientName = clientName?.trim();
    phone = phone?.trim();
    location = location?.trim();
    if (!clientName || !/^[6-9]\d{9}$/.test(phone) || !location)
      return res.status(400).send("Validation Failed");

    const inquiry = {
      id: Date.now(),
      clientName,
      phone,
      location,
      createdAt: new Date().toISOString(),
    };
    let inquiries = [];
    if (existsSync(DATA_FILE)) {
      try {
        inquiries = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
      } catch (err) {}
    }
    inquiries.push(inquiry);
    await fs.writeFile(DATA_FILE, JSON.stringify(inquiries, null, 2));

    res.send(`
      <html><head><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-slate-50 flex items-center justify-center h-screen">
        <div class="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md border border-slate-100">
          <h1 class="text-3xl font-bold text-blue-600 mb-3">✅ Thank You!</h1>
          <p class="text-slate-600 mb-6">Your inquiry has been submitted successfully.</p>
          <a href="/" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold inline-block">Back To Home</a>
        </div>
      </body></html>
    `);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.use((req, res) => {
  res.status(404).send("Page Not Found");
});
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
