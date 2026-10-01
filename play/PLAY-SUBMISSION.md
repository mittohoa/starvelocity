# Google Play — hồ sơ phát hành StarVelocity

Mọi giá trị dưới đây là **giá trị thật đã build/verify trên máy này**, không
phải mẫu điền. Ngày dựng: 01/10/2026.

---

## 1. Định danh ứng dụng

| | |
| - | - |
| **Application ID (package name)** | `dev.starvelocity.app` |
| Namespace Kotlin | `dev.starvelocity.app` |
| Application ID bản debug | `dev.starvelocity.app.debug` |
| Tên hiển thị | StarVelocity |
| versionCode / versionName | `1` / `0.1.0` |
| minSdk / targetSdk / compileSdk | 26 (Android 8.0) / 36 (Android 16) / 37 |

**Application ID là vĩnh viễn.** Sau lần upload đầu tiên, Google Play khoá nó
lại: không đổi tên, không đổi chữ hoa/thường được nữa. Muốn một package name
khác thì phải sửa **trước** khi bấm upload lần đầu.

`targetSdk = 36` đã thoả yêu cầu bắt buộc của Play (bản phát hành mới phải
target API 36 trở lên). `minSdk = 26` giữ nguyên để app còn cài được trên
~99% thiết bị đang hoạt động.

---

## 2. Chữ ký và SHA-256

### Upload key (key đang nằm trong máy bạn)

| | |
| - | - |
| File | `android/keystore/upload-keystore.jks` (PKCS12) |
| Alias | `upload` |
| Thuật toán | RSA 4096, chữ ký SHA384withRSA |
| Hiệu lực | 01/10/2026 → 23/09/2056 (10.950 ngày) |
| Subject | `CN=StarVelocity, OU=StarVelocity, O=StarVelocity, L=Ho Chi Minh City, ST=Ho Chi Minh, C=VN` |

```
SHA-256: 8F:68:26:5E:3B:F4:01:A8:56:EC:33:F2:E4:CD:F8:49:
         F2:78:E6:69:B5:D4:99:57:5C:38:AC:A9:E5:66:41:69

SHA-1:   1F:79:07:90:A6:28:DF:F9:30:00:31:AA:01:F7:1B:91:14:AD:23:BD
```

Lấy lại bất cứ lúc nào:

```bash
"C:/Program Files/Android/Android Studio2/jbr/bin/keytool" -list -v \
  -keystore android/keystore/upload-keystore.jks -alias upload
```

### Hai SHA-256 khác nhau — đừng nhầm

Play App Signing ký lại app bằng **key của Google**, không phải key của bạn:

- **Upload certificate SHA-256** (ở trên) — chỉ dùng để Play xác thực *ai đang
  upload*. Mất key này thì phải mở ticket xin Google reset upload key.
- **App signing certificate SHA-256** — do Google sinh ra khi bạn tạo app trong
  Console, và **đây mới là fingerprint thiết bị người dùng nhìn thấy**. Lấy tại
  *Play Console → Test and release → Setup → App signing*.

Khi nào cần đến bản của Google: đăng ký Firebase, Google Sign-In, Maps API,
App Links / `assetlinks.json`. Lúc đó **phải dùng app signing SHA-256**, dùng
upload SHA-256 sẽ không hoạt động trên bản tải từ Play.

### Sao lưu — việc này không hoãn được

`android/keystore/` và `android/keystore.properties` đã được `.gitignore`, nên
chúng **không** nằm trong repo. Nghĩa là chỉ còn đúng một bản trên ổ E:. Chép
ngay cả hai sang password manager hoặc một archive có mã hoá.

Mật khẩu keystore (dùng chung cho store và key) nằm trong
`android/keystore.properties` — file đó đã `.gitignore`, và mật khẩu **cố ý
không ghi vào tài liệu này** vì tài liệu được commit lên repo public.

Mật khẩu đã đi qua cửa sổ chat lúc sinh key, nên nếu muốn chặt chẽ thì đổi lại:

```bash
cd android
KT="C:/Program Files/Android/Android Studio2/jbr/bin/keytool"
"$KT" -storepasswd -keystore keystore/upload-keystore.jks
"$KT" -keypasswd  -keystore keystore/upload-keystore.jks -alias upload
# rồi sửa 2 dòng password trong android/keystore.properties
```

Đổi **mật khẩu** không làm đổi fingerprint — SHA-256 ở trên vẫn đúng. Chỉ khi
tạo **key mới** fingerprint mới đổi, và sau lần upload đầu thì không đổi key
được nữa.

