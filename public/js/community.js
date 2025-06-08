const nav = document.querySelector(".cr-menu nav");
const buttons = document.querySelectorAll(".menu-btn");

// 현재 활성화된 버튼 추적
let activeButton = null;

// 버튼 클릭 시 active 설정
buttons.forEach((btn) => {
    btn.addEventListener("click", function (e) {
        e.preventDefault();

        //active 상태 초기화
        buttons.forEach((el) => el.classList.remove("active"));
        this.classList.add("active");
        activeButton = this;
    });
});

// nav 영역 바깥 클릭 시 active 해제
document.addEventListener("click", function (e) {
    const isInsideNav = nav.contains(e.target);
    if (!isInsideNav && activeButton) {
        activeButton.classList.remove("active");
        activeButton = null;
    }
});

//이미지가 없는 경우
document.addEventListener("DOMContentLoaded", function () {
    const cards = document.querySelectorAll(".card-img-top");

    cards.forEach((card) => {
        const img = card.querySelector("img");
        const tag = card.querySelector(".card-tag-placeholder");

        if (!img || !img.src || img.src.trim() === "" || img.src.includes("...")) {
            if (img) img.style.display = "none";
            if (tag) tag.style.display = "block";
        }
    });
});

//제목 바꾸기

window.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.querySelector(".cr-menu-wrapper");
    const buttons = document.querySelectorAll(".menu-btn");
    const title = document.querySelector(".page-title");
    let activeButton = null;

    buttons.forEach((btn) => {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            buttons.forEach((el) => el.classList.remove("active"));
            this.classList.add("active");
            activeButton = this;

            const newTitle = this.dataset.title || "Community";
            title.innerHTML = `<strong>${newTitle}</strong>`;
        });
    });

    document.addEventListener("click", function (e) {
        const isInside =
            wrapper.contains(e.target) ||
            e.target.classList.contains("floating-btn") ||
            e.target.classList.contains("write-btn");
        if (!isInside && activeButton) {
            activeButton.classList.remove("active");
            activeButton = null;
            title.innerHTML = `<strong>Community</strong>`;
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const contestBtn = document.getElementById("contestBtn");
    const studyBtn = document.getElementById("studyBtn");
    const mainLogo = document.getElementById("mainLogo");

    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            window.location.href = "/login";
        });
    }

    if (signUpBtn) {
        signUpBtn.addEventListener("click", () => {
            window.location.href = "/signUp";
        });
    }

    if (contestBtn) {
        contestBtn.addEventListener("click", () => {
            window.location.href = "/login";
        });
    }

    if (studyBtn) {
        studyBtn.addEventListener("click", () => {
            window.location.href = "/login";
        });
    }

    if (mainLogo) {
        mainLogo.addEventListener("click", () => {
            window.location.href = "/";
        });
    }
});

function filterCardsByTag(tagText) {
    const cards = document.querySelectorAll(".card");
    cards.forEach((card) => {
        const tagElement = card.querySelector(".tag");
        const placeholder = card.querySelector(".card-tag-placeholder");
        const tagValue = tagElement?.textContent || placeholder?.textContent || "";

        if (tagValue.includes(tagText)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

document.querySelectorAll(".menu-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
        const selectedTitle = this.dataset.title;

        const tagMap = {
            "Contet Member Recruitment": "#스터디원 모집",
            "Q&A": "#Q&A",
            "Contet Review": "#공모전 후기",
        };

        const tagToFilter = tagMap[selectedTitle] || null;

        if (tagToFilter) {
            filterCardsByTag(tagToFilter);
        } else {
            document.querySelectorAll(".card").forEach((card) => {
                card.style.display = "flex";
            });
        }
    });
});
