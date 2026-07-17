# YNDA — Product & Experience Implementation Specification

**Phiên bản:** 1.0  
**Ngày:** 17/07/2026  
**Trạng thái:** Architecture specification — không chứa mã nguồn  
**Đối tượng sử dụng:** Founder, Product, Design, Engineering, Community, Event, Finance, Sponsor/Partnership, coding AI triển khai  
**Theme chuẩn hóa:** “Ghi lại những khoảnh khắc trước khi chúng trở thành ký ức.”

---

## Cách đọc và nguyên tắc phạm vi

Tài liệu này được xây từ việc khảo sát repository hiện tại, gồm landing page, community, dashboard, registration, schedule, certificate verification, backend Express/serverless, Firebase rules, payment flow và hai tài liệu kế hoạch trong thư mục `Kế hoạch`. Không có mã nguồn nào được sửa.

Các đề xuất có mã `Rxx`. Mỗi đề xuất đều có đủ: **Problem, Reason, Impact, Priority, Implementation Difficulty, Files/Pages affected, Expected Result, KPI** tại mục 19. Các mục còn lại tham chiếu mã này để tránh lặp và để đội triển khai có một backlog duy nhất.

Giới hạn khảo sát: không có browser runtime khả dụng nên chưa thể chạy visual regression hoặc kiểm thử tương tác trên trình duyệt thật. Đánh giá giao diện dựa trên cấu trúc HTML/CSS, breakpoint, copy, event handler và luồng dữ liệu tĩnh. Các giả định cần kiểm chứng được liệt kê ở mục 18.

---

# 1. Executive Summary

YNDA có nền móng đáng giá: định vị điện ảnh học đường, ngôn ngữ thương hiệu xanh đêm–vàng, hệ thống tài khoản, cộng đồng, đội thi, mentor, workshop, mini-challenge, peer review, chấm giải, certificate, tài chính và vận hành nội bộ. Vấn đề không phải thiếu tính năng mà là thiếu một kiến trúc sản phẩm ưu tiên hành trình. Hiện tại trải nghiệm giống một bộ công cụ quản trị rất lớn gắn vào một landing page nhỏ, trong khi lời hứa “tham gia một hành trình” chưa được thể hiện thành tiến trình có hướng dẫn.

Đề xuất chuyển YNDA từ “website cuộc thi + dashboard” thành **creative journey platform theo mùa**:

> Discover → Join Community → Learn → Practice → Receive Feedback → Build Reputation → Form a Team → Compete → Showcase → Become Alumni/Mentor → Return Next Season.

Ba quyết định chiến lược không nên thỏa hiệp:

1. **Không pay-to-win.** Tiền không mua vote, XP, rank, shortlist hoặc lợi thế chấm giải. Community vote chỉ quyết định “Audience Choice”; giải chuyên môn do hội đồng độc lập quyết định theo rubric công khai.
2. **Growth over vanity.** XP và danh tiếng ưu tiên hoàn thành, tiến bộ, feedback hữu ích, hỗ trợ cộng đồng và tính nhất quán; không ưu tiên follower, spam hoặc số lượng bài thô.
3. **Trust before scale.** Làm rõ tư cách pháp lý, cách dùng cụm từ “phi lợi nhuận”, quyền dữ liệu, quyền tác phẩm, bảo vệ người chưa thành niên, xung đột lợi ích và báo cáo thu–chi trước khi tăng trưởng/tài trợ lớn.

Mục tiêu 12 tháng: xây một vòng lặp mùa giải có thể vận hành lặp lại; đạt activation 60%, workshop completion 55%, feedback turnaround dưới 7 ngày, season completion 35%, next-season intent 45%, và không có sự cố nghiêm trọng về thanh toán/dữ liệu/công bằng.

---

# 2. Complete Product Vision

## 2.1 Product thesis

Người trẻ không thiếu video hướng dẫn; họ thiếu một môi trường có deadline vừa sức, người đồng hành, phản hồi có cấu trúc, cơ hội cộng tác, bằng chứng tiến bộ và sân khấu công nhận. YNDA phải bán **động lực, ngữ cảnh thực hành, chất lượng phản hồi và belonging**, không bán nội dung video đơn thuần.

## 2.2 Vision, mission, promise

- **Vision:** Trở thành hệ sinh thái khởi đầu đáng tin cậy nhất cho người trẻ Việt Nam muốn kể chuyện bằng hình ảnh.
- **Mission:** Giúp một người từ “mình thích điện ảnh nhưng chưa biết bắt đầu” tạo ra tác phẩm đầu tiên, nhận phản hồi tử tế, tìm được cộng sự và tiếp tục ở mùa sau.
- **Member promise:** Mỗi tuần có một bước nhỏ rõ ràng; mỗi đóng góp có cơ hội được ghi nhận; mỗi tác phẩm nhận được phản hồi; không chỉ người thắng mới có giá trị.
- **Sponsor promise:** Tiếp cận người trẻ sáng tạo trong một môi trường học tập có đo lường, an toàn thương hiệu và minh bạch quyền lợi.

## 2.3 Product principles

1. **Journey before feature:** mọi màn hình trả lời “Tôi đang ở đâu? Bước tiếp theo là gì? Vì sao đáng làm?”.
2. **One primary CTA:** mỗi trạng thái có một hành động chính, tối đa hai hành động phụ.
3. **Evidence-based recognition:** điểm, badge, certificate phải truy ngược được về hoạt động và người phê duyệt.
4. **Human feedback is premium value:** mentor/peer feedback có SLA, rubric và quality rating.
5. **Public by choice:** hồ sơ, tác phẩm nháp, tuổi, trường, vị trí và tiến độ mặc định riêng tư phù hợp.
6. **Mobile-first creation:** mọi tác vụ cốt lõi làm được ở 360 px, mạng chậm, thiết bị giá rẻ.
7. **Accessible cinema:** phụ đề/transcript, reduced motion, keyboard, contrast và ngôn ngữ dễ hiểu là yêu cầu sản phẩm.
8. **Seasonal continuity:** season kết thúc bằng archive, portfolio và lời mời vai trò tiếp theo; không kết thúc bằng màn hình “đã trao giải”.

## 2.4 Audience value matrix

| Persona | Vì sao ở lại | Vì sao rời đi | Vì sao trả tiền/đóng góp | Vì sao trở lại mùa sau |
|---|---|---|---|---|
| Khách lần đầu | Câu chuyện rõ, tác phẩm thật, lộ trình dễ hiểu | Hero chung chung, quá nhiều menu, thiếu bằng chứng | Không trả ngay; chỉ ủng hộ sau khi tin | Theo dõi theme mới và showcase |
| Filmmaker | Mentor, ekip, feedback, showcase, portfolio | Chấm giải thiếu công bằng, feedback chậm | Clinic nhỏ, vé gala, dịch vụ tùy chọn | Rank/portfolio/alumni tiếp nối |
| Photographer | Challenge hình ảnh, vai trò DOP/stills, showcase | Sản phẩm chỉ nói về đạo diễn/phim | Review portfolio, photowalk tùy chọn | Hạng mục và commission mới |
| Sinh viên | Bạn bè, kỹ năng, certificate có bằng chứng | Tốn thời gian, UI khó dùng, phí mơ hồ | Chi phí thấp có giá trị rõ; không bắt buộc | Cơ hội leadership/mentor/alumni |
| Sponsor | Brand-safe reach, talent pipeline, impact report | Logo-only, số liệu vanity, rủi ro trẻ vị thành niên | Tài trợ activation có đo lường | Dữ liệu cohort và season story |
| Judge | Quy trình độc lập, rubric, conflict disclosure | Spam, chấm tay hỗn loạn, can thiệp sponsor | Không phải khách trả tiền | Uy tín chuyên môn và alumni impact |
| Mentor | Nhóm nhỏ, công cụ feedback, giới hạn tải | Không SLA, quá nhiều mentee, hỏi lặp lại | Có thể tham gia pro bono/fee minh bạch | Theo dõi sự tiến bộ của cohort |
| Volunteer | Vai trò rõ, checklist, points, recommendation | Việc mơ hồ, burnout, title inflation | Không nên thu phí | Lộ trình Member → Lead → Alumni |
| President | Dashboard vận hành, RACI, cảnh báo rủi ro | Hơn 50 module ngang hàng, dữ liệu phân mảnh | Ngân sách công cụ vận hành | Hệ thống bàn giao và impact report |
| Founder | IP thương hiệu, governance, tăng trưởng bền vững | Bus factor, khủng hoảng trust, scope vô hạn | Đầu tư vào nền tảng lõi | Season sau ít phụ thuộc cá nhân hơn |

## 2.5 Product boundaries

**YNDA làm:** learning journey, community, challenge/competition, mentorship, portfolio/showcase, alumni, event operations.  
**YNDA chưa làm trong 12 tháng:** mạng xã hội đại trà, marketplace thiết bị có thanh toán, LMS video quy mô lớn, hệ thống tuyển dụng thương mại, streaming platform, chứng chỉ đào tạo được nhà nước công nhận.

