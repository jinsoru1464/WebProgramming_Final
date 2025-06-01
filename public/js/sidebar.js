// 드롭다운 메뉴
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

// 타이머 로직
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

function updateTimerDisplay() {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  minuteTens.textContent = mins[0];
  minuteOnes.textContent = mins[1];
  secondTens.textContent = secs[0];
  secondOnes.textContent = secs[1];
}

startBtn?.addEventListener('click', () => {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    seconds++;
    updateTimerDisplay();
  }, 1000);

  timerLayout.classList.add('timer-active');
  timerMenu?.classList.add('timer-on');
  timerText.style.color = '#2C8FB9';
  timerIcon.src = '/images/Timer_blue.png';
});

stopBtn?.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;

  timerLayout.classList.remove('timer-active');
  timerMenu?.classList.remove('timer-on');
  timerText.style.color = '';
  timerIcon.src = '/images/Timer.png';

  const keyword = document.querySelector('.keyword-input').value.trim();
  if (!keyword) return;

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const displayTime = `${minutes}분 ${secs}초`;

  const recentGraph = document.getElementById('recentGraph');
  const block = document.createElement('div');
  block.className = 'block';
  block.title = `${keyword} - ${displayTime}`;
  const shade = Math.min(255, 150 + seconds);
  block.style.backgroundColor = `rgb(${255 - shade}, ${255}, ${255 - shade})`;

  if (recentGraph.children.length >= 5) {
    recentGraph.removeChild(recentGraph.children[0]);
  }
  recentGraph.appendChild(block);

  const token = localStorage.getItem('token');
  fetch('/api/timer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ keyword, seconds })
  })
    .then(res => res.json())
    .then(data => console.log('✅ 타이머 기록 저장 완료:', data))
    .catch(err => console.error('❌ 타이머 저장 실패:', err));

  document.querySelector('.keyword-input').value = '';
  seconds = 0;
  updateTimerDisplay();
});

// 최근 학습 불러오기
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  fetch('/api/timer/recent', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
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

        const shade = Math.min(255, 150 + duration_seconds);
        block.style.backgroundColor = `rgb(${255 - shade}, ${255}, ${255 - shade})`;

        recentGraph.appendChild(block);
      });
    })
    .catch(err => console.error('❌ 최근 학습 불러오기 실패', err));
});

// 로그아웃
document.querySelector('.logout-btn')?.addEventListener('click', () => {
  window.location.href = "/login";
});
