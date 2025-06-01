const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('./db');
const authenticateToken = require('./middleware/auth');
const cookieParser = require('cookie-parser');

dotenv.config(); // ✅ 환경변수 로딩

const app = express(); // ✅ 여기보다 위에 app.use() 하면 에러!

const JWT_SECRET = process.env.JWT_SECRET;

// ✨ 미들웨어 설정
app.use(cookieParser()); // ✅ 여기에 위치해야 함
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✨ EJS 템플릿 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ✅ 로그인 전 메인페이지
app.get('/', (req, res) => {
  res.render('main(LogX)', { layout: false });
});

// ✅ 로그인 폼
app.get('/login', (req, res) => {
  res.render('login', { layout: false });
});

// ✅ 회원가입 폼
app.get('/signUp', (req, res) => {
  res.render('signUp', { layout: false });
});

// ✅ 로그인 처리 + JWT 발급 + 쿠키 저장 + 리다이렉트
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).send('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname },
      JWT_SECRET,
      { expiresIn: '3h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 3 * 60 * 60 * 1000,
    });

    res.redirect('/main');
  } catch (err) {
    console.error(err);
    res.status(500).send('서버 오류');
  }
});

// ✅ 회원가입 처리
app.post('/signUp', async (req, res) => {
  const { id, password, email, nickname, name } = req.body;

  try {
    const sql = `
      INSERT INTO users (email, password, name, nickname)
      VALUES (?, ?, ?, ?)
    `;
    await db.execute(sql, [email, password, name, nickname]);

    res.render('signupSuccess', { layout: false, name, email });
  } catch (err) {
    console.error('❌ 회원가입 오류:', err);
    res.status(500).send('회원가입 중 오류가 발생했습니다.');
  }
});

// ✅ 닉네임/이메일 중복 확인
app.get('/check-nickname', async (req, res) => {
  const { nickname } = req.query;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE nickname = ?', [nickname]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.get('/check-email', async (req, res) => {
  const { email } = req.query;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ✅ 로그인 후 메인페이지 (JWT 인증 필요)
app.get('/main', authenticateToken, (req, res) => {
  res.render('main(LogO)', { user: req.user });
});

// ✅ 타이머 기록 저장
app.post('/api/timer', authenticateToken, async (req, res) => {
  const { keyword, seconds } = req.body;
  const userId = req.user.id;

  if (!keyword || typeof seconds !== 'number') {
    return res.status(400).json({ message: 'keyword와 seconds가 필요합니다.' });
  }

  try {
    const sql = `
      INSERT INTO timer_logs (user_id, keyword, duration_seconds)
      VALUES (?, ?, ?)
    `;
    await db.execute(sql, [userId, keyword, seconds]);
    res.status(201).json({ message: '타이머 기록 저장 완료' });
  } catch (err) {
    console.error('❌ 타이머 저장 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ✅ 최근 타이머 기록 5개 불러오기
app.get('/api/timer/recent', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.execute(
      'SELECT keyword, duration_seconds FROM timer_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ✅ 로그아웃 (선택)
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// ✅ 서버 실행
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행됨: http://localhost:${PORT}`);
});
