// ✅ Chart.js 관련 CDN은 HTML에 아래와 같이 삽입해 주세요.
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>

document.addEventListener("DOMContentLoaded", () => {
  // 🔹 상단 버튼 이벤트
  const loginBtn = document.getElementById("loginBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const contestBtn = document.getElementById("contestBtn");
  const studyBtn = document.getElementById("studyBtn");
  const mainLogo = document.getElementById("mainLogo");

  if (loginBtn) loginBtn.addEventListener("click", () => window.location.href = "/login");
  if (signUpBtn) signUpBtn.addEventListener("click", () => window.location.href = "/signUp");
  if (contestBtn) contestBtn.addEventListener("click", () => window.location.href = "/login");
  if (studyBtn) studyBtn.addEventListener("click", () => window.location.href = "/login");
  if (mainLogo) mainLogo.addEventListener("click", () => window.location.href = "/");

  // 🔹 프로젝트 카드 삭제
  document.querySelectorAll('.project-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const wrapper = e.target.closest('.project-added-card');
      if (wrapper) wrapper.remove();
    });
  });

  // 🔹 기존 스킬 hover 삭제
  document.querySelectorAll('.skill-button').forEach(skill => {
    applySkillHoverEvent(skill);
  });

  // 🔹 프로필 이미지 미리보기
  const fileInput = document.getElementById("profileInput");
  const preview = document.getElementById("profilePreview");
  const placeholder = document.getElementById("photoPlaceholder");

  fileInput?.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = "block";
        placeholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  // 🔹 저장 버튼
  const saveBtn = document.getElementById("saveBtn");
  saveBtn?.addEventListener("click", () => {
    const name = document.querySelector(".name-input").value;
    const about = document.querySelector(".about-textarea").value;
    const skills = Array.from(document.querySelectorAll(".skill-button")).map(skill => ({
      name: skill.querySelector(".skill-input").value,
      color: skill.querySelector(".color-picker").value
    }));
    const projects = Array.from(document.querySelectorAll(".project-added-card")).map(card => ({
      title: card.querySelector(".project-title-input").value,
      description: card.querySelector(".project-description").value
    }));

    const formData = new FormData();
    const userId = document.getElementById("userId").value;
    formData.append('id', userId);
    formData.append('name', name);
    formData.append('about', about);
    formData.append('skills', JSON.stringify(skills));
    formData.append('projects', JSON.stringify(projects));

    const deleteImage = document.getElementById('deleteImage')?.value || 'false';
formData.append('deleteImage', deleteImage);


    const profileFile = fileInput.files[0];
    if (profileFile) formData.append('profileImage', profileFile);

    fetch('/savePortfolio', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('저장 완료!');
        window.location.href = `/portfolio/${userId}`;
      } else {
        alert('저장 실패!');
      }
    })
    .catch(err => {
      console.error(err);
      alert('저장 중 오류 발생!');
    });
  });

  // 🔹 스킬 hover 삭제 기능 적용
  function applySkillHoverEvent(skill) {
    let hoverTimer;
    skill.addEventListener('mouseenter', () => {
      hoverTimer = setTimeout(() => {
        skill.classList.add('show-delete');
        skill.addEventListener('click', removeOnClick);
      }, 1000);
    });
    skill.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      skill.classList.remove('show-delete');
      skill.removeEventListener('click', removeOnClick);
    });
    function removeOnClick() {
      if (skill.classList.contains('show-delete')) skill.remove();
    }
  }

  // 🔹 스킬/프로젝트 추가 버튼용 함수 (UI용)
  window.addSkill = function() {
    const container = document.getElementById('skillList');
    const skill = document.createElement('div');
    skill.className = 'skill-button';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'skill-input';
    input.placeholder = '스킬 입력';

    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'color-picker';
    color.addEventListener('input', (e) => {
      skill.style.backgroundColor = e.target.value;
    });

    skill.appendChild(input);
    skill.appendChild(color);
    container.appendChild(skill);
    applySkillHoverEvent(skill);
  }

  window.addProjectCard = function() {
    const container = document.getElementById('project-card-container');
    const wrapper = document.createElement('div');
    wrapper.classList.add('project-added-card');
    wrapper.innerHTML = `
      <div class="project-label">
        <input type="text" class="project-title-input" placeholder="이름을 입력하세요" />
        <p class="project-delete">X</p>
      </div>
      <hr class="project-divider" />
      <div class="project-detail">
        <textarea class="project-description" placeholder="프로젝트 내용을 입력하세요"></textarea>
      </div>
    `;
    container.appendChild(wrapper);
    wrapper.querySelector('.project-delete').addEventListener('click', () => wrapper.remove());
    requestAnimationFrame(() => wrapper.classList.add('show'));
  }

  // 🔹 캘린더 그리드 생성
  const studyData = window.studyData || [];
  const keywordData = window.keywordData || [];

  const calendarTrack = document.getElementById("calendarTrack");
  const dataMap = {};
  studyData.forEach(({ study_date, total_seconds }) => {
    const key = new Date(study_date).toISOString().split("T")[0];
    dataMap[key] = total_seconds;
  });

  const today = new Date();
  const days = 84;
  let currentColumn = null;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(today.getDate() - (days - 1 - i));
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];
    const seconds = dataMap[dateStr] || 0;

    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.style.backgroundColor = getColor(seconds);
    cell.title = `${dateStr} / ${Math.floor(seconds / 60)}분`;

    if (dayOfWeek === 0 || i === 0) {
      currentColumn = document.createElement("div");
      currentColumn.className = "calendar-column";
      calendarTrack.appendChild(currentColumn);
    }
    if (currentColumn) currentColumn.appendChild(cell);
  }

  const studyDaysCount = studyData.filter(d => d.total_seconds > 0).length;
  document.getElementById('studyDays').innerText = `현재 ${studyDaysCount}일`;

  // 🔹 키워드 파이 차트 생성
  // 🔹 키워드 파이 차트 생성 (상위 3개만 표시)
const ctx = document.getElementById("keywordPieChart").getContext("2d");

// 상위 3개 키워드 추출
const topKeywords = keywordData
  .sort((a, b) => b.total_seconds - a.total_seconds)
  .slice(0, 3);

const labels = topKeywords.map(item => item.keyword);
const data = topKeywords.map(item => item.total_seconds);
const totalSeconds = data.reduce((a, b) => a + b, 0);
const backgroundColors = ['#ffc107', '#f28b82', '#a7ffeb'];

new Chart(ctx, {
  type: 'pie',
  data: {
    labels,
    datasets: [{
      data,
      backgroundColor: backgroundColors.slice(0, labels.length),
      borderColor: '#fff',
      borderWidth: 2,
    }]
  },
  options: {
    responsive: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
  const value = context.parsed;
  const minutes = Math.floor(value / 60);
  return `${context.label}: ${minutes}분`;
}

        }
      },
      datalabels: {
        color: '#333',
        font: {
          size: 14,
          weight: 'bold'
        },
        formatter: (value, context) => {
          const label = context.chart.data.labels[context.dataIndex];
          const percentage = ((value / totalSeconds) * 100).toFixed(1);
          return `${label}\n${percentage}%`;
        }
      }
    }
  },
  plugins: [ChartDataLabels]
});


  function getColor(seconds) {
    if (seconds >= 7200) return '#216e39';
    if (seconds >= 3600) return '#4caf50';
    if (seconds >= 1800) return '#a1d99b';
    if (seconds > 0) return '#d9f0d3';
    return '#eee';
  }
});
