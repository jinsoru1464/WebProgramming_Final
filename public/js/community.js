// ✅ community.js 수정용 리팩토링 (경로 통일)
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".cr-menu nav");
  const buttons = document.querySelectorAll(".menu-btn");
  const title = document.querySelector(".page-title");
  const loginBtn = document.getElementById("loginBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const contestBtn = document.getElementById("contestBtn");
  const studyBtn = document.getElementById("studyBtn");
  const mainLogo = document.getElementById("mainLogo");

  let activeButton = null;

  const titleToCategoryMap = {
    "스터디원 모집": "스터디원 모집",
    "Q&A": "Q&A",
    "공모전 후기": "공모전 후기",
  };

  // 🔹 메뉴 버튼 클릭 시 동작
  buttons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      buttons.forEach((el) => el.classList.remove("active"));
      this.classList.add("active");
      activeButton = this;

      const newTitle = this.textContent.trim();
      if (title) {
        title.innerHTML = `<strong>${newTitle}</strong>`;
      }

      const category = titleToCategoryMap[newTitle] || newTitle;
      window.location.href = `/community?category=${encodeURIComponent(category)}`;
    });
  });

  document.addEventListener("click", function (e) {
    const isInsideNav = nav?.contains(e.target);
    if (!isInsideNav && activeButton) {
      activeButton.classList.remove("active");
      activeButton = null;
    }
  });

  // 🔹 로고 및 버튼 처리
  if (loginBtn) loginBtn.addEventListener("click", () => window.location.href = "/login");
  if (signUpBtn) signUpBtn.addEventListener("click", () => window.location.href = "/signUp");
  if (contestBtn) contestBtn.addEventListener("click", () => window.location.href = "/login");
  if (studyBtn) studyBtn.addEventListener("click", () => window.location.href = "/login");
  if (mainLogo) mainLogo.addEventListener("click", () => window.location.href = "/");
});