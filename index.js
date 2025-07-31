// backend/index.js

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios'); // For making HTTP requests to TMDb
const cors = require('cors'); // For handling Cross-Origin Resource Sharing
const { Pool } = require('pg'); // PostgreSQL client

// --- New imports for Authentication ---
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JSON Web Tokens

const app = express();
const PORT = process.env.PORT || 5000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET; // Your secret key for JWTs

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes (important for frontend communication)
app.use(express.json()); // Parse JSON request bodies

// --- PostgreSQL Database Connection Pool ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test database connection on startup
pool.connect()
    .then(client => {
        console.log('Connected to PostgreSQL database for authentication!');
        client.release();
    })
    .catch(err => {
        console.error('Error connecting to PostgreSQL database:', err.stack);
        console.error('Please ensure your PostgreSQL server is running and .env DATABASE_URL is correct.');
        process.exit(1);
    });

// --- JWT Authentication Middleware ---
// This function will protect routes by verifying the JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' }); // No token provided
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ message: 'Invalid or expired token.' }); // Token is not valid
        }
        req.user = user; // Add user payload to the request object
        next(); // Proceed to the next middleware/route handler
    });
};


// --- Routes ---

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Movie Recommendation Backend API!');
});

// --- Authentication Routes ---

// POST /api/auth/register - User Registration
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        // Check if username already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: 'Username already taken.' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10); // Generate a salt for hashing
        const passwordHash = await bcrypt.hash(password, salt); // Hash the password

        // Insert new user into the database
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
            [username, passwordHash]
        );

        // Generate JWT for the new user immediately
        const user = { id: result.rows[0].id, username: result.rows[0].username };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.status(201).json({ message: 'User registered successfully.', token, user: result.rows[0] });

    } catch (err) {
        console.error('Error during user registration:', err.stack);
        // Handle PostgreSQL unique violation error code for username if it happens despite explicit check
        if (err.code === '23505') {
             return res.status(409).json({ message: 'Username already taken.' });
        }
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// POST /api/auth/login - User Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Find user by username
        const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' }); // User not found
        }

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' }); // Passwords don't match
        }

        // Generate JWT
        const payload = { id: user.id, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.status(200).json({ message: 'Logged in successfully.', token, user: { id: user.id, username: user.username } });

    } catch (err) {
        console.error('Error during user login:', err.stack);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// --- TMDb Movie Routes (Now potentially protected or remain public) ---

// Search movies from TMDb (remains public for now)
app.get('/api/movies/search', async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ message: 'Search query is required.' });
    }

    try {
        const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                language: 'en-US',
                page: 1
            }
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error searching movies from TMDb:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            return res.status(503).json({ message: 'No response from TMDb API. Service unavailable.' });
        } else {
            return res.status(500).json({ message: 'Error processing movie search request.' });
        }
    }
});

// Get popular movies from TMDb (remains public for now)
app.get('/api/movies/popular', async (req, res) => {
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/popular', {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            }
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching popular movies from TMDb:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        } else {
            return res.status(500).json({ message: 'Error fetching popular movies.' });
        }
    }
});

// --- Protected Route Example ---
// This route can only be accessed by authenticated users
app.get('/api/protected', authenticateToken, (req, res) => {
    res.status(200).json({
        message: `Welcome, ${req.user.username}! You accessed a protected route.`,
        userId: req.user.id
    });
});

// --- Error Handling for Invalid Routes (404 Not Found) ---
app.use((req, res, next) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong on the server.' });
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Authentication routes: /api/auth/register, /api/auth/login`);
    console.log(`Movie routes: /api/movies/popular, /api/movies/search`);
    console.log(`Protected route example: /api/protected`);
});