---

# 3. Website Improvement Report

## 3.1 Evidence-based diagnosis

- `index.html`, `community.html`, `dashboard.html` mỗi tệp khoảng 714–740 KB và 11.000+ dòng; có hàng trăm inline styles/onClick và phần lớn logic trùng nhau. Đây là rủi ro hiệu năng, regression và drift nội dung (`R14`).
- Landing chỉ có bốn section chính: hero, prize pool, events, about/rules, recruitment. Nó chưa kể journey, workshop, mentor, community proof, gallery, sponsor hoặc Hall of Fame (`R01–R05`).
- Navigation công khai trộn nhiệm vụ khách (“Sự kiện”, “Cộng đồng”) với công cụ nội bộ (“Lịch họp & PV”, “Tuyển dụng”), làm giảm conversion của người sáng tạo (`R02`).
- Copy hiện tại dùng hai slogan khác nhau; tài liệu season dùng theme thứ ba. Cần một hệ thống message có thứ bậc (`R01`).
- Trang chủ tuyên bố 100% community vote, trong khi tài liệu kế hoạch đề cập giám khảo chuyên môn và hệ thống đã có module judging. Đây là mâu thuẫn trust lớn (`R10`).
- Logic “mua tối đa 5 vote” và giao dịch loại `vote` vẫn tồn tại trong client/backend dù không hiện CTA chính. Phải loại khỏi product policy và migration dữ liệu (`R10`, `R17`).
- Prize pool công khai nói 70/30, tài liệu kế hoạch cũ nói 100% phí vào giải, tài liệu handbook lại yêu cầu quỹ/chi phí tách biệt. Cần một nguồn sự thật (`R13`).
- Sitemap chỉ có homepage; các trang community, season, gallery, workshops, Hall of Fame không được index độc lập (`R15`).
- Các trang chính dùng title/OG giống nhau, thiếu canonical và structured data theo Event/Course/CreativeWork (`R15`).
- Footer có legal links và social links nhưng thiếu contact, governance, sponsor kit, report, accessibility statement, season status và newsletter (`R05`).

## 3.2 Landing page specification

Thứ tự desktop và mobile giống nhau:

1. **Announcement bar:** Season status + deadline + link chi tiết; ẩn khi không có season.
2. **Header:** logo; Hành trình; Học & thực hành; Tác phẩm; Về YNDA; CTA “Tham gia cộng đồng”; menu account tách biệt.
3. **Hero:** theme; value proposition một câu; CTA chính “Bắt đầu hành trình”; CTA phụ “Xem tác phẩm”; visual là frame/still từ community có consent, không phải poster thông tin.
4. **Trust strip:** số người đã hoàn thành, số feedback, số tỉnh/trường, mentor/partner; chỉ hiện số đã xác minh và ghi mốc thời gian.
5. **Journey rail:** 10 bước với current season marker; mỗi bước mở mô tả và expected effort.
6. **Featured works:** 3–6 tác phẩm có ảnh, logline, vai trò đội, phụ đề, link profile; không hiển thị vote như thước đo giá trị mặc định.
7. **Learning promise:** “YouTube cho kiến thức; YNDA cho thực hành, phản hồi, cộng sự và deadline.”
8. **Upcoming workshops/challenges:** ngày, level, outcome, capacity, accessibility, CTA.
9. **Community proof:** câu chuyện tiến bộ trước/sau; quotes có consent; link member directory.
10. **Competition:** eligibility, timeline, rubric, jury independence, Audience Choice, prize policy.
11. **Hall of Fame:** winner + growth + contribution + mentor/alumni, tránh chỉ tôn vinh giải nhất.
12. **Sponsor/partner:** impact proposition, current partners, CTA tải one-page deck/liên hệ.
13. **FAQ:** phí, thiết bị, độ tuổi, team, bản quyền, dữ liệu, feedback, certificate.
14. **Final CTA:** chọn một trong ba intent: “Tạo tác phẩm”, “Đóng góp chuyên môn”, “Đồng hành tài trợ”.
15. **Footer:** sitemap, contact, legal, reports, accessibility, social, newsletter, season archive.

## 3.3 CTA and copy system

- CTA người mới: **Bắt đầu hành trình**.
- CTA member: **Tiếp tục bước tiếp theo**.
- CTA đã hoàn tất: **Xem tiến bộ của tôi**.
- CTA competition eligible: **Tạo/đăng ký đội thi**.
- Không dùng “Đăng ký tham gia” khi chưa nói người dùng nhận gì, mất bao lâu, có phí hay không.
- “Phi lợi nhuận” chỉ xuất hiện sau khi tư cách và báo cáo phù hợp; trước đó dùng “dự án cộng đồng” và mô tả cách tái đầu tư ngân sách.

## 3.4 Navigation and footer states

Header phải có ba trạng thái: anonymous, member, organizer. Mobile dùng bottom navigation cho bốn nhiệm vụ member: Hôm nay, Học, Cộng đồng, Hồ sơ; phần còn lại trong More. Dashboard organizer là product surface riêng, không lẫn vào public/member nav.

---

# 4. UX Improvement Report

## 4.1 Core usability problems

1. **Choice overload:** hơn 50 tab trong dashboard; cần gom theo job và progressive disclosure (`R06`).
2. **Weak orientation:** không có home theo trạng thái cho biết next best action (`R07`).
3. **Modal overuse:** form dài, profile, payment, feedback và nhiều thao tác nằm trong modal; mobile và keyboard khó sử dụng (`R08`).
4. **Role leakage:** “member” nhìn thấy mục công việc BTC; organizer và creator context trộn nhau (`R06`).
5. **Inconsistent terminology:** “member/thành viên/thí sinh”, “event/dự án/hoạt động”, “vote/bình chọn” dùng không thống nhất (`R01`).
6. **Accessibility semantics:** nhiều `div/span/a href="#"` đóng vai button; label không luôn liên kết `for`; modal thiếu focus trap/restore; emoji truyền nghĩa; canvas animation và iframe cần alternative (`R08`).
7. **Error recovery:** toast là kênh chính, thiếu field-level error summary, draft autosave, retry và support code (`R08`).
8. **Mobile density:** bảng, kanban, form quản trị và side menu quá dày; cần card/table switch và sticky action (`R06`, `R08`).

## 4.2 Member home (“Hôm nay”)

Thứ tự:

- Greeting + Season Progress (không dùng streak gây áp lực).
- One primary “Next step” card, gồm effort ước lượng, deadline, reward, reason.
- Feedback inbox: cần trả lời/đã nhận.
- Team status: missing roles, next milestone, risk.
- Upcoming workshop/calendar.
- Weekly XP summary và “vì sao nhận điểm”.
- Community highlights được cá nhân hóa theo role, không endless feed.

Empty state phải có starter action; loading dùng skeleton; error state giữ data cũ và nút retry; deadline state có timezone; locked state giải thích điều kiện mở.

## 4.3 Accessibility requirements

- Mức mục tiêu WCAG 2.2 AA.
- Contrast body ≥ 4.5:1; text lớn ≥ 3:1; focus indicator ≥ 3:1.
- Tất cả action dùng semantic button/link; keyboard order theo visual order.
- Skip link đến main; một H1 mỗi trang; landmark header/nav/main/footer.
- Modal: focus vào heading/field đầu, trap focus, Escape đóng khi an toàn, trả focus về trigger.
- Reduced motion tắt canvas và parallax; không chỉ rút animation duration về 0.
- Video/tác phẩm công khai cần caption tiếng Việt; workshop recording có transcript trong 7 ngày.
- Error không chỉ dùng màu; live region cho async; countdown không thông báo mỗi giây.
- Font body tối thiểu 16 px; tap target 44×44 CSS px; zoom 200% không mất chức năng.
- Form cho người chưa thành niên có plain-language consent và contact người giám hộ khi cần.

---

# 5. Community System

## 5.1 Community model

Community không phải một feed chung; nó là năm vòng có mục tiêu:

1. **Orientation circle:** newcomer introductions, code of conduct, starter challenge.
2. **Practice circle:** prompts, mini-challenge, peer review.
3. **Production circle:** team finder, project rooms, diary, risk help.
4. **Showcase circle:** public gallery, screening, critique session.
5. **Alumni circle:** mentor, volunteer, judge pool, partner opportunities.

## 5.2 Content types and controls

| Type | Purpose | Required fields | Visibility | Retention action |
|---|---|---|---|---|
| Introduction | Find peers | role, level, region optional, goal | Members | Suggest 3 people/groups |
| Work-in-progress | Ask focused feedback | artifact, question, feedback mode | Team/circle/public | Remind to close feedback loop |
| Resource | Curated learning | source, license, why useful | Members/public | Save to learning plan |
| Opportunity | Crew/mentor/event | owner, deadline, eligibility | Members | Match by skills |
| Reflection | Capture growth | before/after, lesson, next step | Private/team/public | Add to portfolio |
| Showcase | Present completed work | credits, rights, captions, consent | Public | Archive/Hall of Fame |

## 5.3 Safety and moderation

