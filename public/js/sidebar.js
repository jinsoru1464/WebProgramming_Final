// 🔽 드롭다운 메뉴 토글
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const parent = toggle.parentElement;
    parent.classList.toggle('open');
    const arrow = toggle.querySelector('.arrow-icon');
    arrow.src = parent.classList.contains('open')
      ? '/images/toggleUp.png'
      : '/images/toggle.png';
  });
});

// ✅ 타이머 상태 변수
let seconds = 0;
let timerInterval;

const startBtn = document.querySelector('.start-btn');
const stopBtn = document.querySelector('.stop-btn');
const minuteTens = document.getElementById('minuteTens');
const minuteOnes = document.getElementById('minuteOnes');
const secondTens = document.getElementById('secondTens');
const secondOnes = document.getElementById('secondOnes');
const timerLayout = document.querySelector('.timer-layout');
const timerMenu = document.querySelector('.timer-menu');
const timerText = document.getElementById('timerText');
const timerIcon = document.getElementById('timerIcon');
const keywordInput = document.querySelector('.keyword-input');

function updateTimerDisplay() {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  document.getElementById('hourTens').textContent = hrs[0];
  document.getElementById('hourOnes').textContent = hrs[1];
  document.getElementById('minuteTens').textContent = mins[0];
  document.getElementById('minuteOnes').textContent = mins[1];
  document.getElementById('secondTens').textContent = secs[0];
  document.getElementById('secondOnes').textContent = secs[1];
}


// ▶ 타이머 시작
startBtn?.addEventListener('click', () => {
  if (timerInterval) return;

  const saved = localStorage.getItem('timerStartTime');
  if (!saved) {
    localStorage.setItem('timerStartTime', Date.now().toString());
  }

  const start = parseInt(localStorage.getItem('timerStartTime'), 10);
  seconds = Math.floor((Date.now() - start) / 1000);
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    seconds = Math.floor((Date.now() - start) / 1000);
    updateTimerDisplay();
  }, 1000);

  timerLayout.classList.add('timer-active');
  timerMenu?.classList.add('timer-on');
  timerText.style.color = '#2C8FB9';
  timerIcon.src = '/images/Timer_blue.png';
});

// ⏹ 타이머 정지
stopBtn?.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  localStorage.removeItem('timerStartTime');

  timerLayout.classList.remove('timer-active');
  timerMenu?.classList.remove('timer-on');
  timerText.style.color = '';
  timerIcon.src = '/images/Timer.png';

  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const displayTime = `${minutes}분 ${secs}초`;

  const recentGraph = document.getElementById('recentGraph');
  const block = document.createElement('div');
  block.className = 'block';
  block.title = `${keyword} - ${displayTime}`;
  const max = 14400; // 4시간 = 14400초
const ratio = Math.min(1, seconds / max); // 0~1
const lightness = 95 - (50 * ratio); // 95% → 45%로 줄어듦
block.style.backgroundColor = `hsl(120, 100%, ${lightness}%)`;



  if (recentGraph.children.length >= 5) {
    recentGraph.removeChild(recentGraph.children[0]);
  }
  recentGraph.appendChild(block);

  fetch('/api/timer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // ✅ 쿠키 기반 인증
    body: JSON.stringify({ keyword, seconds })
  })
    .then(res => res.json())
    .then(data => console.log('✅ 타이머 기록 저장 완료:', data))
    .catch(err => console.error('❌ 타이머 저장 실패:', err));

  keywordInput.value = '';
  seconds = 0;
  updateTimerDisplay();
});

// 🌱 최근 학습 + 타이머 복원
document.addEventListener('DOMContentLoaded', () => {
  const savedStartTime = localStorage.getItem('timerStartTime');
  if (savedStartTime) {
    const start = parseInt(savedStartTime, 10);
    seconds = Math.floor((Date.now() - start) / 1000);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      seconds = Math.floor((Date.now() - start) / 1000);
      updateTimerDisplay();
    }, 1000);

    timerLayout.classList.add('timer-active');
    timerMenu?.classList.add('timer-on');
    timerText.style.color = '#2C8FB9';
    timerIcon.src = '/images/Timer_blue.png';
  }

  fetch('/api/timer/recent', {
    method: 'GET',
    credentials: 'include'  // ✅ 쿠키 포함
  })
    .then(res => res.json())
    .then(data => {
      const recentGraph = document.getElementById('recentGraph');
      data.reverse().forEach(({ keyword, duration_seconds }) => {
        const block = document.createElement('div');
        block.className = 'block';
        const minutes = Math.floor(duration_seconds / 60);
        const seconds = duration_seconds % 60;
        block.title = `${keyword} - ${minutes}분 ${seconds}초`;
        
        const ratio = Math.min(1, duration_seconds / 14400);
        const lightness = 95 - (50 * ratio);
        block.style.backgroundColor = `hsl(120, 100%, ${lightness}%)`;


        recentGraph.appendChild(block);
      });
    })
    .catch(err => console.error('❌ 최근 학습 불러오기 실패', err));
});

// 🚪 로그아웃 (타이머만 초기화)
document.querySelector('.logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('timerStartTime');  // ✅ 타이머만 삭제
  window.location.href = "/logout";           // 서버에서 쿠키 삭제
});