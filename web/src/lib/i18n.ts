export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Set on a GitHub Pages project site, where the app is served from /<repo>/.
 * Next rewrites its own asset URLs for this, but hand-written <a href> values
 * are ours to prefix.
 */
const BASE_PATH = (process.env.BASE_PATH ?? '').replace(/\/$/, '');

export const SITE = {
  name: 'StarVelocity',
  /** Override at build time for a real deployment. */
  url: (process.env.SITE_URL ?? 'https://starvelocity.example').replace(/\/$/, ''),
};

/**
 * English lives at the root and Vietnamese under /vi, matching how bilingual
 * sites are normally laid out: the default locale should not carry a prefix,
 * because the root URL is the one that accumulates authority.
 */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const withPrefix = locale === DEFAULT_LOCALE ? clean : `/vi${clean === '/' ? '' : clean}`;
  const withSlash = withPrefix === '' ? '/' : withPrefix.endsWith('/') ? withPrefix : `${withPrefix}/`;
  return `${BASE_PATH}${withSlash}`;
}

export function absoluteUrl(locale: Locale, path = '/'): string {
  return `${SITE.url}${localePath(locale, path)}`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'vi' : 'en';
}

interface Dict {
  localeName: string;
  otherLocaleName: string;
  nav: {
    trending: string;
    languages: string;
    rankings: string;
    methodology: string;
    about: string;
  };
  home: {
    tagline: string;
    /** Headline split in two so the second clause can carry the accent colour. */
    taglineLead: string;
    taglineAccent: string;
    risingStars: string;
    capturedOn: string;
    intro: string;
    ctaTrending: string;
    ctaMethodology: string;
    statRepos: string;
    statDays: (n: number) => string;
    statReviewed: string;
    statTrackedSince: string;
    sectionMovers: string;
    sectionLanguages: string;
    viewAll: string;
  };
  trending: {
    title: Record<'daily' | 'weekly' | 'monthly', string>;
    subtitle: Record<'daily' | 'weekly' | 'monthly', string>;
    periodLabel: Record<'daily' | 'weekly' | 'monthly', string>;
    sortAbs: string;
    sortRel: string;
    sortAccel: string;
  };
  velocity: {
    pendingTitle: string;
    pendingBody: (opts: { days: number; needed: number; window: string }) => string;
    fallbackNotice: string;
    perDay: string;
    gain: (window: string) => string;
    accelUp: string;
    accelDown: string;
    unknown: string;
  };
  repo: {
    viewDetail: string;
    stars: string;
    forks: string;
    language: string;
    license: string;
    created: string;
    lastPush: string;
    topics: string;
    chartTitle: string;
    chartEmpty: (days: number) => string;
    chartObserved: string;
    chartBackfilled: string;
    openOnGitHub: string;
    noReviewTitle: string;
    noReviewBody: string;
    qualityScore: string;
    relatedByOwner: string;
    relatedByLanguage: string;
  };
  languages: {
    title: string;
    subtitle: string;
    repos: string;
    inLanguage: (lang: string) => string;
  };
  owners: {
    usersTitle: string;
    orgsTitle: string;
    repos: string;
    reposBy: (owner: string) => string;
  };
  methodology: {
    title: string;
    lead: string;
    sections: { heading: string; body: string[] }[];
  };
  footer: {
    builtWith: string;
    notAffiliated: string;
    dataFrom: string;
    lastUpdated: string;
  };
  common: {
    notEnoughData: string;
    noindexNotice: string;
    backHome: string;
  };
  ui: {
    /** Each label describes the CURRENT mode, which is what the icon shows. */
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    switchLanguage: string;
    backToTop: string;
    askAi: string;
    closeAi: string;
  };
  about: {
    title: string;
    lead: string;
    cards: { heading: string; body: string }[];
    doTitle: string;
    doItems: string[];
    howTitle: string;
    howBody: string;
    independence: string;
  };
}

