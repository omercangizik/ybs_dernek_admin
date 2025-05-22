const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');

// Kayıt sayfasını göster
router.get('/register', (req, res) => {
    try {
        // Eğer kullanıcı admin ise isAdmin değişkenini true yap
        const isAdmin = req.session.user && req.session.user.role === 'admin';
        
        res.render('admin/register', { 
            title: 'Kayıt Ol',
            error: null,
            isAdmin: isAdmin
        });
    } catch (error) {
        console.error('Register page error:', error);
        res.status(500).render('error', {
            title: 'Hata',
            error: { message: 'Sayfa yüklenirken bir hata oluştu.' }
        });
    }
});

// Kayıt işlemini gerçekleştir
router.post('/register', async (req, res) => {
    try {
        const { name, surname, email, password, password2, role } = req.body;

        // Gerekli alanların kontrolü
        if (!name || !surname || !email || !password || !password2 || !role) {
            return res.render('admin/register', {
                title: 'Kayıt Ol',
                error: 'Tüm alanları doldurunuz',
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Şifre kontrolü
        if (password !== password2) {
            return res.render('admin/register', {
                title: 'Kayıt Ol',
                error: 'Şifreler eşleşmiyor',
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Email kontrolü
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.render('admin/register', {
                title: 'Kayıt Ol',
                error: 'Bu email adresi zaten kullanılıyor',
                isAdmin: req.session.user && req.session.user.role === 'admin'
            });
        }

        // Admin rolü kontrolü
        if (role === 'admin' && (!req.session.user || req.session.user.role !== 'admin')) {
            return res.render('admin/register', {
                title: 'Kayıt Ol',
                error: 'Admin rolü atama yetkiniz yok',
                isAdmin: false
            });
        }

        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(password, 10);

        // Kullanıcıyı kaydet
        const [result] = await db.query(
            'INSERT INTO users (name, surname, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [name, surname, email, hashedPassword, role]
        );

        if (result.affectedRows === 1) {
            // Başarılı kayıt mesajı
            req.flash('success_msg', 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
            res.redirect('/admin/login');
        } else {
            throw new Error('Kullanıcı kaydedilemedi');
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.render('admin/register', {
            title: 'Kayıt Ol',
            error: 'Kayıt sırasında bir hata oluştu: ' + error.message,
            isAdmin: req.session.user && req.session.user.role === 'admin'
        });
    }
});

module.exports = router; 