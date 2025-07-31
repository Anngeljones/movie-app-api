// frontend/script.js

// --- DOM Elements ---
const showLoginFormBtn = document.getElementById('showLoginFormBtn');
const showRegisterFormBtn = document.getElementById('showRegisterFormBtn');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeMessageSpan = document.getElementById('welcomeMessage');

const authFormsSection = document.getElementById('authForms');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginMessage = document.getElementById('loginMessage');

const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');
const registerMessage = document.getElementById('registerMessage');

const movieContentSection = document.getElementById('movieContent');
const movieSearchInput = document.getElementById('movieSearchInput');
const movieSearchBtn = document.getElementById('movieSearchBtn');
const searchMessage = document.getElementById('searchMessage');
const searchResultsContainer = document.getElementById('searchResultsContainer');

const loadPopularMoviesBtn = document.getElementById('loadPopularMoviesBtn');
const popularMoviesMessage = document.getElementById('popularMoviesMessage');
const popularMoviesContainer = document.getElementById('popularMoviesContainer');

const protectedMessage = document.getElementById('protectedMessage');
const recommendedMoviesContainer = document.getElementById('recommendedMoviesContainer');


// --- Configuration ---
const BACKEND_URL = 'http://localhost:5000'; // IMPORTANT: Your backend URL

// --- Helper Functions ---

// Function to store and retrieve token/user from local storage
const setAuthData = (token, username) => {
    localStorage.setItem('jwtToken', token);
    localStorage.setItem('username', username);
    updateUI();
};

const getAuthData = () => {
    return {
        token: localStorage.getItem('jwtToken'),
        username: localStorage.getItem('username')
    };
};

const clearAuthData = () => {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('username');
    updateUI();
};

// Function to update UI based on authentication status
const updateUI = () => {
    const { token, username } = getAuthData();

    if (token && username) {
        // User is logged in
        showLoginFormBtn.style.display = 'none';
        showRegisterFormBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        welcomeMessageSpan.style.display = 'inline-block';
        welcomeMessageSpan.textContent = `Welcome, ${username}!`;
        authFormsSection.classList.add('hidden'); // Hide auth forms
        movieContentSection.classList.remove('hidden'); // Show movie content
    } else {
        // User is logged out
        showLoginFormBtn.style.display = 'inline-block';
        showRegisterFormBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        welcomeMessageSpan.style.display = 'none';
        welcomeMessageSpan.textContent = '';
        // Initially hide auth forms, let buttons control visibility
        // authFormsSection.classList.remove('hidden'); // This might be desired later
        movieContentSection.classList.add('hidden'); // Hide movie content
    }
};

// Function to display messages
const displayMessage = (element, message, type = 'success') => {
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000); // Hide after 5 seconds
};

// Function to render movie cards
const renderMovies = (container, movies) => {
    container.innerHTML = ''; // Clear previous movies
    if (!movies || movies.length === 0) {
        container.innerHTML = '<p>No movies found.</p>';
        return;
    }
    movies.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');

        const posterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : 'https://via.placeholder.com/185x278?text=No+Image';
        const title = movie.title || 'Untitled';
        const releaseDate = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'; // Get year

        movieCard.innerHTML = `
            <img src="${posterPath}" alt="${title} Poster">
            <h4>${title}</h4>
            <p>(${releaseDate})</p>
        `;
        container.appendChild(movieCard);
    });
};

// --- API Call Functions ---

// Generic fetch function for backend calls
const fetchBackend = async (endpoint, options = {}) => {
    const { token } = getAuthData();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers // Allow overriding or adding headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            ...options,
            headers
        });
        const data = await response.json();

        if (!response.ok) {
            // If response is not ok (e.g., 401, 403, 400, 500)
            throw new Error(data.message || 'Something went wrong with the API request.');
        }
        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error; // Re-throw to be caught by specific event handlers
    }
};