const en: Dict = {
  localeName: 'English',
  otherLocaleName: 'Tiếng Việt',
  nav: {
    trending: 'Trending',
    languages: 'Languages',
    rankings: 'Rankings',
    methodology: 'Methodology',
    about: 'About',
  },
  home: {
    tagline: 'Not the most starred. The fastest climbing.',
    taglineLead: 'Not the most starred.',
    taglineAccent: 'The fastest climbing.',
    risingStars: 'Rising stars',
    capturedOn: 'Captured',
    intro:
      'Ranking open source by total stars puts the same decade-old projects on top forever. ' +
      'StarVelocity measures how fast a repository is gaining stars right now, from its own ' +
      'daily record of every repo it tracks.',
    ctaTrending: 'See what is climbing',
    ctaMethodology: 'How this is measured',
    statRepos: 'repos tracked',
    statDays: (n) => (n === 1 ? 'day of history' : 'days of history'),
    statReviewed: 'reviewed',
    statTrackedSince: 'recording since',
    sectionMovers: 'Biggest movers',
    sectionLanguages: 'By language',
    viewAll: 'View all',
  },
  trending: {
    title: {
      daily: 'Climbing today',
      weekly: 'Climbing this week',
      monthly: 'Climbing this month',
    },
    subtitle: {
      daily: 'Star gain over the last day, measured against yesterday’s snapshot.',
      weekly: 'Star gain over the last seven days, normalised to a clean weekly figure.',
      monthly: 'Star gain over the last thirty days, with acceleration against the weekly rate.',
    },
    periodLabel: { daily: 'Day', weekly: 'Week', monthly: 'Month' },
    sortAbs: 'Star gain',
    sortRel: 'Relative growth',
    sortAccel: 'Accelerating',
  },
  velocity: {
    pendingTitle: 'Velocity is still accumulating',
    pendingBody: ({ days, needed, window }) =>
      `Velocity is derived from a time series, and this collector has ${days} day(s) of it so far. ` +
      `The ${window} window needs ${needed} more day(s) of recording before it can be computed. ` +
      'Until then the list below is ordered by total stars, which is a different thing and is labelled as such.',
    fallbackNotice: 'Ordered by total stars — velocity for this window is not available yet.',
    perDay: '/day',
    gain: (w) => `+${w}`,
    accelUp: 'speeding up',
    accelDown: 'cooling off',
    unknown: 'not yet known',
  },
  repo: {
    viewDetail: 'View repo',
    stars: 'Stars',
    forks: 'Forks',
    language: 'Language',
    license: 'License',
    created: 'Created',
    lastPush: 'Last push',
    topics: 'Topics',
    chartTitle: 'Star history',
    chartEmpty: (days) =>
      `Only ${days} observation(s) recorded so far — a chart needs at least two points. ` +
      'This fills in as the collector keeps running.',
    chartObserved: 'observed',
    chartBackfilled: 'reconstructed',
    openOnGitHub: 'Open on GitHub',
    noReviewTitle: 'No review written yet',
    noReviewBody:
      'This page carries verified GitHub metadata but no original review, so it is deliberately ' +
      'excluded from search engines. Pages are only indexed once someone has actually written about them.',
    qualityScore: 'Metadata score',
    relatedByOwner: 'More from this owner',
    relatedByLanguage: 'Others in',
  },
  languages: {
    title: 'Languages',
    subtitle: 'Every language represented in the tracked set, by repository count.',
    repos: 'repos',
    inLanguage: (lang) => `Climbing in ${lang}`,
  },
  owners: {
    usersTitle: 'Top users',
    orgsTitle: 'Top organizations',
    repos: 'repos',
    reposBy: (owner) => `Repositories by ${owner}`,
  },
  methodology: {
    title: 'How this works',
    lead:
      'Everything on this site is derived from data the collector recorded itself. This page explains ' +
      'exactly how, including what it cannot do.',
    sections: [
      {
        heading: 'GitHub is the only source',
        body: [
          'Stars, forks, topics, language, license and description all come from the GitHub API. ' +
          'Nothing is scraped from another directory and no README is republished.',
          'Metric values reflect the most recent sync, which runs twice a day.',
        ],
      },
      {
        heading: 'Velocity is measured, not estimated',
        body: [
          'The collector stores one row per repository per UTC day. Velocity is the difference ' +
          'between today’s star count and the count from one, seven or thirty days ago, divided by ' +
          'the actual gap in days and then normalised to the nominal window.',
          'Normalising matters: a missed run leaves an uneven gap, and comparing a raw six-day delta ' +
          'against a raw eight-day delta would rank repositories by scheduler luck rather than growth.',
          'Acceleration is the seven-day rate minus the thirty-day rate — whether a project is ' +
          'speeding up or cooling off. Relative growth divides the gain by the earlier total, which ' +
          'favours small projects breaking out over large ones ticking along.',
        ],
      },
      {
        heading: 'Unknown is not zero',
        body: [
          'When there is no earlier observation for a window, that window stays empty. It is never ' +
          'filled with a zero, because zero means "gained nothing" while empty means "we do not know".',
          'Historical star timestamps are not available to this collector: the GitHub endpoints that ' +
          'list who starred a repository are closed to it, even though the total count is public. ' +
          'That means there is no way to reconstruct the past — history only exists from the day ' +
          'recording started.',
        ],
      },
      {
        heading: 'What gets published',
        body: [
          'Every tracked repository is scored on verifiable metadata alone: description substance, ' +
          'log-scaled stars, fork-to-star ratio, topic count, push recency and license. The scorer ' +
          'cannot see page text, so a page can never be promoted by padding it with words.',
          'A good score makes a page buildable, not indexable. Only pages with an original review ' +
          'are indexed; everything else carries noindex and stays out of the sitemap.',
        ],
      },
      {
        heading: 'Known limits',
        body: [
          'Discovery uses the GitHub Search API, which returns at most 1,000 results per query. The ' +
          'collector slices queries by star range, creation date and language to work around that, ' +
          'but coverage of the long tail is partial and the collector logs when a query hits the ceiling.',
          'The tracked set is capped, so this is a curated slice of GitHub rather than all of it.',
          'This site is not affiliated with or endorsed by GitHub.',
        ],
      },
    ],
  },
  footer: {
    builtWith: 'Static site, rebuilt after every collection run.',
    notAffiliated: 'Not affiliated with GitHub.',
    dataFrom: 'Data from the GitHub API',
    lastUpdated: 'Last collected',
  },
  common: {
    notEnoughData: 'Not enough data yet',
    noindexNotice: 'This page is not indexed.',
    backHome: 'Back to home',
  },
  ui: {
    themeLight: 'Theme: light — click for dark',
    themeDark: 'Theme: dark — click to follow the system',
    themeSystem: 'Theme: follows the system — click for light',
    switchLanguage: 'Tiếng Việt',
    backToTop: 'Back to top',
    askAi: 'Ask an AI about this page',
    closeAi: 'Close',
  },
  about: {
    title: 'About StarVelocity',
    lead:
      'StarVelocity is a discovery layer for open source that ranks repositories by how fast ' +
      'they are gaining stars, not by how many they have. It keeps its own daily record of every ' +
      'repository it tracks, and every number on the site is derived from that record.',
    cards: [
      {
        heading: 'Measured, not estimated',
        body:
          'Velocity is the difference between two observations the collector made itself, ' +
          'normalised by the real gap between them. Nothing is modelled or guessed.',
      },
      {
        heading: 'Unknown is not zero',
        body:
          'A window with no earlier observation stays empty and says so. Zero would claim a ' +
          'repository gained nothing, which is a different statement entirely.',
      },
      {
        heading: 'Built for the climb',
        body:
          'Total stars reward age. Ranking by daily gain, relative growth and acceleration ' +
          'surfaces projects while they are still worth finding.',
      },
      {
        heading: 'Restraint over volume',
        body:
          'Thousands of repositories are tracked; only pages that clear the quality gate and ' +
          'carry an original review are published and indexed.',
      },
    ],
    doTitle: 'What you can do here',
    doItems: [
      'Browse what is climbing by day, week or month.',
      'Filter the same rankings by programming language.',
      'Open any repository for its star history, metrics and related projects.',
      'Read the methodology to see exactly how each figure is produced — and what cannot be produced.',
    ],
    howTitle: 'How this works',
    howBody:
      'A collector runs twice a day against the GitHub API, stores one row per repository per ' +
      'day, and derives velocity from that series. The site itself is a static build of that ' +
      'database, regenerated after every collection run.',
    independence:
      'StarVelocity is an independent project and is not affiliated with or endorsed by GitHub. ' +
      'Repository facts come from the GitHub API; everything else is our own work.',
  },
};