- Code of conduct, reporting taxonomy, evidence preservation and appeal flow.
- SLA: imminent safety <1h; harassment/privacy <12h; spam/copyright <24h; normal report <72h.
- Minor protection: no public exact school/class/location by default; no adult–minor private mentoring without approved channel/log; guardian consent for offline activity/image use where required.
- Three moderation levels: automated guardrail, trained moderator, safeguarding lead/founder escalation.
- Sanctions: nudge → content limitation → temporary restriction → removal; written reason and appeal.
- Community score never giảm vì báo cáo safety thiện chí.

## 5.4 Community rituals

- Monday Prompt; Wednesday WIP Clinic; Friday Frame Showcase; monthly regional circle.
- “Feedback debt”: nhận hai review có ích thì được nhắc review lại hai tác phẩm, nhưng không khóa quyền cơ bản.
- Season closing includes retrospective, alumni invitation and role recommendation.

---

# 6. Workshop System

## 6.1 Why attend instead of YouTube

Mỗi workshop phải cung cấp ít nhất ba trong năm giá trị độc quyền: brief theo season; live diagnosis; bài thực hành có deadline; feedback từ mentor/peer; artifact dùng được trong phim/portfolio. Nếu chỉ là bài giảng một chiều, không nên gọi là workshop.

## 6.2 Workshop blueprint

- **Before (3–7 ngày):** diagnostic 5 phút; pre-work 20 phút; submit question; accessibility needs.
- **Live 90 phút:** 10' framing, 15' demo, 20' guided practice, 25' breakout critique, 15' mentor hot seats, 5' commitment.
- **After (72 giờ):** artifact submission; rubric self-check; peer pair; mentor samples 20–30% bài theo rotation.
- **Within 7 ngày:** transcript/recording, annotated examples, common mistakes, next challenge.

## 6.3 Interaction and feedback

- Cohort 24–40; breakout 4–6; 1 facilitator/room guide; mentor ratio mục tiêu 1:20 cho clinic.
- Feedback format: **Observe → Effect → Question → Suggestion**; tránh “hay/dở” không bằng chứng.
- Mentor response template: strength, one high-leverage change, example, next action, confidence.
- Member rates feedback on specificity/actionability/respect; quality below 3/5 triggers coach review, không công khai bêu tên.

## 6.4 Learning measurement

Four levels: attendance; artifact completion; rubric delta pre/post; transfer into production. Workshop completion requires attendance ≥70% hoặc xem recording + quiz, artifact submitted, self-reflection. Certificate học tập ghi hours, outcomes, evidence ID; không gọi là chứng chỉ nghề nghiệp.

---

# 7. Competition System

## 7.1 Season lifecycle

1. Theme reveal and rules freeze.
2. Eligibility + individual/team registration.
3. Learning sprint.
4. Mini-challenge calibration.
5. Production milestones and mentor office hours.
6. Draft checkpoint (optional/private).
7. Final submission and automated completeness check.
8. Compliance review: rights, duration, consent, safety, captions.
9. Public gallery and Audience Choice.
10. Blind jury scoring.
11. Consensus/variance review and conflict recusal.
12. Finalist screening/interview only if published in rules.
13. Award ceremony.
14. Feedback release, showcase, archive, alumni transition.

## 7.2 Submission requirements

Immutable submission version after deadline except accessibility/copyright correction approved and logged. Required: title, logline, film link/master, captions, poster, team credits, category, device declaration, music/media rights, participant/image consent, AI-use disclosure, content warnings, backup contact. Server issues receipt, timestamp, checksum/version ID.

## 7.3 Scoring policy

**Official jury awards:** 100% jury score. **Audience Choice:** separate award based on verified community voting. Sponsor, donation, XP, follower count and paid activity have zero effect on official judging.

Jury rubric (100): story/idea 25; directing & emotional clarity 20; visual language 15; editing & sound 15; theme 10; originality/ethics 10; accessibility/presentation 5. Every criterion has 1–5 anchored descriptors; weighted to 100. At least three judges per film. A score >20 points from median triggers reconciliation, not automatic deletion. Tie-break: story → theme → accessibility → jury chair documented decision.

Audience Choice uses one verified account/person per film, rate limit, server-side ledger, anomaly flags and delayed totals during final 24 hours. IP is risk signal, not identity: shared school/dorm networks cannot be hard-blocked solely by IP. No paid votes.

## 7.4 Feedback policy

All compliant submissions receive: criterion scores, two strengths, one priority improvement and next learning recommendation within 14 days after gala. Judges can reuse calibrated comment blocks but must add work-specific evidence. Appeals cover process/error/conflict, not taste; window 7 days; independent reviewer responds in 14 days.

## 7.5 Public gallery and rights

Creators choose public license/display period. YNDA receives limited, non-exclusive, revocable display/promotion rights defined in terms; creator retains copyright. Credits are mandatory. Takedown SLA 72 hours normal, immediate for safety/legal claim pending review.

---

# 8. Gamification System

## 8.1 Design rules

- XP measures participation/progression, not artistic worth.
- Rank is seasonal; level is lifetime; leaderboard is opt-in and cohorted.
- No XP for payment, invite spam, raw likes or self-reported actions without evidence.
- Daily cap 150 XP; peer-feedback cap 60 XP/week; repeated low-quality actions earn zero and enter review.
- Points ledger is append-only with source, reason, rule version, approver and reversal.

## 8.2 XP earning table

| Action | XP | Verification | Cap/anti-abuse |
|---|---:|---|---|
| Complete onboarding + code of conduct | 50 | System | Once |
| Submit workshop artifact | 40 | Artifact | Once/workshop |
| Pass learning checkpoint | 20 | System | Once/checkpoint |
| Complete mini-challenge | 60 | Approved artifact | Once/challenge |
| Useful peer review | 15 | Recipient + quality rule | 4/week |
| Close feedback loop with revision | 30 | Before/after evidence | 2/challenge |
| Production milestone | 50 | Team evidence | Once/milestone |
| Final compliant submission | 150 | Compliance pass | Once/season |
| Volunteer shift completed | 40 | Lead check-in | Scheduled only |
| Curated resource accepted | 20 | Moderator | 2/week |
| Mentor/host contribution | 60 | Event completed | Role-limited |

## 8.3 Levels and ranks

Lifetime levels: **Observer 0**, **Explorer 200**, **Maker 600**, **Storyteller 1,500**, **Collaborator 3,000**, **Guide 6,000**, **Luminary 12,000**. Thresholds are reviewed after two cohorts; no benefit affecting judging.

Season rank uses percentile and minimum evidence: Bronze (complete onboarding), Silver (top 60% + one artifact), Gold (top 30% + two contribution types), Platinum (top 10% + quality threshold). Rank resets each season; lifetime record remains.

## 8.4 Multi-dimensional scores

Each score 0–100, rolling 180 days, evidence-weighted—not cộng trực tiếp thành XP:

- **Creator Score:** completed artifacts 35%, revision/growth 30%, peer quality 20%, consistency 15%.
- **Photographer Score:** visual assignments 35%, craft rubric 30%, credited production work 20%, critique 15%.
- **Filmmaker Score:** production milestones 25%, final works 30%, team reliability 20%, craft improvement 15%, rights/accessibility 10%.
- **Reviewer Score:** specificity 30%, actionability 30%, recipient rating 20%, calibration 10%, timeliness 10%.
- **Community Score:** helpful actions 35%, reliability 25%, inclusion/safety 20%, event contribution 20%.
- **Contribution Score:** verified volunteer output 40%, reliability 30%, impact 20%, handover 10%.

Scores display confidence (“emerging/established”) based on sample size; do not show false precision with one activity.

## 8.5 Badges and achievements

Badge fields: name, purpose, criteria, evidence, issuer, season, rarity, expiry if skill currency matters. Initial badges: First Frame, Feedback Giver I–III, Revision Mindset, Reliable Teammate, Caption Champion, Rights Ready, Workshop Finisher, Regional Storyteller, Community Steward, Season Finalist, Audience Choice, Jury Award, Mentor, Alumni Guide. Artistic award badges and behavior badges visually distinct.

## 8.6 Psychology and retention

- Competence: visible progress and rubric delta.
- Autonomy: choose role track and privacy.
- Relatedness: team/circle rituals.
- Endowed progress: onboarding begins at 10%, but clearly labeled.
- Variable recognition is limited; no loot boxes, loss aversion countdowns or punitive streaks.
- Portfolio Progress measures profile, role evidence, two artifacts, one reflection, one recommendation.
- Season Progress measures required milestones only; optional activity never blocks completion.

## 8.7 Hall of Fame

Annual, not raw all-time leaderboard. Lanes: Jury Awards, Audience Choice, Most Improved, Community Contributor, Mentor Impact, Accessibility Craft, Regional Voice, Alumni Spotlight. Each entry contains story, artifact, evidence and consent; no permanent ranking of minors.

---

# 9. Sponsor System

## 9.1 Sponsor value proposition

