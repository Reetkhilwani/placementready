const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const session = require("express-session");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

// Admin route - properly fetch and pass data to admin.ejs
app.get("/admin", (req, res) => {
    console.log("Admin route accessed");

    // Query users table
    db.query("SELECT * FROM users", (err, users) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).send("Database error when fetching users");
        }
        console.log(`Retrieved ${users.length} users`);

        // Query login_user table
        db.query("SELECT * FROM login_user", (err, login_user) => {
            if (err) {
                console.error("Error fetching login sessions:", err);
                return res.status(500).send("Database error when fetching login sessions");
            }
            console.log(`Retrieved ${login_user.length} login sessions`);

            // Query resumes table
            db.query("SELECT * FROM resumes", (err, resumes) => {
                if (err) {
                    console.error("Error fetching resumes:", err);
                    return res.status(500).send("Database error when fetching resumes");
                }
                console.log(`Retrieved ${resumes.length} resumes`);

                // Render the admin template with all data
                res.render("admin", {
                    users: users,
                    login_user: login_user,
                    resumes: resumes,
                });
            });
        });
    });
});

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup
app.use(
    session({
        secret: "placementSecret",
        resave: false,
        saveUninitialized: true,
    })
);

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "placementReady",
});

db.connect((err) => {
    if (err) {
        console.error("❌ MySQL connection error:", err);
        return;
    }
    console.log("✅ MySQL Connected!");
});

// Routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// Handle POST request for signup
app.post("/signup", (req, res) => {
    // Check if required fields exist
    if (!req.body || !req.body.username || !req.body.password || !req.body.email || !req.body.gender) {
        return res.render("signup", { error: "All fields are required." });
    }

    // Get and trim form data
    const username = String(req.body.username).trim();
    const password = String(req.body.password).trim();
    const email = String(req.body.email).trim();
    const gender = String(req.body.gender).trim();

    // Validate that no field is empty after trimming
    if (!username || !password || !email || !gender) {
        return res.render("signup", { error: "All fields are required and cannot be empty." });
    }

    // Check if username or email already exists in the signup table
    const checkQuery = "SELECT * FROM signup WHERE username = ? OR email = ?";
    db.query(checkQuery, [username, email], (err, results) => {
        if (err) {
            console.error("❌ Error checking user existence:", err);
            return res.status(500).send("Something went wrong!");
        }
        if (results.length > 0) {
            return res.render("signup", { error: "Username or email already exists." });
        }

        // Insert new user into the signup table
        const insertQuery = "INSERT INTO signup (username, password, email, gender) VALUES (?, ?, ?, ?)";
        db.query(insertQuery, [username, password, email, gender], (err, result) => {
            if (err) {
                console.error("❌ Error inserting user:", err);
                return res.status(500).send("Something went wrong!");
            }
            console.log("✅ User registered with ID:", result.insertId);
            
            // Set session and redirect to home page
            req.session.user = username;
            req.session.token = `${result.insertId}-${Date.now()}`;
            res.redirect("/home");
        });
    });
});

// Separate route for login POST (user authentication)
app.post("/user-login", (req, res) => {
    const username = req.body.username.trim();
    const password = req.body.password.trim();
    const checkUserQuery = "SELECT * FROM signup WHERE username = ? AND password = ?";
    db.query(checkUserQuery, [username, password], (err, results) => {
        if (err) {
            console.error("❌ Error during login:", err);
            return res.send(`
                <script>
                    alert('An error occurred during login. Please try again.');
                    window.location.href = '/login';
                </script>
            `);
        }
        if (results.length === 0) {
            // User not found or incorrect credentials
            return res.send(`
                <script>
                    alert('Invalid username or password.');
                    window.location.href = '/login';
                </script>
            `);
        }

        // User found, set session and redirect to home page
        req.session.user = username;
        req.session.token = `${results[0].id}-${Date.now()}`; // Simple session token

        // Redirect directly to home page
        res.redirect("/home");
    });
});

// Log out route
app.post("/logout", (req, res) => {
    const sessionToken = req.session.token;
    const deleteLoginQuery = "DELETE FROM login_user WHERE session_token = ?";
    db.query(deleteLoginQuery, [sessionToken], (err) => {
        if (err) {
            console.error("❌ Error during logout:", err);
            return res.status(500).send("Error during logout.");
        }
        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Error destroying session:", err);
                return res.status(500).send("Error during logout.");
            }
            res.redirect("/login");
        });
    });
});

// All Page Routes
app.get("/home", (req, res) => {
    const username = req.session.user;
    res.render("home", { username });
});
app.get("/aptitude", (req, res) => res.render("aptitude"));
app.get("/communication", (req, res) => res.render("communication"));
app.get("/technical", (req, res) => res.render("technical"));
app.get("/resume", (req, res) => res.render("resume"));
app.get("/about", (req, res) => res.render("about"));
app.get("/services", (req, res) => res.render("services"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/career", (req, res) => res.render("career"));
app.get("/signup", (req, res) => res.render("signup"));

app.post("/submit-resume", (req, res) => {
    const { name, email, phone, objective, education, experience, skills } = req.body;

    const sql = `INSERT INTO resumes (name, email, phone, objective, education, experience, skills)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [name, email, phone, objective, education, experience, skills], (err, result) => {
        if (err) {
            console.error("❌ Error inserting resume:", err);
            return res.status(500).send("Error saving resume.");
        }
        console.log("✅ Resume saved with ID:", result.insertId);
        res.redirect("/home");
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("💥 Uncaught Error:", err.stack);
    res.status(500).send("Something went wrong!");
});

// Server Listener
app.listen(PORT, () => {
    console.log(`🚀 Listening on Port: ${PORT}`);
});





