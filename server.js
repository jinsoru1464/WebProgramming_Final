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
          { id: user.id, email: user.email, nickname: user.nickname, name: user.name },
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

        // 날짜별 누적
await db.execute(
  `INSERT INTO daily_study_summary (user_id, study_date, total_seconds)
   VALUES (?, CURDATE(), ?)
   ON DUPLICATE KEY UPDATE total_seconds = total_seconds + ?`,
  [userId, seconds, seconds]
);

// 키워드별 누적
await db.execute(
  `INSERT INTO keyword_study_summary (user_id, keyword, total_seconds)
   VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE total_seconds = total_seconds + ?`,
  [userId, keyword, seconds, seconds]
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
  const currentPage = parseInt(req.query.page) || 1;
  const postsPerPage = 10;
  const offset = (currentPage - 1) * postsPerPage;

  try {
    const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM recruit_posts`);
    const totalPages = Math.ceil(count / postsPerPage);

    const [posts] = await db.execute(`
      SELECT rp.*, u.nickname AS author 
      FROM recruit_posts rp
      JOIN users u ON rp.user_id = u.id
      ORDER BY rp.created_at DESC
      LIMIT ${postsPerPage} OFFSET ${offset}
    `);

    // ✅ 페이지네이션 그룹 계산
    const groupSize = 10;
    const currentGroup = Math.floor((currentPage - 1) / groupSize);
    const groupStart = currentGroup * groupSize + 1;
    const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

    res.render('team_recruit', {
      posts,
      currentPage,
      totalPages,
      groupStart,
      groupEnd,
      user: req.user,
      currentPath: req.originalUrl
    });
  } catch (err) {
    console.error('❌ 팀원 모집 페이지 오류:', err);
    res.status(500).send('서버 오류');
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

                // ✅ 댓글 목록 가져오기 추가
const [comments] = await db.execute(`
  SELECT rc.*, u.nickname AS author
  FROM recruit_comments rc
  JOIN users u ON rc.user_id = u.id
  WHERE rc.post_id = ?
  ORDER BY rc.created_at ASC
`, [postId]);

        if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');

        res.render('team_recruit_detail', {
          post,
          user: req.user,
          comments,
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

    app.post('/recruit/:id/comments', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content) return res.status(400).send('댓글 내용을 입력해주세요.');

  try {
    await db.execute(
      'INSERT INTO recruit_comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, userId, content]
    );
    res.redirect(`/recruit/${postId}`);
  } catch (err) {
    console.error('❌ recruit 댓글 저장 오류:', err);
    res.status(500).send('댓글 저장 중 오류');
  }
});

app.delete('/recruit/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    const [[comment]] = await db.execute(
      'SELECT * FROM recruit_comments WHERE id = ?',
      [commentId]
    );

    if (!comment) return res.status(404).send('댓글을 찾을 수 없습니다.');
    if (comment.user_id !== userId) {
      return res.status(403).send('삭제 권한이 없습니다.');
    }

    await db.execute('DELETE FROM recruit_comments WHERE id = ?', [commentId]);
    res.redirect(`/recruit/${postId}`);
  } catch (err) {
    console.error('❌ recruit 댓글 삭제 오류:', err);
    res.status(500).send('댓글 삭제 중 오류');
  }
});


// 커뮤니티 목록 페이지
app.get('/community', authenticateToken, async (req, res) => {
  const category = req.query.category || ''; // 기본값을 빈 문자열로 설정
  const currentPage = parseInt(req.query.page) || 1;
  const postsPerPage = 6;
  const offset = (currentPage - 1) * postsPerPage;

  const filterClause = category ? 'WHERE category = ?' : '';
  const filterParams = category ? [category] : [];

  try {
    const [[{ count }]] = await db.execute(
      `SELECT COUNT(*) AS count FROM community_posts ${filterClause}`,
      filterParams
    );
    const totalPages = Math.ceil(count / postsPerPage);

    const queryParams = category ? [category] : [];

    const [posts] = await db.execute(
      `SELECT cp.*, u.nickname AS author
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      ${filterClause}
      ORDER BY cp.created_at DESC
      LIMIT ${postsPerPage} OFFSET ${offset}`,
      queryParams
    );

    let pageTitle = '커뮤니티';
    if (category === '스터디원 모집') pageTitle = '스터디원 모집';
    else if (category === 'Q&A') pageTitle = 'Q&A';
    else if (category === '공모전 후기') pageTitle = '공모전 후기';

    // 그룹 시작과 끝 계산 (페이징)
    const groupSize = 10;
    const currentGroup = Math.floor((currentPage - 1) / groupSize);
    const groupStart = currentGroup * groupSize + 1;
    const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

    res.render('community-review', {
      posts,
      currentPage,
      totalPages,
      currentCategory: category,
      pageTitle,
      user: req.user,
      currentPath: req.originalUrl,
      category,        // category를 추가로 전달
      groupStart,      // groupStart를 추가로 전달
      groupEnd,        // groupEnd를 추가로 전달
    });
  } catch (err) {
    console.error('❌ 커미니티 목록 오류:', err);
    res.status(500).send('서버 오류');
  }
});



  app.get('/community_write', authenticateToken, (req, res) => {
    res.render('community_write', {
      user: req.user,
      currentPath: req.path
    });
  });

  app.post('/community_write', authenticateToken, upload.single('image'), async (req, res) => {
    const { title, content, category } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : null;
    const userId = req.user.id;

    try {
      await db.execute(
        `INSERT INTO community_posts (user_id, title, content, category, image)
        VALUES (?, ?, ?, ?, ?)`,
        [userId, title, content, category, image]
      );
      res.redirect('/community');
    } catch (err) {
      console.error('❌ 커뮤니티 글쓰기 오류:', err);
      res.status(500).send('글 저장 중 오류 발생');
    }
  });

  app.get('/community/:id/edit', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const [[post]] = await db.query('SELECT * FROM community_posts WHERE id = ?', [postId]);

    if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');
    if (post.user_id !== req.user.id) {
      return res.status(403).send('수정 권한이 없습니다.');
    }

    res.render('community_edit', {
      post,
      user: req.user,
      currentPath: req.path
    });
  });


  // 기존 POST를 아래처럼 PUT으로 바꿔주세요.
  app.put('/community/:id/edit', authenticateToken, upload.single('image'), async (req, res) => {
    const { title, content, category } = req.body;
    const postId = req.params.id;

    const [[original]] = await db.query('SELECT * FROM community_posts WHERE id = ?', [postId]);
    if (!original || original.user_id !== req.user.id) {
      return res.status(403).send('수정 권한이 없습니다.');
    }

    const image = req.file ? '/uploads/' + req.file.filename : original.image;

    await db.query(
      'UPDATE community_posts SET title = ?, content = ?, category = ?, image = ? WHERE id = ?',
      [title, content, category, image, postId]
    );

    res.redirect(`/community/${postId}`);
  });


  app.get('/community/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;

    try {
      // 예시: MySQL을 사용하는 경우
      const [[post]] = await db.query(`
        SELECT c.*, u.nickname AS author, u.id AS authorId
        FROM community_posts c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `, [postId]);

      const [comments] = await db.execute(`
  SELECT cc.*, u.nickname AS author
  FROM community_comments cc
  JOIN users u ON cc.user_id = u.id
  WHERE cc.post_id = ?
  ORDER BY cc.created_at ASC
`, [postId]);


      if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');

      // 카테고리 기반 타이틀 설정
      let pageTitle = '커뮤니티';
      if (post.category === 'Q&A') pageTitle = 'Q&A';
      else if (post.category === '공모전 후기') pageTitle = '공모전 후기';
      else if (post.category === '스터디원 모집') pageTitle = '스터디원 모집';

      res.render('community_detail', {
        post,
        user: req.user,              // JWT에서 추출된 유저 정보
        currentPath: req.originalUrl,
        comments,
        pageTitle                    // ✅ 오류 해결 핵심
      });
    } catch (err) {
      console.error('❌ 글 상세 오류:', err);
      res.status(500).send('서버 오류');
    }
  });




  app.delete('/community/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const [[post]] = await db.query('SELECT * FROM community_posts WHERE id = ?', [postId]);

    if (!post) return res.status(404).send('게시글을 찾을 수 없습니다.');
    if (post.user_id !== req.user.id) {
      return res.status(403).send('삭제 권한이 없습니다.');
    }

    await db.query('DELETE FROM community_posts WHERE id = ?', [postId]);
    res.redirect('/community');
  });


  app.post('/community/:id/comments', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content) return res.status(400).send('댓글 내용을 입력해주세요.');

  try {
    await db.execute(
      'INSERT INTO community_comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, userId, content]
    );
    res.redirect(`/community/${postId}`);
  } catch (err) {
    console.error('❌ 댓글 저장 오류:', err);
    res.status(500).send('댓글 저장 중 오류');
  }
});

// ✅ 댓글 삭제
app.delete('/community/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    // 댓글 소유자 확인
    const [[comment]] = await db.execute(
      'SELECT * FROM community_comments WHERE id = ?',
      [commentId]
    );

    if (!comment) return res.status(404).send('댓글을 찾을 수 없습니다.');
    if (comment.user_id !== userId) {
      return res.status(403).send('삭제 권한이 없습니다.');
    }

    await db.execute('DELETE FROM community_comments WHERE id = ?', [commentId]);
    res.redirect(`/community/${postId}`);
  } catch (err) {
    console.error('❌ 댓글 삭제 오류:', err);
    res.status(500).send('댓글 삭제 중 오류 발생');
  }
});



  // ✅ contest 라우팅 로직 추가 (recruit와 유사하게 구성)
  app.get('/contest', authenticateToken, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = 12;
      const offset = (page - 1) * perPage;


      // 🔹 추천 공모전 (조회수 기준 상위 3개)
      // ✅ 공부 키워드 가져오기
const [keywords] = await db.execute(
  `SELECT keyword FROM keyword_study_summary WHERE user_id = ? ORDER BY total_seconds DESC LIMIT 3`,
  [req.user.id]
);

let userKeywords = keywords.map(k => k.keyword);

// ✅ 키워드 기반 추천 공모전 (최대 3개 키워드 OR fallback)
let recommendedRows = [];

if (userKeywords.length > 0) {
  const keywordConditions = userKeywords.map(() => `분야 LIKE ?`).join(' OR ');
  const keywordParams = userKeywords.map(k => `%${k}%`);

  [recommendedRows] = await db.execute(
    `SELECT * FROM contests WHERE ${keywordConditions} ORDER BY read_count DESC LIMIT 3`,
    keywordParams
  );
} else {
  // 공부 키워드 없을 경우 fallback
  [recommendedRows] = await db.execute(
    `SELECT * FROM contests ORDER BY read_count DESC LIMIT 3`
  );
}


      // 🔹 전체 개수
      const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM contests`);
      const totalPages = Math.ceil(count / perPage);

      // 🔹 페이징된 공모전 목록
  const [allContests] = await db.execute(
    `SELECT * FROM contests ORDER BY id ASC LIMIT ${offset}, ${perPage}`
  );



      const processContests = (list) => {
        return list.map(contest => {
          const dday = calculateDday(contest.접수마감일);
          return {
            ...contest,
            dday,
            prize: contest.총_상금,
            organizer: contest.주최_주관,
            info: {
              분야: contest.분야,
              응모대상: contest.응모대상,
              홈페이지: contest.홈페이지
            }
          };
        });
      };


      const groupSize = 10;
const currentGroup = Math.floor((page - 1) / groupSize);
const groupStart = currentGroup * groupSize + 1;
const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

      res.render('contest', {
        recommendedContests: processContests(recommendedRows),
        contests: processContests(allContests),
        currentPage: page,
        totalPages,
        groupStart,       // 👈 추가
        groupEnd,  
        currentPath: req.path,
        allKeywords: [],
        user: req.user,
        userKeywords
      });
    } catch (err) {
      console.error('❌ 공모전 페이지 로딩 오류:', err);
      res.status(500).send('서버 오류');
    }
  });


  // ✅ 공모전 필터링 API (AJAX 요청 처리)
  app.get('/contest/filter', async (req, res) => {
    const { filter, keyword } = req.query;
    const page = parseInt(req.query.page) || 1;
    const perPage = 12;
    const offset = (page - 1) * perPage;

    try {
      let whereClause = '';
      let whereParams = [];
      let orderBy = '';

if (filter === 'all') {
  orderBy = 'ORDER BY id ASC'; // ← 기본 정렬
} else if (filter === 'keyword' && keyword) {
  whereClause = 'WHERE 분야 LIKE ?';
  whereParams.push(`%${keyword}%`);
  orderBy = 'ORDER BY id DESC'; // 키워드 검색은 최신순으로
} else if (filter === 'popular') {
  orderBy = 'ORDER BY read_count DESC';
} else if (filter === 'recent') {
  orderBy = 'ORDER BY created_at DESC';
} else {
  orderBy = 'ORDER BY id DESC'; // 기본 fallback
}



      const countQuery = `SELECT COUNT(*) AS count FROM contests ${whereClause}`;
      const [[{ count }]] = await db.execute(countQuery, whereParams);
      const totalPages = Math.ceil(count / perPage);

      const groupSize = 10;
const currentGroup = Math.floor((page - 1) / groupSize);
const groupStart = currentGroup * groupSize + 1;
const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

      // ✅ LIMIT 직접 넣기
      const listQuery = `SELECT * FROM contests ${whereClause} ${orderBy} LIMIT ${offset}, ${perPage}`;
      console.log('✅ listQuery:', listQuery);
      console.log('✅ whereParams:', whereParams);

      const [contests] = await db.execute(listQuery, whereParams); // ✅ whereParams만 전달

      const result = contests.map(contest => ({
        ...contest,
        dday: calculateDday(contest.접수마감일),
        prize: contest.총_상금,
        organizer: contest.주최_주관,
        info: {
          분야: contest.분야,
          응모대상: contest.응모대상,
          홈페이지: contest.홈페이지
        }
      }));

      res.json({
        contests: result,
        groupStart,       // 👈 추가
        groupEnd, 
        currentPage: page,
        totalPages
      });
    } catch (err) {
      console.error('❌ 공모전 필터링 오류:', err);
      res.status(500).json({ message: '서버 오류' });
    }
  });


  // ✅ D-Day 계산 함수
  function calculateDday(deadline) {
    const today = new Date();
    const end = new Date(deadline);
    const diffTime = end - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ✅ 키워드 기반 추천 공모전 API
app.get('/contest/recommend', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const removed = req.query.removed?.split(',') || [];

  try {
    // 모든 키워드 가져오기
    const [allKeywords] = await db.execute(
      `SELECT keyword FROM keyword_study_summary
       WHERE user_id = ? ORDER BY total_seconds DESC`,
      [userId]
    );

    const all = allKeywords.map(k => k.keyword);

    // 삭제된 키워드 제외 후 상위 3개만 사용
    const top3 = all.filter(k => !removed.includes(k)).slice(0, 3);

    if (top3.length === 0) return res.json({ contests: [] });

    const conditions = top3.map(() => `분야 LIKE ?`).join(' OR ');
    const params = top3.map(k => `%${k}%`);

    const [contests] = await db.execute(
      `SELECT * FROM contests WHERE ${conditions} ORDER BY read_count DESC LIMIT 3`,
      params
    );

    const result = contests.map(contest => ({
      ...contest,
      dday: calculateDday(contest.접수마감일),
      prize: contest.총_상금,
      organizer: contest.주최_주관,
      info: {
        분야: contest.분야,
        응모대상: contest.응모대상,
        홈페이지: contest.홈페이지
      }
    }));

    res.json({ contests: result, usedKeywords: top3 });
  } catch (err) {
    console.error('❌ 추천 공모전 API 오류:', err);
    res.status(500).json({ message: '추천 공모전 불러오기 실패' });
  }
});


