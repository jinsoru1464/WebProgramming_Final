  const express = require('express');
  const path = require('path');
  const fs = require('fs');
  const ejs = require('ejs');
  const jwt = require('jsonwebtoken');
  const dotenv = require('dotenv');
  const db = require('./db');
  const authenticateToken = require('./middleware/auth');
  const cookieParser = require('cookie-parser');
  const multer = require('multer');
  const methodOverride = require('method-override');

  dotenv.config();

  const app = express();
  const JWT_SECRET = process.env.JWT_SECRET;

  // ✅ 미들웨어
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(methodOverride('_method'));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // ✅ EJS 설정
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // ✅ 로그인 전 메인
  app.get('/', (req, res) => {
    res.render('main(LogX)', { layout: false });
  });

  app.get('/login', (req, res) => res.render('login', { layout: false }));
  app.get('/signUp', (req, res) => res.render('signUp', { layout: false }));

  // ✅ 로그인 처리
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

      res.cookie('token', token, { httpOnly: true, maxAge: 3 * 60 * 60 * 1000 });
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
      await db.execute(
        `INSERT INTO users (email, password, name, nickname) VALUES (?, ?, ?, ?)`,
        [email, password, name, nickname]
      );
      res.render('signupSuccess', { layout: false, name, email });
    } catch (err) {
      console.error('❌ 회원가입 오류:', err);
      res.status(500).send('회원가입 중 오류가 발생했습니다.');
    }
  });

  // ✅ 중복 확인
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

  // ✅ 로그인 후 메인
  app.get('/main', authenticateToken, (req, res) => {
    res.render('main(LogO)', { user: req.user });
  });

  // ✅ 타이머 저장
  app.post('/api/timer', authenticateToken, async (req, res) => {
    const { keyword, seconds } = req.body;
    const userId = req.user.id;

    if (!keyword || typeof seconds !== 'number') {
      return res.status(400).json({ message: 'keyword와 seconds가 필요합니다.' });
    }

    try {
      await db.execute(
        `INSERT INTO timer_logs (user_id, keyword, duration_seconds) VALUES (?, ?, ?)`,
        [userId, keyword, seconds]
      );
      res.status(201).json({ message: '타이머 기록 저장 완료' });
    } catch (err) {
      console.error('❌ 타이머 저장 오류:', err);
      res.status(500).json({ message: '서버 오류' });
    }
  });

  // ✅ 타이머 최근 기록
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

  // ✅ 로그아웃
  app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
  });

  // ✅ 파일 업로드(multer)
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage });

  // ✅ 팀원 모집 글쓰기 폼
  app.get('/recruit/write', authenticateToken, (req, res) => {
    res.render('team_recruit_write', { user: req.user, currentPath: req.path });
  });

  // ✅ 글 작성 처리
  app.post('/recruit/write', authenticateToken, upload.single('thumbnail'), async (req, res) => {
    const { title, content } = req.body;
    const thumbnail = req.file ? '/uploads/' + req.file.filename : null;
    const userId = req.user.id;

    try {
      await db.execute(
        'INSERT INTO recruit_posts (user_id, title, content, thumbnail) VALUES (?, ?, ?, ?)',
        [userId, title, content, thumbnail]
      );
      res.redirect('/recruit');
    } catch (err) {
      console.error('❌ 게시글 등록 오류:', err);
      res.status(500).send('게시글 저장 중 오류 발생');
    }
  });

  // ✅ 글 목록 조회
  app.get('/recruit', authenticateToken, async (req, res) => {
    const perPage = 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * perPage;

    try {
      const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM recruit_posts`);
      const totalPages = Math.ceil(count / perPage);

      const [posts] = await db.query(`
        SELECT rp.*, u.nickname AS author
        FROM recruit_posts rp
        JOIN users u ON rp.user_id = u.id
        ORDER BY rp.created_at DESC
        LIMIT ?, ?
      `, [offset, perPage]);

      res.render('team_recruit', {
        posts,
        user: req.user,
        currentPath: req.path,
        totalPages,
        currentPage: page
      });
    } catch (err) {
      console.error('❌ 게시글 조회 오류:', err);
      res.status(500).send('게시글 로딩 중 오류 발생');
    }
  });

  // ✅ 글 상세 보기
  app.get('/recruit/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;

    try {
      const [[post]] = await db.execute(`
        SELECT rp.*, u.nickname AS author
        FROM recruit_posts rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.id = ?
      `, [postId]);

      if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');

      res.render('team_recruit_detail', {
        post,
        user: req.user,
        currentPath: req.path
      });
    } catch (err) {
      console.error('❌ 상세 글 조회 오류:', err);
      res.status(500).send('게시글 조회 중 오류 발생');
    }
  });

  // ✅ 수정 폼 보여주기
  app.get('/recruit/:id/edit', authenticateToken, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM recruit_posts WHERE id = ?', [req.params.id]);
    const post = rows[0];

    if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');

    // ✅ 작성자 검증
    if (post.user_id !== req.user.id) {
      return res.status(403).send('수정 권한이 없습니다.');
    }

    res.render('team_recruit_edit', {
      post,
      currentPath: req.path,
      user: req.user,
    });
  });

  // ✅ 수정 처리
  app.post('/recruit/:id/edit', authenticateToken, upload.single('thumbnail'), async (req, res) => {
    const { title, content } = req.body;
    const id = req.params.id;

    const [original] = await db.query('SELECT * FROM recruit_posts WHERE id = ?', [id]);
    const post = original[0];

    // ✅ 작성자 검증
    if (!post || post.user_id !== req.user.id) {
      return res.status(403).send('수정 권한이 없습니다.');
    }

    const thumbnail = req.file ? `/uploads/${req.file.filename}` : post.thumbnail;

    await db.query(
      'UPDATE recruit_posts SET title = ?, content = ?, thumbnail = ? WHERE id = ?',
      [title, content, thumbnail, id]
    );

    res.redirect(`/recruit/${id}`);
  });

  // ✅ 삭제 처리
  app.delete('/recruit/:id', authenticateToken, async (req, res) => {
    const [[post]] = await db.query('SELECT * FROM recruit_posts WHERE id = ?', [req.params.id]);

    if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');

    // ✅ 작성자 검증
    if (post.user_id !== req.user.id) {
      return res.status(403).send('삭제 권한이 없습니다.');
    }

    await db.query('DELETE FROM recruit_posts WHERE id = ?', [req.params.id]);
    res.redirect('/recruit');
  });

  // ✅ 서버 실행
  const PORT = process.env.PORT || 3000;
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 [PROD] 서버 실행 중...');
  } else {
    console.log('🛠 [DEV] 서버 실행 중...');
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 서버 실행됨: http://0.0.0.0:${PORT}`);
  });

    