Companies invest for: early creative talent, education/ESG impact, product trial in authentic production, regional youth reach, employer branding, content co-creation and measurable brand lift. YNDA must sell an activation and impact report, not logo inventory.

## 9.2 Packages (planning ranges, exclusive of tax/legal obligations)

| Package | Indicative/season | Suitable for | Core rights | Measurement |
|---|---:|---|---|---|
| Supporter | 15–25M VND | Local/education brands | Website logo, thank-you, 2 social mentions, report | reach, clicks, attendance |
| Workshop Partner | 30–50M | Tools/training | One co-designed educational activation, mentor slot subject to standards, trial codes | registration, completion, opt-in leads |
| Challenge Partner | 50–80M | Camera/software/creative | Named mini-challenge, product lab, prize, showcase booth | qualified participants, artifacts, survey lift |
| Season Partner | 100–180M | Strategic brand | Season visibility, multi-touch activation, gala, impact story | full funnel + brand study |
| In-kind Partner | Valued transparently | Venue/equipment/software | Rights proportional to verified fair value | usage and beneficiary count |

No package grants access to private member data, judging influence, forced product use, rights to contestant works, or private messaging to minors. Category exclusivity is priced separately and narrowly defined.

## 9.3 Activation ideas

- Mobile filmmaking lab with loan kits and equal-access booking.
- Color/sound/edit clinic using anonymized sample footage with consent.
- “One tool, one constraint” mini-challenge judged independently.
- Portfolio review day and opt-in talent opportunity board.
- Regional screening powered by venue partner.
- Equipment accessibility fund; transparent beneficiary criteria.
- Sponsor employee volunteers as operational coaches only after safeguarding/mentor training.

## 9.4 Sponsor reporting

Pre-campaign baseline, UTM/QR, consented registration source, attendance, completion, artifact count, brand recall survey, sentiment, content delivery proof, beneficiary story and financial utilization. Report within 21 days; distinguish reach from unique people and registered from attended.

---

# 10. Financial Model

## 10.1 Recommended model

Core community, learning path, digital certificate and competition submission should be free during product validation. Sustainable revenue mix: sponsor cash 55–65%; grants/donations 10–15%; optional premium clinic/ticket 10–15%; school/partner program 10–15%; merch/print certificate at cost-plus small margin <5%. No paid vote, paid XP or fee-linked judging advantage.

## 10.2 Unit economics assumptions

Planning scenario per 6-month season, 500 registered / 250 activated / 100 final completers:

- Platform/domain/email/security: 12M.
- Workshop/mentor/facilitator: 30M.
- Content/design/media: 20M.
- Community/moderation/support: 18M.
- Awards/showcase: 30M.
- Legal/accounting/insurance/safeguarding: 15M.
- Contingency 10%: 12.5M.
- **Total target:** ~137.5M VND.

Funding target: sponsor 90M; grants/donations 20M; partner programs 15M; tickets/clinics 12.5M. Founder cash advances require written cap and repayment rule; never silently treated as community donation.

## 10.3 Fund policy

Use four ledgers: restricted prize fund; restricted sponsor activation; operating fund; reserve. Every transaction has source, restriction, approver, evidence, beneficiary and season. Publish season summary, not personal/bank details. Digital certificates free; print/shipping opt-in at actual disclosed cost. Prize terms state tax, disbursement date and substitute policy.

## 10.4 Reserve and controls

- Reserve target: 3 months fixed operating cost by end of year 2, 6 months by end of year 3.
- Two-person approval above 5M; founder approval above budget or 15M; conflict recusal.
- Monthly reconciliation; season close within 30 days; sponsor receivable aging.
- Stop/go gate: do not announce cash prizes until ≥80% prize funding is contracted/cash received.

## 10.5 Three-year plan

| Year | Seasons | Revenue target | Cost ceiling | Reserve target | Strategic goal |
|---|---:|---:|---:|---:|---|
| Y1 | 1–2 | 250–350M | ≤90% revenue | 30M | Prove repeatable season and trust |
| Y2 | 2 | 550–750M | ≤85% revenue | 100M | Regional activations, partner renewals ≥50% |
| Y3 | 2 + showcase | 1.0–1.4B | ≤82% revenue | 250M | Annual festival, paid ops core, diversified funding |

No forecast should be presented as commitment before sponsor pipeline and legal structure validation.

---

# 11. User Journey

## 11.1 First-time creator

| Stage | User question | Screen/action | Success signal | Recovery |
|---|---|---|---|---|
| Discover | “Đây có dành cho mình?” | Landing + work examples + eligibility | Click journey | FAQ and 2-minute explainer |
| Evaluate | “Có công bằng/an toàn không?” | Rules, jury, cost, rights | View rules/mentor | Plain-language summary |
| Join | “Đăng ký mất bao lâu?” | Intent-first signup, progressive profile | Verified account | Save/resume, email fallback |
| Orient | “Làm gì đầu tiên?” | 5-step onboarding | First Frame | Guided checklist |
| Learn | “Mình thiếu kỹ năng nào?” | Diagnostic → track | Workshop artifact | Recording/transcript |
| Practice | “Feedback ở đâu?” | Mini-challenge + review pair | Revision submitted | Re-match after SLA |
| Team | “Tìm ai phù hợp?” | Role match + team room | Team completeness | Solo track / crew board |
| Produce | “Có kịp không?” | Milestones + risk help | Weekly progress | Extension policy/support |
| Submit | “Bài hợp lệ chưa?” | Preflight + receipt | Compliance pass | Actionable correction list |
| Showcase | “Ai xem và đánh giá?” | Gallery + jury policy | Feedback received | Appeal/takedown |
| Continue | “Sau gala thì sao?” | Portfolio + alumni path | Next-season intent | Monthly alumni digest |

## 11.2 Other journeys

- **Mentor:** apply/invite → verify expertise/safeguarding → capacity selection → assigned cohort → office hours → feedback QA → impact report → renewal.
- **Judge:** conflict disclosure → calibration sample → blind queue → save draft → variance review → sign-off → feedback release.
- **Sponsor:** inquiry → fit screening → proposal → agreement/data terms → activation workspace → approvals → delivery proof → report → renewal.
- **Volunteer:** role card → application → onboarding → scheduled tasks → check-in/out → review/handover → contribution certificate.
- **Founder/President:** season template → budget/resources gate → publish rules freeze → monitor risk/SLA → close season → board report → clone improved season.

---

# 12. Information Architecture

## 12.1 Public IA

- Home
- Hành trình
  - Cách hoạt động
  - Season hiện tại
  - Timeline & thể lệ
- Học & thực hành
  - Workshops
  - Mini-challenges
  - Learning library
- Tác phẩm
  - Public gallery
  - Hall of Fame
  - Season archive
- Cộng đồng
  - Stories
  - Mentors
  - Code of conduct
- Về YNDA
  - Mission/team/governance
  - Partners/sponsors
  - Impact & financial reports
  - Contact/press
- Legal & accessibility

## 12.2 Member IA

- Hôm nay
- Hành trình của tôi
- Học
- Thử thách
- Đội & sản xuất
- Feedback
- Cộng đồng
- Portfolio
- Lịch/Thông báo
- Profile/Privacy/Support

## 12.3 Organizer IA

- Command Center
- Season & Program
- People & Safeguarding
- Content & Community
- Submission & Judging
- Events & Workshops
- Finance & Sponsor
- Communications
- Reports & Audit
- Configuration & Access

## 12.4 Page inventory and routes

Mỗi public entity cần URL thật và metadata riêng: `/seasons/{slug}`, `/workshops/{slug}`, `/challenges/{slug}`, `/works/{slug}`, `/people/{handle}` (opt-in), `/hall-of-fame/{year}`, `/reports/{year}`. Dashboard state không phụ thuộc fragment/ẩn hiện nhiều page trong một DOM. Legacy `/community`, `/dashboard`, `/register` có redirect/map migration và analytics để không gãy link.

---

# 13. Implementation Roadmap

## Phase 0 — Trust freeze (2 tuần)

- Chốt legal wording, finance allocation, no-paid-vote, judging independence, minor/data policy.
- Tắt/khóa đường đi giao dịch vote và chuẩn bị migration/audit.
- Threat model payment, vote, submission, storage; define incident owner.
- Outcome gate: Founder signs product policy; no contradictory public copy.

## Phase 1 — Foundation (4–6 tuần)

- Design tokens/components/content model; modular app shell; role/permission matrix.
- Canonical data dictionary, season state machine, audit ledger, analytics event plan.
- Public IA, new landing, SEO routes, accessibility baseline.
- Gate: Lighthouse performance ≥80 mobile staging, accessibility automated ≥95 plus manual keyboard pass; no P0 security finding.

## Phase 2 — Activation loop (6–8 tuần)

- Intent onboarding, member “Hôm nay”, journey progress, workshop/challenge, feedback inbox, XP ledger v1.
- Community circles and moderation/reporting.
- Gate: 20-person pilot, onboarding completion ≥70%, first-value median <15 phút.

## Phase 3 — Competition integrity (6–8 tuần)

