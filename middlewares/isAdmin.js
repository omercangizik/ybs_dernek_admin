// Admin middleware
module.exports = (req, res, next) => {
    console.log('isAdmin middleware - Session:', req.session);
    console.log('isAdmin middleware - User:', req.session.user);
    
    if (!req.session.user) {
        console.log('No user in session');
        return res.redirect('/admin/login');
    }

    if (req.session.user.role !== 'admin') {
        console.log('User is not admin:', req.session.user.role);
        return res.redirect('/admin/login');
    }

    console.log('Admin access granted');
    next();
}; 