---

## 3. File AAB

| | |
| - | - |
| File nộp | `play/StarVelocity-0.1.0-vc1.aab` |
| Nguồn | `android/app/build/outputs/bundle/release/app-release.aab` |
| Kích thước | 3,4 MB (3.530.942 bytes) |
| SHA-256 của file | `208afd75b69b19f27f5a45cb7730fb883cb80dca47f7f0377c4cfec88326f083` |
| Đã ký | ✅ `jar verified` — ký bằng upload key ở mục 2 |
| Minify / shrink | ✅ R8 bật, `isShrinkResources = true` |
| API base nhúng trong bundle | `https://mittohoa.github.io/starvelocity/api/` (đã verify trong `classes.dex`; placeholder `starvelocity.example` không còn xuất hiện) |

Lệnh build lại y hệt:

```bash
cd android
export JAVA_HOME="/c/Program Files/Android/Android Studio2/jbr"
./gradlew bundleRelease -Pstarvelocity.apiBase=https://mittohoa.github.io/starvelocity/api/
```

JDK phải là 17+ (máy này dùng JBR 21 của Android Studio). JDK 11 trên PATH
**không** build được AGP 9.

Cấu hình ký đọc từ `android/keystore.properties`, và fallback sang biến môi
trường `ANDROID_KEYSTORE_FILE` / `ANDROID_KEYSTORE_PASSWORD` /
`ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` cho CI. Thiếu cả hai thì bản
release ra **không ký** và Gradle in cảnh báo ngay lúc configure, thay vì để
bạn phát hiện lúc upload.

---

## 4. Khai báo trong Play Console

### App details

| Mục | Giá trị |
| --- | --- |
| App name | `StarVelocity` |
| Default language | English (United States) — có thêm bản dịch Tiếng Việt |
| App or game | App |
| Free or paid | Free (không đổi sang paid được sau khi publish free) |
| Category | Tools |
| Tags | Developer tools, Utilities |
| Email liên hệ | `ttqlcntt.dev1@hutech.edu.vn` |
| Website | `https://mittohoa.github.io/starvelocity/` |
| Privacy policy URL | ⚠️ xem mục 8 — **chưa có, bắt buộc phải có** |

### App access

> All functionality is available without special access.

Không có đăng nhập, không có vùng khoá. Reviewer mở app là thấy toàn bộ.

### Ads

> **No**, this app does not contain ads.

Không có SDK quảng cáo nào trong `app/build.gradle.kts`.

### Content rating (IARC questionnaire)

| Câu hỏi | Trả lời |
| --- | --- |
| Category | Utility, Productivity, Communication, or Other |
| Bạo lực / tình dục / ngôn từ thô tục / chất kích thích / cờ bạc | Không, với tất cả |
| App có chia sẻ vị trí người dùng? | Không |
| App cho phép người dùng tương tác / giao tiếp với nhau? | Không |
| App có nội dung do người dùng tạo? | Không — nội dung hiển thị là metadata repo công khai lấy từ GitHub, người dùng không đăng gì |
| App có mua hàng số? | Không |

Kết quả dự kiến: **Everyone / PEGI 3 / 3+**.

### Target audience and content

| | |
| - | - |
| Độ tuổi mục tiêu | **18 and over** |
| App có hấp dẫn trẻ em không? | Không |

Chọn 18+ là có chủ đích: đây là công cụ cho lập trình viên, và khai 18+ giúp
app nằm ngoài Families Policy — ít ràng buộc hơn hẳn mà không mất người dùng
thật.

### Data safety

Câu trả lời đúng là **"No, this app does not collect or share any user data"**.
Kiểm chứng được: toàn bộ mạng của app là các request `GET` trong
`data/Repository.kt`, chỉ gắn header `Accept: application/json`, không gửi
identifier nào. Không có SDK analytics / crash / ads.

Phần Security practices vẫn khai:

| | |
| - | - |
| Dữ liệu được mã hoá khi truyền | **Có** — toàn bộ HTTPS; cleartext chỉ được mở cho `localhost` và `10.0.2.2` ở **bản debug**, release dùng mặc định của hệ thống nên HTTP thường bị chặn |
| Người dùng có thể yêu cầu xoá dữ liệu | Không áp dụng — không thu thập gì. Cache và preference nằm trên máy, gỡ app là mất |
| App tuân theo Families Policy | Không áp dụng (18+) |
| Đã qua đánh giá bảo mật độc lập | Không |