// Authentication functions
const handleRegister = async () => {
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;

    try {
        const data = await fetchBackend('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        displayMessage(registerMessage, data.message, 'success');
        setAuthData(data.token, data.user.username); // Log in immediately after register
        registerForm.classList.add('hidden'); // Hide registration form
    } catch (error) {
        displayMessage(registerMessage, error.message, 'error');
    }
};

const handleLogin = async () => {
    const username = loginUsernameInput.value;
    const password = loginPasswordInput.value;

    try {
        const data = await fetchBackend('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        displayMessage(loginMessage, data.message, 'success');
        setAuthData(data.token, data.user.username);
        loginForm.classList.add('hidden'); // Hide login form
    } catch (error) {
        displayMessage(loginMessage, error.message, 'error');
    }
};

const handleLogout = () => {
    clearAuthData();
    displayMessage(loginMessage, 'Logged out successfully.', 'success'); // Can use any message element
    loginForm.classList.add('hidden'); // Hide form
    registerForm.classList.add('hidden'); // Hide form
    authFormsSection.classList.add('hidden'); // Hide auth section
    searchResultsContainer.innerHTML = ''; // Clear movies on logout
    popularMoviesContainer.innerHTML = '';
    recommendedMoviesContainer.innerHTML = ''; // Clear protected content
};

// Movie search and popular movie functions
const searchMovies = async () => {
    const query = movieSearchInput.value;
    if (!query) {
        displayMessage(searchMessage, 'Please enter a movie title to search.', 'error');
        searchResultsContainer.innerHTML = '';
        return;
    }
    try {
        const data = await fetchBackend(`/api/movies/search?query=${encodeURIComponent(query)}`);
        renderMovies(searchResultsContainer, data.results);
        displayMessage(searchMessage, `Found ${data.results.length} results.`, 'success');
    } catch (error) {
        displayMessage(searchMessage, error.message, 'error');
        searchResultsContainer.innerHTML = '';
    }
};

const loadPopularMovies = async () => {
    try {
        const data = await fetchBackend('/api/movies/popular');
        renderMovies(popularMoviesContainer, data.results);
        displayMessage(popularMoviesMessage, `Loaded ${data.results.length} popular movies.`, 'success');
    } catch (error) {
        displayMessage(popularMoviesMessage, error.message, 'error');
    }
};

// Example of calling a protected route (you might call this after login for recommendations)
const loadProtectedContent = async () => {
    try {
        const data = await fetchBackend('/api/protected');
        displayMessage(protectedMessage, data.message, 'success');
        // Here you would typically fetch and display actual protected content
        // For now, just show the message and maybe some dummy data
        recommendedMoviesContainer.innerHTML = '<p>This section is for personalized recommendations after login!</p>';
    } catch (error) {
        displayMessage(protectedMessage, `Error accessing protected content: ${error.message}`, 'error');
        recommendedMoviesContainer.innerHTML = '';
    }
};


// --- Event Listeners ---
showLoginFormBtn.addEventListener('click', () => {
    authFormsSection.classList.remove('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginMessage.style.display = 'none';
});

showRegisterFormBtn.addEventListener('click', () => {
    authFormsSection.classList.remove('hidden');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerMessage.style.display = 'none';
});

logoutBtn.addEventListener('click', handleLogout);

loginSubmitBtn.addEventListener('click', handleLogin);
registerSubmitBtn.addEventListener('click', handleRegister);

movieSearchBtn.addEventListener('click', searchMovies);
movieSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies();
    }
});

loadPopularMoviesBtn.addEventListener('click', loadPopularMovies);


// --- Initial UI Load ---
document.addEventListener('DOMContentLoaded', () => {
    updateUI(); // Set initial UI state based on localStorage
    if (getAuthData().token) {
        // If already logged in, you might want to automatically load some content or protected content
        loadPopularMovies(); // Load popular movies on initial login/page load
        loadProtectedContent(); // Attempt to load protected content if logged in
    }
});