- Team/production milestones, submission preflight/versioning, compliance queue, blind judging, Audience Choice ledger, feedback release/appeal.
- Gate: dry-run 30 dummy submissions, reconciliation and disaster recovery rehearsed.

## Phase 4 — Showcase and sustainability (4–6 tuần)

- Gallery, Hall of Fame, portfolio, certificate evidence, sponsor CRM/activation, finance reports.
- Gate: sponsor report generated from source data; certificate verification works after revocation; season close report complete.

## Phase 5 — Scale only after evidence

- Regional cohorts, alumni mentorship, partner schools, offline gala. Do not start until moderation SLA ≥90%, platform uptime ≥99.5%, season completion ≥30%, and budget runway ≥6 months to next close.

---

# 14. Priority Matrix

| Priority | Now | Next | Later | Do not build now |
|---|---|---|---|---|
| Trust | No-paid-vote, legal/finance truth, security | Judge audit, reports | External review | Token/crypto rewards |
| Conversion | Landing journey, CTA, onboarding | Personalization | Referral program | Growth hacks before activation |
| Retention | Next step, feedback SLA, mini-challenge | Multi-score, alumni | Regional chapters | Punitive streaks |
| Platform | Modular architecture, role permissions | Search/notifications | Advanced recommendation | General-purpose social network |
| Revenue | Sponsor packages, budget controls | Clinics/partner programs | Festival ticketing | Paid judging advantage |

RICE-like ordering: R10/R13/R17/R18 (trust/security) → R01/R02/R07 (conversion) → R09/R11/R12 (core loop) → R14/R15 (scale/performance) → R16 (sponsor growth).

---

# 15. Acceptance Criteria

## 15.1 Cross-product

- No user-facing page contains conflicting fee, prize, judging or nonprofit claims.
- Every role sees only authorized navigation and server-authorized data/action.
- Every primary flow works at 360×800, keyboard-only and 200% zoom.
- Every async mutation has pending, success, failure, retry and idempotency behavior.
- Every score/award/certificate links to an immutable evidence/audit record.
- Every public media item has rights status, credits and accessibility status.

## 15.2 Landing and onboarding

- Visitor can state what YNDA is, for whom and next action after a 5-second test.
- One primary CTA above fold; no more than seven top-level public nav items.
- Signup requests only email/auth + age band + intent initially; optional profile later.
- User reaches first recommended action within 15 minutes median.

## 15.3 Workshop/feedback

- Workshop cannot publish without outcome, level, capacity, pre-work, artifact, feedback mode and accessibility fields.
- Completion is computed from published rules; organizer cannot silently change after start.
- Feedback assignment expires/re-matches; quality can be rated and audited.

## 15.4 Competition

- Rules version is frozen and visible; amendments create a version and notify affected users.
- Submission receipt persists even if upload/transcode later fails.
- Judge cannot access conflicted entry or public popularity totals before sign-off.
- Audience votes are server-created, unique under policy, anomaly-scored and cannot be purchased.
- Final results reproduce from stored rubric weights and signed scores.

## 15.5 Finance/sponsor

- Payment creation derives amount/product server-side; client cannot select arbitrary payable entitlement.
- Webhook/status processing is idempotent and verifies amount, order ownership and expected item.
- Restricted funds cannot be posted to another ledger without approval and audit.
- Sponsor export includes only consented aggregated data; no minor contact list.

---

# 16. Testing Checklist

## Functional

- Anonymous/member/mentor/judge/volunteer/organizer/admin route matrix.
- Signup verification, forgot password, consent version, account deletion/export.
- Workshop capacity, waitlist, no-show, recording alternative, completion.
- Challenge draft, submit, late/extension, revision and feedback re-match.
- Team invite/leave/lead transfer/underage handling.
- Submission duplicate, broken link, large file, deadline race, correction version.
- Judge conflict, autosave, rubric validation, variance, tie, recusal.
- Vote duplicate, shared network, bot burst, clock boundary, account lock.
- Payment create/cancel/paid/refund/webhook replay/wrong amount/orphan order.
- Certificate issue/verify/revoke/reissue; Hall of Fame takedown.

## Accessibility

- Keyboard through nav, forms, tabs, dialog, data table and player.
- Screen reader labels/status/errors; heading/landmark audit.
- Contrast in all states; color blindness; reduced motion; captions/transcript.
- Touch target and orientation; 200/400% reflow for content where applicable.

## Performance/resilience

- Slow 3G, low-end Android, offline/reconnect during draft.
- Route JS/CSS budgets, image responsive/lazy loading, third-party timeout.
- Firestore quota/load, 500 concurrent gallery views, vote spike, email queue.
- Backup restore drill; RPO 24h non-transactional/near-zero financial ledger; RTO targets documented.

## Security/privacy

- Server authorization, IDOR, privilege escalation, mass assignment, stored XSS, malicious URL/embed.
- Storage file type/size/path/ownership; malware workflow; signed/private access.
- Rate limit distributed environment, CSRF/CORS, secret logging, error leakage.
- PII retention/deletion, minor defaults, consent withdrawal, audit access.

## Content/SEO/analytics

- Unique title/description/canonical/OG, structured data validity, sitemap.
- Vietnamese diacritics/encoding throughout repository and generated email/PDF.
- Analytics taxonomy, UTM, duplicate event prevention, consent mode.
- Empty/error/maintenance/archived season copy reviewed.

---

# 17. Success Metrics

## North Star

**Weekly Meaningful Creative Progress (WMCP):** số member unique hoàn thành ít nhất một hành vi có bằng chứng trong tuần: learning artifact, revision after feedback, production milestone, useful review hoặc compliant submission. Không tính login, page view, like.

## Funnel

| Area | Metric | 12-month target | Guardrail |
|---|---|---:|---|
| Acquisition | Landing → journey start | 8–12% | Bounce by device/source |
| Activation | Signup → first value in 7d | ≥60% | Median time <15m |
| Learning | Workshop artifact completion | ≥55% | Satisfaction ≥4.2/5 |
| Feedback | Eligible artifact receives feedback | ≥90% | Median <7d; quality ≥4/5 |
| Production | Activated → final submission | ≥35% | Extension <15% |
| Community | Meaningful contributors/MAU | ≥25% | Reports/1k posts stable |
| Retention | Next-season return/intention | ≥45% | No reward coercion |
| Sponsor | Renewal | ≥50% Y2 | 100% deliverables logged |
| Finance | Revenue concentration | Largest sponsor <35% Y3 | Reserve target met |
| Safety | SLA met | ≥90% | 0 unresolved critical |
| Platform | Uptime/core error-free sessions | 99.5% / ≥99% | p75 LCP <2.5s |

Segment all metrics by role, age band, device, region and acquisition source only when sample/privacy permits. Never optimize ranking engagement at the expense of learning completion or safety.

---

# 18. Risk Analysis, Trade-offs and Assumptions

| Risk | Likelihood/Impact | Mitigation | Trigger/Owner |
|---|---|---|---|
| Paid-vote legacy damages trust | High/Critical | Remove entitlement; publish policy; audit old transactions | Any surfaced vote sale / Founder |
| Client-controlled vote/payment fields | High/Critical | Server authoritative order/vote ledger; idempotency | Amount mismatch/replay / Engineering |
| Broad Storage write rule | High/High | Path/type/size/owner rules, private buckets | Unauthorized upload / Security owner |
| Minor privacy/safeguarding | Medium/Critical | Defaults, consent, logged mentor channels, escalation | PII/report/offline event / Safeguarding lead |
| “Nonprofit” legal ambiguity | High/High | Legal review and accurate wording | Sponsor contract/public claim / Founder |
| Scope explosion | High/High | Product boundaries and phase gates | >20% unplanned sprint / PM |
| Founder/bus factor | High/High | RACI, credential vault, runbooks, deputies | Owner unavailable 7d / President |
| Mentor/feedback shortage | High/High | Cohort caps, peer calibration, SLA/re-match | Queue >7d / Community lead |
| Jury conflict/bias | Medium/High | Disclosure, blind review, recusal, audit | Conflict/variance / Jury chair |
| Sponsor influence | Medium/High | Contract exclusions and firewall | Scoring/data request / Partnership lead |
| Copyright/takedown | Medium/High | Rights checklist, disclosure, response SLA | Claim received / Content lead |
| Finance shortfall | High/High | Funding gate, variable prize, reserve | <80% contracted / Finance |
| Monolith regression/performance | High/High | Modular migration, tests, budgets | Bundle/LCP regression / Engineering |
| Gamification abuse/anxiety | Medium/Medium | Caps, quality, opt-out, no streak loss | Spam/report survey / Product |
| Encoding inconsistency | High/Medium | UTF-8 audit and CI check | Mojibake in output / Engineering |

### Explicit trade-offs

- Separate Audience Choice from jury awards reduces viral vote campaigning but greatly improves integrity.
- Free core access raises funding pressure but removes a conversion/trust barrier for students.
- Public URLs improve SEO but require stronger consent/takedown controls.
- Modular rebuild costs more upfront than patching three monolith files but lowers recurring defects and makes accessibility/testability achievable.
- Rich scoring motivates some members but can intimidate beginners; default UI therefore emphasizes next step and progress, not leaderboard.