### Government apps / Financial features / Health

Không, cả ba.

### Foreground service

Nếu Console hỏi về quyền `FOREGROUND_SERVICE`: quyền này do thư viện
**AndroidX WorkManager** tự thêm vào manifest, app **không** tự chạy foreground
service nào. `DigestWorker` là `PeriodicWorkRequest` 1 ngày/lần, không
expedited, không gọi `setForeground()`. Nếu buộc phải khai use case thì mô tả
đúng như vậy.

---

## 5. Nội dung store listing

### Tiếng Anh (ngôn ngữ mặc định)

**App name** (≤ 30 ký tự — đang dùng 12)

```
StarVelocity
```

**Short description** (≤ 80 — đang dùng 73)

```
GitHub repos ranked by stars gained per day, not by lifetime star totals.
```

**Full description** (≤ 4000)

```
StarVelocity ranks public GitHub repositories by how fast they are gaining
stars right now — not by how many stars they have accumulated over the years.

That distinction is the entire point. A ranking by total stars shows the same
decade-old repositories forever. A ranking by stars-per-day shows what is
climbing today, which is what a discovery tool is actually for.

WHAT YOU GET

• Three time windows — 1 day, 7 days, 30 days — each ranked by star gain over
  that window.
• A language filter, so you can look at only the ecosystem you work in.
• A velocity bar under every row, sized by that repository's share of the
  fastest climber's gain. It shows the shape of the distribution, not just the
  order.
• Repository detail with stars, forks, language, license and a link straight to
  GitHub.
• An optional daily digest notification naming what actually climbed.
• English and Vietnamese.
• Light, dark, or follow the system.

WORKS OFFLINE

Responses are cached to disk and served when the network is unavailable, with a
banner saying how old the copy is. The data behind the app is refreshed twice a
day, so a cached answer is almost always current — and a commuter underground
sees yesterday's ranking instead of an error screen.

HONEST ABOUT WHAT IT KNOWS

Velocity cannot be computed from a single observation; it needs a time series.
When the underlying history is too short to derive a window, the app does not
invent a number. It says so in a banner, marks each row "not yet known", and
falls back to ordering by total stars — clearly labelled as a different measure.
The daily digest stays silent on those days rather than sending you a list of
the biggest repositories dressed up as news.

NO ACCOUNT, NO TRACKING

There is no sign-in and no account. The app collects nothing: no analytics, no
advertising, no crash reporting, no identifiers of any kind. It reads a set of
pre-built public JSON files over HTTPS and renders them. Your theme, filter and
cached data stay on your device.
```

### Tiếng Việt

**Short description** (≤ 80 — đang dùng 70)

```
Xếp hạng repo GitHub theo số star tăng mỗi ngày, không theo tổng star.
```

**Full description**

```
StarVelocity xếp hạng các repository GitHub công khai theo tốc độ tăng star ở
thời điểm hiện tại — chứ không theo tổng số star tích luỹ qua nhiều năm.

Khác biệt đó chính là lý do app tồn tại. Xếp theo tổng star thì mãi mãi vẫn là
những repo cũ cả thập kỷ đứng đầu. Xếp theo star/ngày mới cho thấy cái gì đang
đi lên hôm nay — và đó mới là việc của một công cụ khám phá.

CÓ GÌ

• Ba khung thời gian — 1 ngày, 7 ngày, 30 ngày — mỗi khung xếp theo mức tăng
  star trong khung đó.
• Bộ lọc ngôn ngữ, để chỉ xem đúng hệ sinh thái bạn đang làm.
• Thanh velocity dưới mỗi dòng, dài ngắn theo tỷ lệ so với repo tăng nhanh
  nhất. Nó cho thấy hình dạng của phân bố, không chỉ thứ tự.
• Chi tiết repo: star, fork, ngôn ngữ, giấy phép, và link mở thẳng sang GitHub.
• Thông báo tổng hợp hằng ngày (tuỳ chọn), nêu đúng tên những repo đã tăng.
• Tiếng Việt và tiếng Anh.
• Giao diện sáng, tối, hoặc theo hệ thống.

DÙNG ĐƯỢC KHI OFFLINE

Dữ liệu tải về được lưu cache xuống máy và dùng lại khi mất mạng, kèm banner
nói rõ bản cache cũ bao lâu. Dữ liệu gốc chỉ cập nhật hai lần một ngày, nên bản
cache gần như luôn còn đúng — và người đang đi tàu điện ngầm sẽ thấy bảng xếp
hạng của hôm qua thay vì một màn hình lỗi.

TRUNG THỰC VỀ NHỮNG GÌ NÓ BIẾT

Không thể tính velocity từ một lần đo; nó cần một chuỗi thời gian. Khi lịch sử
dữ liệu chưa đủ dài để suy ra một khung, app không bịa ra con số. Nó báo rõ
bằng banner, ghi "chưa xác định" ở từng dòng, và tạm xếp theo tổng star — có
ghi rõ đó là một chỉ số khác. Những ngày như vậy, thông báo hằng ngày im lặng
thay vì gửi cho bạn danh sách repo to nhất rồi gọi đó là tin tức.

KHÔNG TÀI KHOẢN, KHÔNG THEO DÕI

Không đăng nhập, không tài khoản. App không thu thập gì: không analytics,
không quảng cáo, không crash reporting, không định danh nào hết. Nó đọc một bộ
file JSON công khai dựng sẵn qua HTTPS rồi hiển thị. Giao diện, bộ lọc và dữ
liệu cache nằm lại trên máy bạn.
```