// ✅ 포트폴리오 페이지 라우터 정리
app.get('/portfolio/:id', authenticateToken, async (req, res) => {
  const userId = req.params.id;

  try {
    const [[portfolio]] = await db.execute(`SELECT * FROM portfolio WHERE user_id = ?`, [userId]);
    const [skills] = await db.execute(`SELECT * FROM user_skills WHERE user_id = ?`, [userId]);
    const [projects] = await db.execute(`SELECT * FROM user_projects WHERE user_id = ?`, [userId]);

    // ✅ 날짜를 문자열로 바로 변환해서 가져옴 (타임존 문제 해결)
    const [dailyRows] = await db.execute(
      `SELECT DATE_FORMAT(study_date, '%Y-%m-%d') AS study_date, total_seconds 
       FROM daily_study_summary 
       WHERE user_id = ?`,
      [userId]
    );

    const [keywordRows] = await db.execute(
  `SELECT keyword, total_seconds 
   FROM keyword_study_summary 
   WHERE user_id = ?`,
  [userId]
);

    // 그대로 넘겨도 문자열 형태로 들어옴
    const daily_study_summary = dailyRows;
    const keyword_study_summary = keywordRows;

    res.render('portfolio', {
  name: req.user.name,
  about: portfolio?.about || '',
  profileImage: portfolio?.profile_image || '',
  skills,
  projects,
  daily_study_summary,
  keyword_study_summary,
  currentPath: req.path,
  user: req.user  // ✅ 전체 user 객체 넘겨줌
});
  } catch (err) {
    console.error('❌ 포트폴리오 불러오기 오류:', err);
    res.status(500).send('서버 오류');
  }
});