const vi: Dict = {
  localeName: 'Tiếng Việt',
  otherLocaleName: 'English',
  nav: {
    trending: 'Đang tăng',
    languages: 'Ngôn ngữ',
    rankings: 'Xếp hạng',
    methodology: 'Phương pháp',
    about: 'Giới thiệu',
  },
  home: {
    tagline: 'Không phải nhiều star nhất. Là tăng nhanh nhất.',
    taglineLead: 'Không phải nhiều star nhất.',
    taglineAccent: 'Là tăng nhanh nhất.',
    risingStars: 'Đang bứt phá',
    capturedOn: 'Ghi nhận',
    intro:
      'Xếp hạng theo tổng star khiến những dự án cả thập kỷ mãi đứng đầu. StarVelocity đo tốc độ ' +
      'một repo đang tăng star ngay lúc này, dựa trên bản ghi hằng ngày của chính nó cho từng repo.',
    ctaTrending: 'Xem repo đang tăng',
    ctaMethodology: 'Cách đo',
    statRepos: 'repo theo dõi',
    statDays: () => 'ngày dữ liệu',
    statReviewed: 'đã review',
    statTrackedSince: 'ghi nhận từ',
    sectionMovers: 'Tăng mạnh nhất',
    sectionLanguages: 'Theo ngôn ngữ',
    viewAll: 'Xem tất cả',
  },
  trending: {
    title: {
      daily: 'Tăng trong ngày',
      weekly: 'Tăng trong tuần',
      monthly: 'Tăng trong tháng',
    },
    subtitle: {
      daily: 'Số star tăng trong một ngày, so với snapshot hôm qua.',
      weekly: 'Số star tăng trong bảy ngày, đã chuẩn hoá về một tuần tròn.',
      monthly: 'Số star tăng trong ba mươi ngày, kèm gia tốc so với nhịp tuần.',
    },
    periodLabel: { daily: 'Ngày', weekly: 'Tuần', monthly: 'Tháng' },
    sortAbs: 'Star tăng',
    sortRel: 'Tăng tương đối',
    sortAccel: 'Đang tăng tốc',
  },
  velocity: {
    pendingTitle: 'Dữ liệu velocity đang được tích lũy',
    pendingBody: ({ days, needed, window }) =>
      `Velocity phải suy ra từ chuỗi thời gian, và collector hiện có ${days} ngày dữ liệu. ` +
      `Cửa sổ ${window} cần ghi nhận thêm ${needed} ngày nữa mới tính được. ` +
      'Trong lúc đó danh sách dưới đây sắp theo tổng star — một chỉ số khác, và được ghi rõ là như vậy.',
    fallbackNotice: 'Đang sắp theo tổng star — velocity cho cửa sổ này chưa có.',
    perDay: '/ngày',
    gain: (w) => `+${w}`,
    accelUp: 'đang tăng tốc',
    accelDown: 'đang chậm lại',
    unknown: 'chưa xác định',
  },
  repo: {
    viewDetail: 'Xem repo',
    stars: 'Star',
    forks: 'Fork',
    language: 'Ngôn ngữ',
    license: 'Giấy phép',
    created: 'Tạo ngày',
    lastPush: 'Push gần nhất',
    topics: 'Chủ đề',
    chartTitle: 'Lịch sử star',
    chartEmpty: (days) =>
      `Mới ghi nhận ${days} điểm dữ liệu — biểu đồ cần ít nhất hai điểm. ` +
      'Phần này sẽ đầy lên khi collector tiếp tục chạy.',
    chartObserved: 'quan sát trực tiếp',
    chartBackfilled: 'dựng lại',
    openOnGitHub: 'Mở trên GitHub',
    noReviewTitle: 'Chưa có bài review',
    noReviewBody:
      'Trang này có metadata GitHub đã xác thực nhưng chưa có bài review gốc, nên bị loại khỏi ' +
      'công cụ tìm kiếm một cách có chủ đích. Chỉ khi có người thật sự viết về nó thì trang mới được index.',
    qualityScore: 'Điểm metadata',
    relatedByOwner: 'Repo khác của chủ sở hữu',
    relatedByLanguage: 'Repo khác thuộc',
  },
  languages: {
    title: 'Ngôn ngữ',
    subtitle: 'Toàn bộ ngôn ngữ xuất hiện trong tập theo dõi, theo số lượng repo.',
    repos: 'repo',
    inLanguage: (lang) => `Đang tăng trong ${lang}`,
  },
  owners: {
    usersTitle: 'Người dùng nổi bật',
    orgsTitle: 'Tổ chức nổi bật',
    repos: 'repo',
    reposBy: (owner) => `Repo của ${owner}`,
  },
  methodology: {
    title: 'Cách hoạt động',
    lead:
      'Mọi thứ trên site này suy ra từ dữ liệu do chính collector ghi lại. Trang này giải thích ' +
      'chính xác bằng cách nào, kể cả những điều nó không làm được.',
    sections: [
      {
        heading: 'GitHub là nguồn duy nhất',
        body: [
          'Star, fork, chủ đề, ngôn ngữ, giấy phép và mô tả đều lấy từ GitHub API. Không scrape ' +
          'từ thư mục nào khác và không đăng lại README.',
          'Giá trị các chỉ số phản ánh lần đồng bộ gần nhất, chạy hai lần mỗi ngày.',
        ],
      },
      {
        heading: 'Velocity được đo, không phải ước lượng',
        body: [
          'Collector lưu một dòng cho mỗi repo mỗi ngày UTC. Velocity là hiệu số star hôm nay trừ ' +
          'số star của một, bảy hoặc ba mươi ngày trước, chia cho khoảng cách ngày thực tế rồi ' +
          'chuẩn hoá về cửa sổ danh nghĩa.',
          'Việc chuẩn hoá là cần thiết: một lần chạy bị bỏ sẽ tạo khoảng cách lệch, và so sánh delta ' +
          'sáu ngày với delta tám ngày sẽ xếp hạng theo may mắn của scheduler chứ không theo tăng trưởng.',
          'Gia tốc là nhịp bảy ngày trừ nhịp ba mươi ngày — cho biết dự án đang tăng tốc hay chậm lại. ' +
          'Tăng tương đối lấy mức tăng chia cho tổng trước đó, giúp dự án nhỏ bứt phá không bị dự án ' +
          'lớn nhưng đi ngang đè mất.',
        ],
      },
      {
        heading: 'Không biết khác với bằng không',
        body: [
          'Khi không có quan sát nào trước đó cho một cửa sổ, cửa sổ đó để trống. Nó không bao giờ ' +
          'bị điền số 0, vì 0 nghĩa là "không tăng gì" còn trống nghĩa là "chúng tôi không biết".',
          'Collector không lấy được mốc thời gian của từng star: các endpoint GitHub liệt kê ai đã ' +
          'star một repo bị chặn với nó, dù tổng số star vẫn công khai. Nghĩa là không có cách nào ' +
          'dựng lại quá khứ — lịch sử chỉ tồn tại từ ngày bắt đầu ghi nhận.',
        ],
      },
      {
        heading: 'Trang nào được công bố',
        body: [
          'Mỗi repo được chấm điểm chỉ dựa trên metadata kiểm chứng được: độ chất của mô tả, star ' +
          'theo thang log, tỷ lệ fork trên star, số chủ đề, độ mới của lần push và giấy phép. Bộ chấm ' +
          'điểm không đọc được nội dung trang, nên không thể đẩy hạng một trang bằng cách nhồi chữ.',
          'Điểm cao chỉ khiến trang đủ điều kiện được tạo, chứ không đủ điều kiện được index. Chỉ ' +
          'trang có bài review gốc mới được index; phần còn lại mang thẻ noindex và không vào sitemap.',
        ],
      },
      {
        heading: 'Giới hạn đã biết',
        body: [
          'Phần tìm kiếm dùng GitHub Search API, chỉ trả về tối đa 1.000 kết quả mỗi truy vấn. ' +
          'Collector chia truy vấn theo khoảng star, ngày tạo và ngôn ngữ để vượt giới hạn đó, nhưng ' +
          'độ phủ phần đuôi dài vẫn là một phần, và collector ghi log khi một truy vấn chạm ngưỡng.',
          'Tập theo dõi có giới hạn số lượng, nên đây là một phần được tuyển chọn của GitHub, không phải toàn bộ.',
          'Site này không liên kết với và không được GitHub bảo trợ.',
        ],
      },
    ],
  },
  footer: {
    builtWith: 'Site tĩnh, build lại sau mỗi lần thu thập dữ liệu.',
    notAffiliated: 'Không liên kết với GitHub.',
    dataFrom: 'Dữ liệu từ GitHub API',
    lastUpdated: 'Thu thập lần cuối',
  },
  common: {
    notEnoughData: 'Chưa đủ dữ liệu',
    noindexNotice: 'Trang này không được index.',
    backHome: 'Về trang chủ',
  },
  ui: {
    themeLight: 'Giao diện: sáng — bấm để chuyển tối',
    themeDark: 'Giao diện: tối — bấm để theo hệ thống',
    themeSystem: 'Giao diện: theo hệ thống — bấm để chuyển sáng',
    switchLanguage: 'English',
    backToTop: 'Lên đầu trang',
    askAi: 'Hỏi AI về trang này',
    closeAi: 'Đóng',
  },
  about: {
    title: 'Giới thiệu StarVelocity',
    lead:
      'StarVelocity là lớp khám phá mã nguồn mở, xếp hạng repo theo tốc độ tăng star chứ không ' +
      'theo tổng số star. Nó tự ghi lại dữ liệu hằng ngày cho từng repo đang theo dõi, và mọi ' +
      'con số trên site đều suy ra từ bản ghi đó.',
    cards: [
      {
        heading: 'Đo đạc, không ước lượng',
        body:
          'Velocity là hiệu số giữa hai quan sát do chính collector thực hiện, chuẩn hoá theo ' +
          'khoảng cách ngày thực tế. Không mô hình hoá, không phỏng đoán.',
      },
      {
        heading: 'Không biết khác với bằng không',
        body:
          'Cửa sổ chưa có quan sát trước đó sẽ để trống và ghi rõ như vậy. Số 0 nghĩa là repo ' +
          'không tăng gì — một khẳng định hoàn toàn khác.',
      },
      {
        heading: 'Dành cho thứ đang lên',
        body:
          'Tổng star tưởng thưởng cho tuổi đời. Xếp theo mức tăng mỗi ngày, tăng tương đối và ' +
          'gia tốc giúp dự án lộ diện khi còn đáng tìm.',
      },
      {
        heading: 'Chọn lọc thay vì số lượng',
        body:
          'Hàng nghìn repo được theo dõi, nhưng chỉ trang vượt cổng chất lượng và có bài review ' +
          'gốc mới được công bố và cho index.',
      },
    ],
    doTitle: 'Bạn làm được gì ở đây',
    doItems: [
      'Xem repo đang tăng theo ngày, tuần hoặc tháng.',
      'Lọc cùng bảng xếp hạng đó theo ngôn ngữ lập trình.',
      'Mở từng repo để xem lịch sử star, các chỉ số và dự án liên quan.',
      'Đọc trang phương pháp để biết chính xác mỗi con số được tạo ra thế nào — và điều gì không thể tạo ra.',
    ],
    howTitle: 'Cách vận hành',
    howBody:
      'Collector chạy hai lần mỗi ngày với GitHub API, lưu một dòng cho mỗi repo mỗi ngày, rồi ' +
      'suy ra velocity từ chuỗi đó. Bản thân site là một bản build tĩnh của cơ sở dữ liệu ấy, ' +
      'được tạo lại sau mỗi lần thu thập.',
    independence:
      'StarVelocity là dự án độc lập, không liên kết với và không được GitHub bảo trợ. Dữ liệu ' +
      'repo lấy từ GitHub API; phần còn lại do chúng tôi tự làm.',
  },
};

export const dictionaries: Record<Locale, Dict> = { en, vi };

export function t(locale: Locale): Dict {
  return dictionaries[locale];
}
