require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const db = require('./config/database');

const app = express();

// Session store configuration
const sessionStore = new MySQLStore({
    expiration: 24 * 60 * 60 * 1000, // 24 saat
    createDatabaseTable: true
}, db);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layout setup
app.use(expressLayouts);
app.set('layout', 'admin/layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.set('layout extractMetas', true);

// Session configuration
app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
}));

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

// Root route
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Routes
app.use('/', require('./routes/authRoutes')); // Kayıt route'ları
app.use('/admin', require('./routes/adminRoutes')); // Admin route'ları

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error details:', err);
    console.error('Error stack:', err.stack);
    
    res.status(500).render('error', { 
        title: 'Hata',
        error: {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
});

// 404 handling
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Sayfa Bulunamadı',
        error: { message: 'İstediğiniz sayfa bulunamadı.' }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 