// ✅ 포트폴리오 수정 페이지 렌더링
app.get('/editPortfolio', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const [[portfolio]] = await db.execute(`SELECT * FROM portfolio WHERE user_id = ?`, [userId]);
    const [skills] = await db.execute(`SELECT * FROM user_skills WHERE user_id = ?`, [userId]);
    const [projects] = await db.execute(`SELECT * FROM user_projects WHERE user_id = ?`, [userId]);

    const [dailyRows] = await db.execute(
      `SELECT DATE_FORMAT(study_date, '%Y-%m-%d') AS study_date, total_seconds 
       FROM daily_study_summary 
       WHERE user_id = ?`,
      [userId]
    );


const [keywordRows] = await db.execute(
  `SELECT keyword, total_seconds 
   FROM keyword_study_summary 
   WHERE user_id = ?`,
  [userId]
);

    // 그대로 넘겨도 문자열 형태로 들어옴
    const daily_study_summary = dailyRows;
    const keyword_study_summary = keywordRows;


    res.render('portfolio_edit', {
      name: req.user.name,
  about: portfolio?.about || '',
  profileImage: portfolio?.profile_image || '',
  skills,
  projects,
  daily_study_summary,
  keyword_study_summary,
  currentPath: req.path,
  user: req.user  // ✅ 전체 user 객체 넘겨줌
});
  } catch (err) {
    console.error('❌ 포트폴리오 불러오기 오류:', err);
    res.status(500).send('서버 오류');
  }
});