---

## 6. Release notes — bản 0.1.0 (versionCode 1)

**EN** (`en-US`, ≤ 500 ký tự)

```
First release.

• Trending GitHub repositories ranked by stars gained per day, over 1-, 7- and
  30-day windows.
• Filter by language; tap any repository for detail and a link to GitHub.
• Works offline from a disk cache, and tells you how old that cache is.
• Optional once-a-day digest notification.
• English and Vietnamese; light, dark or system theme.
• No account, no tracking, no ads.
```

**VI** (`vi`)

```
Bản phát hành đầu tiên.

• Xếp hạng repo GitHub theo mức tăng star mỗi ngày, với ba khung 1, 7 và 30
  ngày.
• Lọc theo ngôn ngữ; chạm vào repo bất kỳ để xem chi tiết và mở trên GitHub.
• Dùng được khi offline nhờ cache, và luôn nói rõ cache cũ bao lâu.
• Thông báo tổng hợp một lần mỗi ngày (tuỳ chọn).
• Tiếng Việt và tiếng Anh; giao diện sáng, tối hoặc theo hệ thống.
• Không tài khoản, không theo dõi, không quảng cáo.
```

---

## 7. Asset đồ hoạ

| Asset | Trạng thái | Spec |
| --- | --- | --- |
| App icon | ✅ `play/icon-512.png` | 512×512 PNG 32-bit, dựng từ chính vector launcher nên không lệch với icon trong app |
| Feature graphic | ✅ `play/feature-graphic-1024x500.png` | 1024×500 PNG |
| Phone screenshots | ⚠️ đã chụp 6 tấm — xem mục 8 | `play/screenshots/native/` (1080×2340, dùng trước) và `play/screenshots/9x16/` (1080×1920, dự phòng nếu Console từ chối tỷ lệ gốc) |
| Tablet screenshots | ⬜ không bắt buộc | Chỉ cần nếu muốn app hiện trên tab "Tablet optimised" |

Hai asset đã có được sinh lại được bằng script ở
`scripts/make-play-assets.py`, đọc thẳng path data từ
`android/app/src/main/res/drawable/ic_launcher_foreground.xml` — nên icon cửa
hàng không thể lệch khỏi icon launcher.

Screenshot chụp ngày 01/10/2026 trên máy thật **SM-A507FN** (Android 13,
1080×2340), status bar đã dọn bằng SystemUI demo mode (9:30, pin 100%, không
icon thông báo):

| File | Nội dung |
| --- | --- |
| `01-feed-vi-dark.png` | Feed khung Tuần, tiếng Việt, giao diện tối |
| `02-language-filter-vi-dark.png` | Feed đang lọc TypeScript |
| `03-repo-detail-vi-dark.png` | Bottom sheet chi tiết repo |
| `04-feed-vi-light.png` | Feed, giao diện sáng |
| `05-feed-en-dark.png` | Feed, tiếng Anh |
| `06-repo-detail-en-dark.png` | Chi tiết repo, tiếng Anh |

Mỗi tấm có hai bản: `native/` giữ nguyên 1080×2340 (đẹp nhất, Play thường chấp
nhận) và `9x16/` thu nhỏ rồi đệm hai bên thành 1080×1920 đúng tỷ lệ 9:16 — dùng
bản này nếu Console từ chối tỷ lệ gốc. Sinh lại bằng
`scripts/pack-screenshots.py`.

