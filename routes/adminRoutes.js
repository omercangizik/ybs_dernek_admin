const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const isAdmin = require('../middlewares/isAdmin');

// Admin login page
router.get('/login', (req, res) => {
    res.render('admin/login', { title: 'Admin Girişi' });
});

// Admin login process
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for email:', email);

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        console.log('Found users:', users.length);

        if (users.length === 0) {
            console.log('No user found with email:', email);
            return res.render('admin/login', { 
                title: 'Admin Girişi',
                error: 'Geçersiz email veya şifre'
            });
        }

        const user = users[0];
        console.log('User role:', user.role);

        if (user.role !== 'admin') {
            console.log('User is not an admin:', user.role);
            return res.render('admin/login', { 
                title: 'Admin Girişi',
                error: 'Bu sayfaya erişim yetkiniz yok'
            });
        }

        const match = await bcrypt.compare(password, user.password);
        console.log('Password match:', match);

        if (!match) {
            console.log('Password does not match');
            return res.render('admin/login', { 
                title: 'Admin Girişi',
                error: 'Geçersiz email veya şifre'
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            surname: user.surname,
            email: user.email,
            role: user.role
        };
        console.log('Session created:', req.session.user);

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('admin/login', { 
            title: 'Admin Girişi',
            error: 'Bir hata oluştu. Lütfen tekrar deneyin.'
        });
    }
});

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM events) as total_events,
                (SELECT COUNT(*) FROM trainings) as total_trainings,
                (SELECT COUNT(*) FROM jobs) as total_jobs
        `);

        res.render('admin/dashboard', { 
            title: 'Admin Paneli',
            user: req.session.user,
            stats: stats[0]
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            title: 'Hata',
            error: { message: 'Dashboard yüklenirken bir hata oluştu.' }
        });
    }
});

// Events management
router.get('/events', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT e.*, 
                   (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as participant_count
            FROM events e
        `;
        const params = [];

        if (search) {
            query += ' WHERE e.title LIKE ? OR e.description LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY e.date DESC';
        const [events] = await db.query(query, params);

        res.render('admin/events/index', {
            title: 'Etkinlik Yönetimi',
            user: req.session.user,
            events,
            search: search || ''
        });
    } catch (err) {
        console.error('Events error:', err);
        req.flash('error_msg', 'Etkinlikler yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Edit event form
router.get('/events/:id/edit', isAdmin, async (req, res) => {
    try {
        const [events] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
        
        if (events.length === 0) {
            req.flash('error_msg', 'Etkinlik bulunamadı');
            return res.redirect('/admin/events');
        }

        res.render('admin/events/edit', {
            title: 'Etkinlik Düzenle',
            user: req.session.user,
            event: events[0]
        });
    } catch (err) {
        console.error('Edit event error:', err);
        req.flash('error_msg', 'Etkinlik düzenleme sayfası yüklenirken bir hata oluştu');
        res.redirect('/admin/events');
    }
});

// Update event
router.post('/events/:id', isAdmin, async (req, res) => {
    try {
        const { title, description, event_date, location, capacity } = req.body;
        
        await db.query(
            'UPDATE events SET title = ?, description = ?, date = ?, location = ?, capacity = ? WHERE id = ?',
            [title, description, event_date, location, capacity, req.params.id]
        );

        req.flash('success_msg', 'Etkinlik başarıyla güncellendi');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Update event error:', err);
        req.flash('error_msg', 'Etkinlik güncellenirken bir hata oluştu');
        res.redirect(`/admin/events/${req.params.id}/edit`);
    }
});

// Delete event
router.post('/events/:id/delete', isAdmin, async (req, res) => {
    try {
        // Önce etkinliğe kayıtlı katılımcıları sil
        await db.query('DELETE FROM event_registrations WHERE event_id = ?', [req.params.id]);
        
        // Sonra etkinliği sil
        await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);

        req.flash('success_msg', 'Etkinlik başarıyla silindi');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Delete event error:', err);
        req.flash('error_msg', 'Etkinlik silinirken bir hata oluştu');
        res.redirect('/admin/events');
    }
});

// Trainings management
router.get('/trainings', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT t.*, 
                   (SELECT COUNT(*) FROM training_participants WHERE training_id = t.id) as participant_count
            FROM trainings t
        `;
        const params = [];

        if (search) {
            query += ' WHERE t.title LIKE ? OR t.description LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY t.start_date DESC';
        const [trainings] = await db.query(query, params);

        res.render('admin/trainings', {
            title: 'Eğitim Yönetimi',
            user: req.session.user,
            trainings,
            search: search || ''
        });
    } catch (err) {
        console.error('Trainings error:', err);
        req.flash('error_msg', 'Eğitimler yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Edit training form
router.get('/trainings/:id/edit', isAdmin, async (req, res) => {
    try {
        const [trainings] = await db.query('SELECT * FROM trainings WHERE id = ?', [req.params.id]);
        
        if (trainings.length === 0) {
            req.flash('error_msg', 'Eğitim bulunamadı');
            return res.redirect('/admin/trainings');
        }

        res.render('admin/trainings/edit', {
            title: 'Eğitim Düzenle',
            user: req.session.user,
            training: trainings[0]
        });
    } catch (err) {
        console.error('Edit training error:', err);
        req.flash('error_msg', 'Eğitim düzenleme sayfası yüklenirken bir hata oluştu');
        res.redirect('/admin/trainings');
    }
});

// Update training
router.post('/trainings/:id', isAdmin, async (req, res) => {
    try {
        const { title, description, start_date, end_date, location, capacity } = req.body;
        
        await db.query(
            'UPDATE trainings SET title = ?, description = ?, start_date = ?, end_date = ?, location = ?, capacity = ? WHERE id = ?',
            [title, description, start_date, end_date, location, capacity, req.params.id]
        );

        req.flash('success_msg', 'Eğitim başarıyla güncellendi');
        res.redirect('/admin/trainings');
    } catch (err) {
        console.error('Update training error:', err);
        req.flash('error_msg', 'Eğitim güncellenirken bir hata oluştu');
        res.redirect(`/admin/trainings/${req.params.id}/edit`);
    }
});

// Delete training
router.post('/trainings/:id/delete', isAdmin, async (req, res) => {
    try {
        // Önce eğitime kayıtlı katılımcıları sil
        await db.query('DELETE FROM training_participants WHERE training_id = ?', [req.params.id]);
        
        // Sonra eğitimi sil
        await db.query('DELETE FROM trainings WHERE id = ?', [req.params.id]);

        req.flash('success_msg', 'Eğitim başarıyla silindi');
        res.redirect('/admin/trainings');
    } catch (err) {
        console.error('Delete training error:', err);
        req.flash('error_msg', 'Eğitim silinirken bir hata oluştu');
        res.redirect('/admin/trainings');
    }
});

// Jobs management
router.get('/jobs', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT j.*, 
                   (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
            FROM jobs j
        `;
        const params = [];

        if (search) {
            query += ' WHERE j.title LIKE ? OR j.description LIKE ? OR j.company_name LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY j.deadline DESC';
        const [jobs] = await db.query(query, params);

        res.render('admin/jobs', {
            title: 'İş İlanları Yönetimi',
            user: req.session.user,
            jobs,
            search: search || ''
        });
    } catch (err) {
        console.error('Jobs error:', err);
        req.flash('error_msg', 'İş ilanları yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Edit job form
router.get('/jobs/:id/edit', isAdmin, async (req, res) => {
    try {
        const [jobs] = await db.query('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
        
        if (jobs.length === 0) {
            req.flash('error_msg', 'İş ilanı bulunamadı');
            return res.redirect('/admin/jobs');
        }

        res.render('admin/jobs/edit', {
            title: 'İş İlanı Düzenle',
            user: req.session.user,
            job: jobs[0]
        });
    } catch (err) {
        console.error('Edit job error:', err);
        req.flash('error_msg', 'İş ilanı düzenleme sayfası yüklenirken bir hata oluştu');
        res.redirect('/admin/jobs');
    }
});

// Update job
router.post('/jobs/:id', isAdmin, async (req, res) => {
    try {
        const { title, company, location, description, requirements, deadline, is_active } = req.body;
        
        await db.query(
            'UPDATE jobs SET title = ?, company = ?, location = ?, description = ?, requirements = ?, deadline = ?, is_active = ? WHERE id = ?',
            [title, company, location, description, requirements, deadline, is_active, req.params.id]
        );

        req.flash('success_msg', 'İş ilanı başarıyla güncellendi');
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error('Update job error:', err);
        req.flash('error_msg', 'İş ilanı güncellenirken bir hata oluştu');
        res.redirect(`/admin/jobs/${req.params.id}/edit`);
    }
});

// Delete job
router.post('/jobs/:id/delete', isAdmin, async (req, res) => {
    try {
        // Önce iş ilanına yapılan başvuruları sil
        await db.query('DELETE FROM job_applications WHERE job_id = ?', [req.params.id]);
        
        // Sonra iş ilanını sil
        await db.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);

        req.flash('success_msg', 'İş ilanı başarıyla silindi');
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error('Delete job error:', err);
        req.flash('error_msg', 'İş ilanı silinirken bir hata oluştu');
        res.redirect('/admin/jobs');
    }
});

// Blog management
router.get('/blogs', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT bp.*, 
                   u.name as author_name, 
                   u.surname as author_surname,
                   (SELECT COUNT(*) FROM blog_comments WHERE post_id = bp.id) as comment_count
            FROM blog_posts bp
            LEFT JOIN users u ON bp.author_id = u.id
        `;
        const params = [];

        if (search) {
            query += ' WHERE bp.title LIKE ? OR bp.content LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY bp.created_at DESC';
        const [blogs] = await db.query(query, params);

        res.render('admin/blogs', {
            title: 'Blog Yönetimi',
            user: req.session.user,
            blogs,
            search: search || ''
        });
    } catch (err) {
        console.error('Blogs error:', err);
        req.flash('error_msg', 'Blog yazıları yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Messages management
router.get('/messages', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM contact_messages';
        const params = [];

        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ? OR message LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';
        const [messages] = await db.query(query, params);

        res.render('admin/messages', {
            title: 'Mesaj Yönetimi',
            user: req.session.user,
            messages,
            search: search || ''
        });
    } catch (err) {
        console.error('Messages error:', err);
        req.flash('error_msg', 'Mesajlar yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Users management
router.get('/users', isAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT u.*, 
                   (SELECT COUNT(*) FROM event_registrations WHERE user_id = u.id) as event_count,
                   (SELECT COUNT(*) FROM training_participants WHERE user_id = u.id) as training_count,
                   (SELECT COUNT(*) FROM job_applications WHERE user_id = u.id) as job_count
            FROM users u
        `;
        const params = [];

        if (search) {
            query += ' WHERE u.name LIKE ? OR u.surname LIKE ? OR u.email LIKE ?';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY u.created_at DESC';
        const [users] = await db.query(query, params);

        res.render('admin/users', {
            title: 'Kullanıcı Yönetimi',
            user: req.session.user,
            users,
            search: search || ''
        });
    } catch (err) {
        console.error('Users error:', err);
        req.flash('error_msg', 'Kullanıcılar yüklenirken bir hata oluştu');
        res.redirect('/admin/dashboard');
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Create new event form
router.get('/events/new', isAdmin, (req, res) => {
    res.render('admin/events/new', {
        title: 'Yeni Etkinlik',
        user: req.session.user
    });
});

// Create new event process
router.post('/events', isAdmin, async (req, res) => {
    try {
        const { title, description, event_date, location, capacity } = req.body;
        
        await db.query(
            'INSERT INTO events (title, description, date, location, capacity) VALUES (?, ?, ?, ?, ?)',
            [title, description, event_date, location, capacity]
        );

        req.flash('success_msg', 'Etkinlik başarıyla oluşturuldu');
        res.redirect('/admin/events');
    } catch (err) {
        console.error('Create event error:', err);
        req.flash('error_msg', 'Etkinlik oluşturulurken bir hata oluştu');
        res.redirect('/admin/events/new');
    }
});

// Create new training form
router.get('/trainings/new', isAdmin, (req, res) => {
    res.render('admin/trainings/new', {
        title: 'Yeni Eğitim',
        user: req.session.user
    });
});

// Create new training process
router.post('/trainings', isAdmin, async (req, res) => {
    try {
        const { title, description, start_date, end_date, location, capacity } = req.body;
        
        await db.query(
            'INSERT INTO trainings (title, description, start_date, end_date, location, capacity) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, start_date, end_date, location, capacity]
        );

        req.flash('success_msg', 'Eğitim başarıyla oluşturuldu');
        res.redirect('/admin/trainings');
    } catch (err) {
        console.error('Create training error:', err);
        req.flash('error_msg', 'Eğitim oluşturulurken bir hata oluştu');
        res.redirect('/admin/trainings/new');
    }
});

// Create new job form
router.get('/jobs/new', isAdmin, (req, res) => {
    res.render('admin/jobs/new', {
        title: 'Yeni İş İlanı',
        user: req.session.user
    });
});

// Create new job process
router.post('/jobs', isAdmin, async (req, res) => {
    try {
        const { title, company, location, description, requirements, deadline } = req.body;
        
        await db.query(
            'INSERT INTO jobs (title, company, location, description, requirements, deadline, is_active) VALUES (?, ?, ?, ?, ?, ?, true)',
            [title, company, location, description, requirements, deadline]
        );

        req.flash('success_msg', 'İş ilanı başarıyla oluşturuldu');
        res.redirect('/admin/jobs');
    } catch (err) {
        console.error('Create job error:', err);
        req.flash('error_msg', 'İş ilanı oluşturulurken bir hata oluştu');
        res.redirect('/admin/jobs/new');
    }
});

// Create new blog form
router.get('/blogs/new', isAdmin, (req, res) => {
    res.render('admin/blogs/new', {
        title: 'Yeni Blog Yazısı',
        user: req.session.user
    });
});

// Create new blog process
router.post('/blogs', isAdmin, async (req, res) => {
    try {
        const { title, content, summary } = req.body;
        const author_id = req.session.user.id;
        
        // Handle file upload
        let image_path = null;
        if (req.files && req.files.image) {
            const image = req.files.image;
            const imageName = Date.now() + '-' + image.name;
            await image.mv('./public/uploads/blogs/' + imageName);
            image_path = '/uploads/blogs/' + imageName;
        }
        
        await db.query(
            'INSERT INTO blog_posts (title, content, summary, image_path, author_id, is_published) VALUES (?, ?, ?, ?, ?, true)',
            [title, content, summary, image_path, author_id]
        );

        req.flash('success_msg', 'Blog yazısı başarıyla oluşturuldu');
        res.redirect('/admin/blogs');
    } catch (err) {
        console.error('Create blog error:', err);
        req.flash('error_msg', 'Blog yazısı oluşturulurken bir hata oluştu');
        res.redirect('/admin/blogs/new');
    }
});

// Create new user process
router.post('/users', isAdmin, async (req, res) => {
    try {
        const { name, surname, email, password, role, phone, address } = req.body;
        
        // Check if email already exists
        const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            req.flash('error_msg', 'Bu e-posta adresi zaten kullanılıyor');
            return res.redirect('/admin/users/new');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await db.query(
            'INSERT INTO users (name, surname, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, surname, email, hashedPassword, role, phone, address]
        );

        req.flash('success_msg', 'Kullanıcı başarıyla oluşturuldu');
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Create user error:', err);
        req.flash('error_msg', 'Kullanıcı oluşturulurken bir hata oluştu');
        res.redirect('/admin/users/new');
    }
});

module.exports = router; 