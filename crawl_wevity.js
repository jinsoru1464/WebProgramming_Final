const axios = require("axios");
const cheerio = require("cheerio");
const mysql = require("mysql2/promise");

// ✅ MySQL 연결
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'honesty1234',
  database: 'ggj_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const BASE_URL = "https://www.wevity.com";

// ✅ 전체 페이지 순회
async function crawlListAndSave() {
  let page = 1;
  while (true) {
    console.log(`📄 페이지 ${page} 크롤링 중...`);
    const { data } = await axios.get(`${BASE_URL}/?c=find&s=1&gbn=list&gp=${page}`);
    const $ = cheerio.load(data);
    const listItems = $("ul.list li").not(".top");

    if (listItems.length === 0) {
      console.log("✅ 더 이상 페이지 없음. 종료!");
      break;
    }

    for (const el of listItems.toArray()) {
      const $el = $(el);

      const title = $el.find(".tit a").first().text().trim().replace(/\s+/g, " ");
      const href = $el.find(".tit a").attr("href");
      const ixMatch = href.match(/ix=(\d+)/);
      const ix = ixMatch ? parseInt(ixMatch[1], 10) : null;

      const 분야 = $el.find(".sub-tit").text().replace("분류 :", "").trim();
      const 주최_주관 = $el.find(".organ").text().trim();
      const read_count = parseInt($el.find(".read").text().replace(/,/g, "")) || 0;

      const detailData = await crawlDetail(ix);

      // ✅ DB 저장 - 중복 방지 (ix UNIQUE인 경우 INSERT IGNORE)
      await pool.execute(`
        INSERT IGNORE INTO contests 
        (ix, title, read_count, img_src, 분야, 응모대상, 주최_주관, 후원_협찬, 접수마감일, 총_상금, 일등_상금, 홈페이지, 첨부파일) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ix,
        title,
        read_count,
        detailData.img_src,
        detailData.분야,
        detailData.응모대상,
        주최_주관,
        detailData.후원_협찬,
        detailData.접수마감일,
        detailData.총_상금,
        detailData.일등_상금,
        detailData.홈페이지,
        detailData.첨부파일
      ]);

      console.log(`✅ 저장 완료: [${ix}] ${title}`);
    }

    page++;
  }

  console.log("🎉 전체 공모전 크롤링 완료!");
}

// ✅ 상세 페이지 크롤링
async function crawlDetail(ix) {
  const URL = `${BASE_URL}/?c=find&s=1&gbn=view&gp=1&ix=${ix}`;
  const { data } = await axios.get(URL);
  const $ = cheerio.load(data);

  const img_src = $(".cd-area .thumb img").attr("src");
  const fullImgSrc = img_src ? `${BASE_URL}${img_src}` : null;

  const getTextAfterTitle = (title) =>
    $(`.cd-info-list li:has(span.tit:contains("${title}"))`)
      .text()
      .replace(title, "")
      .trim();

  const 분야 = getTextAfterTitle("분야");
  const 응모대상 = getTextAfterTitle("응모대상");
  const 후원_협찬 = getTextAfterTitle("후원/협찬") || "";

  const 접수기간 = getTextAfterTitle("접수기간");
  let 접수마감일 = 접수기간?.split("~")[1]?.trim();
  const dateMatch = 접수마감일?.match(/\d{4}-\d{2}-\d{2}/);
  접수마감일 = dateMatch ? dateMatch[0] : null;

  const 총_상금 = getTextAfterTitle("총 상금");
  const 일등_상금 = getTextAfterTitle("1등 상금");

  const 홈페이지 = $(`.cd-info-list li:has(span.tit:contains("홈페이지")) a`).attr("href") || null;
  const 첨부파일텍스트 = getTextAfterTitle("첨부파일");
  const 첨부파일 = 첨부파일텍스트 === "파일없음"
    ? null
    : $(`.cd-info-list li:has(span.tit:contains("첨부파일")) a`).attr("href") || 첨부파일텍스트;

  return {
    img_src: fullImgSrc,
    분야,
    응모대상,
    후원_협찬,
    접수마감일,
    총_상금,
    일등_상금,
    홈페이지,
    첨부파일
  };
}

// 🚀 실행
crawlListAndSave();