### Assumptions requiring validation

- Season cadence is six months (handbook) rather than four 3-month seasons (older proposal).
- Primary age band includes minors 15–17; legal/safeguarding review is required.
- YNDA does not yet have a formal nonprofit legal entity.
- 500 registrations/season is planning, not proven demand.
- Mentors/judges can support required SLA; pilot must test capacity.
- Visual QA remains pending because browser runtime was unavailable in this review.

---

# 19. Improvement Suggestions — Implementation Register

## R01 — Unify brand narrative and terminology

- **Problem:** slogan/theme/value proposition and core nouns conflict across site and plans.
- **Reason:** multiple sources of truth and copy editable in several monolith files.
- **Impact:** confusion, weaker recall, lower trust and implementation drift.
- **Priority:** P0.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** homepage content model, Home, About, Season, Register, emails, manifest/metadata, footer, handbook references.
- **Expected Result:** one messaging hierarchy: brand promise, season theme, campaign headline, CTA lexicon; centralized content entries.
- **KPI:** 5-second comprehension ≥80%; conflicting-copy audit = 0; branded search/direct return rises.

## R02 — Rebuild public navigation around visitor intent

- **Problem:** public nav mixes discovery, voting, certificate, recruitment and internal scheduling.
- **Reason:** pages were added feature-by-feature without IA governance.
- **Impact:** choice overload and low creator conversion.
- **Priority:** P0.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** Header/mobile nav across public pages; redirects; footer.
- **Expected Result:** ≤7 public top-level items, role-aware account menu, internal tools removed from primary public nav.
- **KPI:** nav task success ≥90%; CTA click-through +25%; mobile menu abandonment -30%.

## R03 — Turn landing into a journey story

- **Problem:** current Home focuses hero, prize pool, events, rules and recruitment; core ecosystem is invisible.
- **Reason:** landing predates later community/workshop/gamification modules.
- **Impact:** visitors perceive a small contest, not a long-term ecosystem.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Home, CMS/content model, analytics.
- **Expected Result:** structured 15-block landing defined in 3.2 with state-aware CTA and social proof.
- **KPI:** scroll to journey ≥55%; landing→start 8–12%; qualified signup +30%.

## R04 — Add trust and proof architecture

- **Problem:** claims lack visible evidence, dates, governance, reports, people and work examples.
- **Reason:** trust content is scattered or internal.
- **Impact:** first-time visitors, parents, mentors and sponsors hesitate.
- **Priority:** P0.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** Home, About, Impact Reports, Team, Mentor, Works, Rules.
- **Expected Result:** verified stats, real works, jury/mentor bios, governance, finance/impact reports and corrections timestamp.
- **KPI:** rules/report views; trust survey ≥4/5; sponsor inquiry conversion ≥10%.

## R05 — Upgrade footer and lifecycle capture

- **Problem:** footer has social/legal links but lacks contact, reports, sponsor, accessibility, archive and newsletter.
- **Reason:** footer treated as decorative close.
- **Impact:** lost secondary conversion and reduced institutional credibility.
- **Priority:** P1.
- **Implementation Difficulty:** Low.
- **Files/Pages affected:** global footer, newsletter consent, contact.
- **Expected Result:** complete sitemap/contact/trust/lifecycle footer.
- **KPI:** footer CTR ≥3%; newsletter verified opt-in ≥30% of submitters.

## R06 — Replace 50+ flat dashboard tabs with role/job IA

- **Problem:** dashboard exposes too many peer-level modules and mixes creator with operations.
- **Reason:** feature accumulation in a single tab registry.
- **Impact:** high cognitive load, mobile failure and permission confusion.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Member app shell, Organizer console, navigation, permission matrix.
- **Expected Result:** three shells and grouped IA from section 12; progressive disclosure and command palette/search for power users.
- **KPI:** top-task success ≥85%; median clicks -30%; support questions about finding features -40%.

## R07 — Build a state-aware “Next Best Action” home

- **Problem:** members see features, not a guided next step.
- **Reason:** no journey state machine or recommendation rules.
- **Impact:** low activation and return behavior.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Member Home, season progress, notification rules, analytics.
- **Expected Result:** one primary action based on eligibility, progress, deadlines, feedback and team state.
- **KPI:** activation ≥60%; WMCP +25%; first-value median <15m.

## R08 — Accessibility and interaction remediation

- **Problem:** non-semantic click targets, modal-heavy flows, incomplete focus/error behavior and animated decoration.
- **Reason:** inline imperative UI without reusable accessible primitives.
- **Impact:** exclusion, errors, mobile friction and legal/reputation risk.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** all pages/components/forms/media.
- **Expected Result:** WCAG 2.2 AA target and requirements in 4.3.
- **KPI:** automated a11y ≥95; manual keyboard critical issues = 0; completion parity by assistive needs.

## R09 — Productize workshops around artifacts and feedback

- **Problem:** workshop can become content equivalent to free video.
- **Reason:** event data does not enforce pre-work/outcome/artifact/feedback.
- **Impact:** low attendance, weak willingness to pay and no measurable learning.
- **Priority:** P1.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** Workshop detail, registration, live ops, artifact/feedback, certificate.
- **Expected Result:** standard blueprint in section 6 and cohort capacity controls.
- **KPI:** attendance ≥65%; artifact completion ≥55%; rubric delta positive; satisfaction ≥4.2/5.

## R10 — Establish competition integrity and remove paid-vote legacy

- **Problem:** public copy says 100% vote; paid-vote transaction logic exists; judge system also exists.
- **Reason:** legacy monetization and judging concepts coexist.
- **Impact:** critical fairness, sponsor and brand risk.
- **Priority:** P0/blocker.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Voting, payment APIs/webhook/status, transactions, rules/terms, judging, gallery, finance migration.
- **Expected Result:** jury-only official awards; separate verified Audience Choice; no purchasable vote; historical records labeled/migrated.
- **KPI:** paid-vote paths = 0; result reproducibility 100%; fairness survey ≥4/5; anomaly resolution logged.

## R11 — Implement evidence-based gamification

- **Problem:** current features mention points/leaderboard but lack unified purpose, caps, ledger and anti-abuse.
- **Reason:** gamification was added per module.
- **Impact:** spam, unfairness and meaningless ranks.
- **Priority:** P1.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Profile, journey, workshop, challenge, feedback, volunteer, leaderboard, audit.
- **Expected Result:** XP/level/rank/scores/badges defined in section 8 with explainable ledger and reversal.
- **KPI:** WMCP +20%; spam <1%; “understand why points” ≥90%; opt-out available.

## R12 — Make feedback a managed service

- **Problem:** presence of peer review/mentor Q&A does not guarantee response quality or time.
- **Reason:** no assignment queue, SLA, quality score or escalation.
- **Impact:** core differentiation fails and creators churn.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** Peer Review, Mentor, inbox, organizer queue, notifications.
- **Expected Result:** structured request, matching, expiry/re-match, feedback rubric, quality rating and audit.
- **KPI:** ≥90% eligible artifacts receive feedback; median <7d; actionable rating ≥4/5.

## R13 — Create one transparent financial policy

- **Problem:** fee allocation conflicts: 100% prize vs 70/30 vs separate operating fund.
- **Reason:** outdated documents and UI are simultaneously active.
- **Impact:** legal/trust risk and unreliable sponsor reporting.
- **Priority:** P0/blocker.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** Prize widget, registration/payment, Terms, reports, budget, sponsor deck, handbook.
- **Expected Result:** four-ledger policy, public season summary, free core recommendation and funding gates.
- **KPI:** conflicting claims = 0; reconciliation variance = 0; close report ≤30 days.

## R14 — Migrate duplicated HTML monoliths to modular architecture

- **Problem:** three ~700 KB/11k-line pages duplicate UI, data and business logic; hundreds of inline handlers/styles.
- **Reason:** copy-based growth without component/service boundaries.
- **Impact:** slow load, security drift, inaccessible UI and regression cost.
- **Priority:** P0 technical foundation.
- **Implementation Difficulty:** Very High.
- **Files/Pages affected:** index/community/dashboard, shared services, CSS/design system, routing, build/test pipeline.
- **Expected Result:** route-level modules; reusable accessible components; server-authoritative domain services; strangler migration preserving URLs.
- **KPI:** duplicate domain logic -80%; initial route transfer budget met; regression coverage ≥80% critical flows; p75 LCP <2.5s.

## R15 — Build SEO/performance/content architecture

- **Problem:** sitemap has only Home; metadata duplicated; entity content lives behind client rendering.
- **Reason:** SPA-like single documents and no route content model.
- **Impact:** poor discovery/share previews and oversized payload.
- **Priority:** P1.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** routes, sitemap, robots, metadata, structured data, media pipeline.
- **Expected Result:** indexable season/workshop/work/gallery/Hall of Fame pages; unique metadata; responsive media and route budgets.
- **KPI:** indexed valid pages, non-brand organic sessions, share CTR, Core Web Vitals pass ≥75% URLs.