// ✅ 포트폴리오 저장 처리
app.post('/savePortfolio', upload.single('profileImage'), authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { about, skills, projects } = req.body;

  try {
    const [portfolioResult] = await db.execute('SELECT * FROM portfolio WHERE user_id = ?', [userId]);
    const portfolio = portfolioResult[0] || {};

    // ✅ 이미지 삭제 여부 먼저 확인
    const deleteImage = req.body.deleteImage === 'true';

    let profileImage;
    if (deleteImage) {
      profileImage = 'default.png';
    } else if (req.file) {
      profileImage = req.file.filename;
    } else if (portfolio.profile_image && portfolio.profile_image !== 'default.png') {
      profileImage = portfolio.profile_image;
    } else {
      profileImage = 'default.png';
    }

    // ✅ 여기서 profileImage 결정 후 UPDATE
    const [result] = await db.execute(
      `UPDATE portfolio SET about = ?, profile_image = ? WHERE user_id = ?`,
      [about, profileImage, userId]
    );

    if (result.affectedRows === 0) {
      await db.execute(
        `INSERT INTO portfolio (user_id, about, profile_image) VALUES (?, ?, ?)`,
        [userId, about, profileImage]
      );
    }

    // ✅ 스킬/프로젝트 업데이트
    await db.execute('DELETE FROM user_skills WHERE user_id = ?', [userId]);
    await db.execute('DELETE FROM user_projects WHERE user_id = ?', [userId]);

    const skillArr = JSON.parse(skills || '[]');
    for (const skill of skillArr) {
      await db.execute(
        'INSERT INTO user_skills (user_id, name, color) VALUES (?, ?, ?)',
        [userId, skill.name, skill.color]
      );
    }

    const projectArr = JSON.parse(projects || '[]');
    for (const project of projectArr) {
      await db.execute(
        'INSERT INTO user_projects (user_id, title, description) VALUES (?, ?, ?)',
        [userId, project.title, project.description]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ 포트폴리오 저장 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
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

      