---

## 8. Những thứ còn chặn, theo thứ tự

1. **Privacy policy URL — bắt buộc, chưa có.**
   Nội dung đã viết sẵn ở `PRIVACY.md` (gốc repo). Hai cách đưa lên:
   - Nhanh nhất: push repo lên GitHub, URL sẽ là
     `https://github.com/mittohoa/<repo>/blob/main/PRIVACY.md`. Play chấp nhận
     URL này.
   - Gọn hơn: thêm route `/privacy/` và `/vi/privacy/` vào `web/`, rồi dùng
     `https://mittohoa.github.io/starvelocity/privacy/`.

2. **`https://mittohoa.github.io/starvelocity/api/` phải đang chạy thật.**
   Hiện còn **404** — site chưa deploy. Nộp khi URL còn chết thì reviewer mở
   app ra thấy màn hình lỗi và từ chối với lý do broken functionality.

   Vì sao là đường dẫn con chứ không phải root: `https://mittohoa.github.io/`
   **đã bị project khác chiếm** — "TÔI ĐI — chỉ đường xe buýt & metro",
   redirect sang `/toidi/`. StarVelocity vì thế phải là project page, build với
   `BASE_PATH=/starvelocity`, deploy từ repo tên `starvelocity`.

   Các bước: tạo repo `starvelocity` → push code → Settings → Pages → Source:
   GitHub Actions → đặt repo variable `BASE_PATH=/starvelocity` và
   `SITE_URL=https://mittohoa.github.io` → chạy workflow `collect` rồi `web`.
   Kiểm tra trước khi nộp:

   ```bash
   curl -I https://mittohoa.github.io/starvelocity/api/meta.json
   ```

3. **Velocity trong screenshot còn là "chưa xác định".**
   Database chỉ có hai mốc: 25/09 và 01/10 (mốc thứ hai do lần chạy này tạo
   ra). Khoảng cách 6 ngày rơi đúng kẽ hở của `computeVelocity`: quá cũ cho cửa
   sổ 1 ngày (dung sai 2 ngày), quá mới cho cửa sổ 7 ngày — hàm tìm mốc tham
   chiếu *tại hoặc trước* `ngày − 7`, tức 24/09. Backfill không cứu được:
   GitHub đã khoá stargazer list, và `src/collector/backfill.ts` ghi lại đúng
   điều đó.

   **Chạy `npm run snapshot && npm run velocity` vào ngày 02/10 là d1 và d7 có
   số thật** — lúc đó mốc 25/09 đúng 7 ngày và mốc 01/10 đúng 1 ngày. d30 phải
   chờ tới khoảng 25/10. Sau đó chạy `npm --prefix web run emit-api` rồi chụp
   lại: mọi dòng sẽ hiện mức tăng star thật kèm thanh velocity, thay cho "chưa
   xác định". Bộ ảnh hiện tại dùng được cho internal testing, nhưng **nên chụp
   lại trước khi nộp production**.

4. **Closed testing 12 người × 14 ngày.**
   Tài khoản developer cá nhân mở sau 13/11/2023 bắt buộc chạy closed testing
   với tối thiểu 12 tester opt-in liên tục 14 ngày trước khi được xin production
   access. Nếu tài khoản của bạn thuộc diện này thì đây là việc dài ngày nhất —
   nên bắt đầu trước, song song với việc làm screenshot.

---

## 9. Thứ tự thao tác trong Console

1. **Create app** — tên `StarVelocity`, English (US), App, Free.
2. Chấp nhận **Play App Signing** (mặc định, nên giữ).
3. **Test and release → Testing → Internal testing → Create release** → upload
   `play/StarVelocity-0.1.0-vc1.aab`.
4. Sau khi upload xong, vào **Setup → App signing** chép lại **app signing
   certificate SHA-256** của Google — lưu lại cho sau này.
5. Điền lần lượt: App access, Ads, Content rating, Target audience, Data safety,
   Government apps, Financial features, Health (mục 4).
6. **Store listing**: icon, feature graphic, screenshot, mô tả EN + VI (mục 5).
7. Chạy internal testing, rồi closed testing nếu tài khoản bị ràng buộc 12/14.
8. **Production → Create release**, dán release notes (mục 6), gửi duyệt.

Bản sau nhớ tăng `versionCode` trong `android/app/build.gradle.kts` — Play từ
chối bundle trùng versionCode.