## R16 — Operationalize sponsor ROI without compromising members

- **Problem:** sponsor module stores partners but public value, packages, activation controls and reporting are weak.
- **Reason:** partnership system is admin-list oriented.
- **Impact:** logo-only deals, low renewal and data/influence risk.
- **Priority:** P1.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** Sponsor public page, CRM/workspace, contracts/checklists, analytics/report.
- **Expected Result:** packages, activation ideas, exclusions and measurement in section 9.
- **KPI:** qualified inquiries, ≥50% Y2 renewal, 100% deliverables logged, 0 prohibited data/judging request fulfilled.

## R17 — Make payments and financial entitlements server-authoritative

- **Problem:** payment creation accepts amount/description/order code from client; transaction record is client-created before server reconciliation.
- **Reason:** server acts as PayOS proxy rather than order authority.
- **Impact:** amount/product mismatch, orphan orders, spoofed metadata and audit complexity.
- **Priority:** P0 security.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** create-payment, webhook, status, transactions, registration, sponsor, Firestore rules.
- **Expected Result:** server creates order from approved product/price and authenticated owner; verifies webhook amount/item; idempotent ledger and refund state.
- **KPI:** mismatched confirmation = 0; webhook replay safe 100%; reconciliation variance = 0; orphan rate <0.5%.

## R18 — Harden authorization, storage, voting and privacy

- **Problem:** broad authenticated Storage write rule, vote uniqueness client/IP based, permissive creates and sensitive flows spread across client/server.
- **Reason:** Firebase rules grew collection-by-collection without domain threat model.
- **Impact:** unauthorized upload, spam, PII exposure, privilege abuse and unreliable vote.
- **Priority:** P0 security/privacy.
- **Implementation Difficulty:** Very High.
- **Files/Pages affected:** Firestore/Storage rules, upload service, vote service, moderation, auth/roles, audit/log retention.
- **Expected Result:** deny-by-default paths; type/size/owner constraints; server vote/order ledger; custom claims or authoritative role lookup; privacy retention map.
- **KPI:** P0/P1 penetration findings = 0 before launch; unauthorized rule tests pass 100%; critical audit coverage 100%.

## R19 — Establish analytics, experiments and season review

- **Problem:** feature count and raw reach can mask weak activation/learning.
- **Reason:** no shared North Star or event taxonomy.
- **Impact:** roadmap follows opinions and vanity metrics.
- **Priority:** P1.
- **Implementation Difficulty:** Medium.
- **Files/Pages affected:** all key flows, reporting, consent, organizer command center.
- **Expected Result:** WMCP, funnel, cohort dashboards, experiment guardrails and season retrospective template.
- **KPI:** ≥95% critical event validity; decision docs cite data; season review completed ≤30 days.

## R20 — Formalize governance, safeguarding and operational continuity

- **Problem:** broad founder dependency, minors, mentor interactions and many internal roles create governance risk.
- **Reason:** tooling expanded faster than policies/owners.
- **Impact:** burnout, unsafe incidents, inconsistent decisions and sponsor hesitation.
- **Priority:** P0.
- **Implementation Difficulty:** High.
- **Files/Pages affected:** About/Governance, organizer roles, policies, incident console, handbook, credential/access process.
- **Expected Result:** RACI, safeguarding lead, incident severity/SLA, conflict disclosure, access review, handover and succession.
- **KPI:** access review quarterly 100%; critical incident drill twice/year; owner coverage ≥2 for every critical process.

---

# 20. Final Verdict

YNDA không nên xây thêm nhiều feature trước khi sửa kiến trúc niềm tin và hành trình. Repository hiện tại chứng minh đội ngũ có khả năng tạo nhanh và hiểu nhiều nhu cầu vận hành; đồng thời chính độ rộng đó đang che khuất sản phẩm cốt lõi. Lợi thế cạnh tranh không nằm ở một dashboard có nhiều mục hơn mà ở một vòng lặp được vận hành tốt: **bước tiếp theo rõ → thực hành thật → feedback đúng hạn → tiến bộ được ghi nhận → tác phẩm được nhìn thấy → vai trò mùa sau được mở ra**.

Khuyến nghị go/no-go:

- **Go** với Phase 0–2 ngay sau khi Founder chốt policy.
- **No-go** cho campaign cạnh tranh quy mô lớn, thu phí bắt buộc, paid voting hoặc sponsor quyền lực sâu cho đến khi R10, R13, R17, R18 và R20 đạt acceptance criteria.
- **No-go** cho việc tiếp tục nhân bản monolith; mọi chức năng mới phải đi vào kiến trúc module hoặc chờ migration.

### Self-review synthesis

- **Principal Product Designer:** tài liệu ưu tiên first value, feedback và belonging; rủi ro còn lại là gamification quá dày, nên UI mặc định chỉ hiện next step/progress.
- **Principal Engineer:** roadmap dùng strangler migration và server authority; rủi ro còn lại là phạm vi rewrite, cần vertical slice và contract tests trước khi thay toàn bộ.
- **Founder of a global creative community:** công bằng, safeguarding, alumni và sponsor firewall là điều kiện thương hiệu; rủi ro còn lại là mentor capacity và funding concentration, phải chứng minh qua pilot.

Tài liệu không tuyên bố hoàn hảo. Những quyết định cần Founder xác nhận trước triển khai là: tư cách pháp lý/cách dùng “phi lợi nhuận”; cadence season; free-core/fee policy; official judging separation; age/guardian policy; public profile defaults; sponsor price range; và nguồn lực mentor/ops thực tế.

---

# Appendix A — Domain Model and State Contracts

Đây là đặc tả logic, không phải schema/code. ID dùng chuỗi không đoán được; mọi entity có `createdAt`, `updatedAt`, `createdBy`, `version`, `status` khi phù hợp. Timestamp lưu UTC và hiển thị timezone người dùng. Các mutation nhạy cảm có audit event và idempotency key.

## A1. Core entities

| Entity | Required domain fields | Key relationships/constraints |
|---|---|---|
| User | auth ID, email state, age band, locale, account state | Một user có một private identity; public profile là opt-in tách biệt |
| Profile | display name, handle, role tracks, skills, privacy map, consent versions | Không mặc định public trường/lớp/tuổi/vị trí; handle unique |
| Season | title, theme, timezone, dates, rules version, capacity, lifecycle state | Chỉ một active flagship season; rule freeze before enrollment close |
| Journey Step | season, order, eligibility rule, required/optional, reward rule | Versioned; changing required status requires notification |
| Enrollment | user, season, intent, track, status, consent snapshot | Unique user–season; withdrawal preserves minimum audit |
| Workshop | season, outcome, level, capacity, accessibility, feedback mode | Cannot publish without artifact/completion rule |
| Workshop Registration | workshop, user, attendance, artifact, completion state | Unique; waitlist has deterministic order and expiry |
| Challenge | season, brief, rubric, dates, visibility, XP rule | Brief version frozen at open |
| Artifact | owner/team, source type, URL/storage ref, rights, visibility, version | Immutable version after relevant deadline; soft takedown state |
| Feedback Request | artifact version, question, reviewer type, due date, state | No self-review; conflict and blocked-user rules |
| Feedback | request, reviewer, structured sections, quality state | Editable until submitted; post-submit amendment logged |
| Team | season, name, leader, capacity, state, visibility | One active competition team/user/season unless rules allow |
| Team Membership | team, user, role, permissions, joined/left dates | Lead transfer required before lead exits |
| Production Milestone | team, type, due date, evidence, completion, risk | Published season template; exception logged |
| Submission | season, team/owner, category, artifact version, receipt, state | One active final/category unless rules allow; checksum/receipt immutable |
| Compliance Review | submission, checklist, reviewer, reasons, state | Separation from creative scoring; correction window explicit |
| Judge Assignment | submission, judge, conflict state, blind code | Minimum 3 valid signed assignments per scored entry |
| Scorecard | assignment, rubric version, criterion scores, comments, signature state | Total derived, never typed independently; locked after sign-off |
| Audience Vote | season, work, voter, risk signals, state | Unique voter–work; server created; no payment relation |
| Result | season, award, work, calculation snapshot, approval | Publish only after reconciliation; amendment creates new version |
| XP Ledger Entry | user, season, rule version, source entity, delta, reason, state | Append-only; reversal is a new entry, never destructive edit |
| Badge Grant | user, badge version, evidence, season, issuer, state | Revocable with reason; award badge separated from behavior badge |
| Certificate | recipient, type, evidence refs, issue/revoke versions, verification code | Verification page shows status and safe fields only |
| Partner | organization, risk check, contact-private, status | Contact details organizer-only |
| Activation | partner, season, deliverables, audience/data terms, owner, status | Cannot request judging control or non-consented member data |
| Financial Order | owner, product catalog item, expected amount, expiry, state | Server created; immutable currency/amount after payment link creation |
| Payment | provider reference, order, paid amount, provider state, timestamps | Idempotent provider event; amount/order must match |
| Ledger Entry | fund, restriction, amount, category, evidence, approvals | Double-entry or equivalent reconciliation; no destructive deletion |
| Moderation Report | reporter-private, target, category, severity, evidence, state | Access restricted; retention and appeal rules |
| Notification | recipient/audience, template, entity, channel, state | Dedupe key; user preference except mandatory service/safety notices |
| Audit Event | actor, action, target, before/after safe diff, reason, request ID | Immutable and access-controlled; sensitive values redacted |

## A2. State machines

### Season

`Draft → Internal Review → Published → Enrollment Open → Learning → Production → Submission Open → Compliance/Judging → Showcase → Finalized → Archived`.

- Backward transitions are prohibited except Published → Draft before any enrollment.
- Cancelled can be entered from pre-Finalized with reason, refund/communication plan.
- Dates do not silently change state; scheduler proposes, authorized owner confirms or an audited automation executes.

### Submission

`Draft → Preflight Failed/Ready → Submitted → Compliance Review → Correction Required/Eligible/Disqualified → Jury Review → Finalized → Published/Private Archive`.

- Deadline accepts server timestamp; upload initiated before deadline is not enough unless rules explicitly grant grace.
- Disqualified requires reason code, evidence, appeal deadline and authorized reviewer.
- Published requires rights/caption checks and creator visibility consent.

### Feedback

`Requested → Matching → Assigned → In Progress → Submitted → Acknowledged → Revision Linked → Closed`.

- Assigned past SLA → Expired → Matching.
- Reporter/reviewer blocking or safety concern pauses assignment without penalizing XP.

### Order/payment

`Order Created → Payment Pending → Paid/Expired/Cancelled → Fulfilled → Refunded/Partially Refunded`.

- Provider webhook and status poll can propose Paid; only verified matching event commits it.
- Fulfillment is idempotent and separate from payment state.

### Moderation

`Reported → Triaged → Investigating → Actioned/No Violation → Notified → Appealed → Upheld/Changed → Closed`.

Critical safety reports can immediately enter Restricted Pending Review, with least-necessary access.

## A3. Data retention defaults

- Account/profile: while active + 30-day deletion workflow; minimum fraud/financial records retained as legally required.
- Payment/accounting: retention per Vietnamese tax/accounting/legal advice; never delete on normal account deletion when retention is mandatory, but detach unnecessary profile data.
- Raw vote risk signals/IP: hash/pseudonymize and retain no longer than one season appeal window + 30 days unless active investigation.
- Workshop recordings: explicit speaker/participant consent; published retention stated per event.
- Minor guardian consent: retain proof only as long as participation/legal defense requires; access restricted.
- Audit/security logs: 12 months default; high-risk financial/admin logs longer per policy.
- Unsubmitted drafts: inactivity reminder at 90 days, deletion at 180 days unless user keeps them.

---

# Appendix B — Roles and Permission Contract

Roles do not inherit by job title alone; server checks authoritative assignment scoped to season/entity. “Organizer” is not one universal super-role.

| Capability | Member | Team Lead | Mentor | Judge | Moderator | Program Ops | Finance | Partner viewer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Edit own profile/privacy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create artifact/team activity | ✓ | ✓ | Optional | – | – | Optional | – | – | ✓ |
| Manage team membership | – | ✓ | – | – | – | Support | – | – | ✓ |
| View private team artifact | Own | Team | Assigned/consented | Assigned blind final only | Report scope | Need-to-know | – | – | Break-glass |
| Submit mentor feedback | – | – | Assigned | – | – | – | – | – | – |
| Score competition | – | – | Only if separately assigned judge | Assigned | – | Calibration admin only | – | – | Emergency reassign, not score |
| View public popularity before sign-off | Public policy | Public policy | Public policy | No | Aggregate risk | Aggregate | – | Aggregate report | Aggregate |
| Resolve moderation report | – | – | – | – | Scope-based | Safety escalation | – | – | Break-glass |
| Change season/rules | – | – | – | – | – | Draft/propose | Budget only | – | Approve with audit |
| Create/refund payment | Own checkout | Own checkout | Own checkout | – | – | Product request | Approve/execute | – | Break-glass |
| View financial PII | Own | Own | Own | – | – | Aggregate | ✓ | Contract aggregate | Break-glass |
| Export user contacts | Own data | Team consented contacts | Assigned channel only | – | Safety-only | Consent-filtered | – | Never | Break-glass logged |

Break-glass access requires reason, limited duration, user notification where safe, and monthly review. Quarterly access review removes stale assignments. Service accounts have distinct least-privilege identities.

---

# Appendix C — Analytics and Notification Contracts

## C1. Analytics event taxonomy

Event names describe completed user intent; page views alone are not product success. Every event includes anonymous/session ID, authenticated user ID when consented, role, season, source route, device class, experiment variant, timestamp and consent state. Never include free-text feedback, email, phone, exact age or film content in analytics properties.

| Event | Fires when | Required properties |
|---|---|---|
| journey_viewed | Journey becomes visible, not on load alone | season, entry source |
| journey_started | User explicitly starts | intent, track |
| onboarding_step_completed | Server confirms step | step, elapsed |
| first_value_reached | First qualifying evidence created | evidence type, elapsed from signup |
| workshop_registered | Registration confirmed | workshop, waitlist state, source |
| workshop_completed | Completion rule evaluates true | attendance mode, artifact state |
| challenge_submitted | Valid version accepted | challenge, track, on-time |
| feedback_requested | Request accepted | reviewer type, artifact type |
| feedback_received | Structured feedback submitted | turnaround hours, not text |
| revision_linked | Before/after linked | feedback request, elapsed |
| team_formed | Minimum viable roles achieved | team size, missing roles |
| milestone_completed | Evidence approved | milestone type, on-time |
| submission_accepted | Receipt generated | category, on-time |
| compliance_resolved | Eligible/disqualified final | state, reason category |
| scorecard_signed | Judge sign-off | rubric version, elapsed, conflict cleared |
| audience_vote_accepted | Server accepts vote | risk band, source campaign |
| certificate_verified | Public verification succeeds/fails | type, state; no recipient PII |
| next_season_intent | User selects intent | role track, previous completion |

Attribution: first-touch and last-non-direct; campaign IDs server-validated where possible. WMCP is computed from domain evidence, not client events.

## C2. Notification priority

- **P0 safety/security:** immediate in-app + email; cannot opt out; no sensitive detail in subject/push.
- **P1 transaction/deadline/assignment:** immediate or batched within 15 minutes.
- **P2 learning/community:** daily digest default.
- **P3 marketing:** explicit opt-in; weekly maximum default.

Every notification has CTA, expiry, dedupe key, preference category and accessible plain-text version. Reminder policy: deadline 7d/48h/6h only if incomplete; stop immediately after completion. Quiet hours default 22:00–07:00 local except P0.

---

# Appendix D — Migration and Release Plan

## D1. Strangler sequence

1. Inventory legacy routes/functions/data collections and freeze new monolith features.
2. Add characterization tests around auth, event registration, payment, submission, vote and certificate.
3. Introduce shared identity/authorization and audit boundaries before visual rebuild.
4. Ship new public routes behind feature flag; preserve legacy links with redirects.
5. Ship Member Home + workshop/challenge vertical slice; read legacy data through adapter.
6. Move writes domain-by-domain to authoritative services; dual-read only temporarily; avoid uncontrolled dual-write.
7. Migrate competition/payment last after dry-run and ledger reconciliation.
8. Archive legacy pages read-only, monitor 30 days, then remove after rollback window.

## D2. Data migration rules

- Never infer consent, rights, age band or award integrity from missing legacy fields; mark `unknown` and request confirmation.
- Preserve original record ID in migration metadata; generate new canonical ID separately.
- Historical paid-vote transactions remain financial records but grant no current vote entitlement and are labeled legacy.
- Recompute leaderboard only from qualifying evidence after rules version start; do not convert arbitrary legacy counts into XP.
- Duplicate users merge only after verified ownership; keep merge audit and reversible mapping.
- Mojibake/encoding repair runs on a copy with sampled human approval; do not overwrite names/titles blindly.

## D3. Release gates and rollback

- Feature flag by cohort/role/season; admin kill switch for payment, vote, public gallery and email separately.
- Database migration has dry run, counts/checksums, backup, forward fix and rollback conditions.
- Canary 5% → 25% → 100%; advance only after error, performance, support and conversion guardrails pass for 48 hours.
- Rollback must not reverse confirmed financial entries or lose submission receipts; UI rollback can continue using canonical services.
- Launch command center names incident commander, engineering, community, finance and communications contacts.

## D4. Definition of Done for every epic

- Product acceptance and abuse cases approved.
- Copy/legal/privacy reviewed where relevant.
- Server authorization and audit specified/tested.
- Empty/loading/error/locked/archived states designed.
- Mobile, keyboard, screen reader and reduced-motion checks pass.
- Analytics/notification events validated without PII leakage.
- Migration/rollback/runbook and owner documented.
- Support FAQ and organizer training updated.
- KPI baseline captured and post-launch review date scheduled.
