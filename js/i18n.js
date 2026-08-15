/**
 * =============================================================================
 * Ý NIỆM ĐIỆN ẢNH (YNDA) — TOÀN BỘ WEBSITE SONG NGỮ (VIỆT - ANH / GLOBAL i18n)
 * =============================================================================
 * Hỗ trợ chuyển đổi ngôn ngữ toàn diện giữa Tiếng Việt (🇻🇳) và English (🇬🇧)
 * trên TOÀN BỘ HỆ SINH THÁI WEBSITE (Trang chủ, Nhiệm vụ, Dashboard, Sơ đồ Gantt,
 * Bảng xếp hạng, Ban tổ chức, Chấm điểm, Vinh danh...).
 */

(function (window, document) {
  'use strict';

  const STORAGE_KEY = 'ynda_site_lang';
  const DEFAULT_LANG = 'vi';

  // ---------------------------------------------------------------------------
  // TỪ ĐIỂN SONG NGỮ TOÀN BỘ WEBSITE (FULL DICTIONARY)
  // ---------------------------------------------------------------------------
  const DICTIONARY = {
    vi: {
      // Navigation & Header chung
      brand_name: 'Ý Niệm Điện Ảnh',
      brand_sub: 'Cộng đồng làm phim học sinh, sinh viên',
      brand_season: 'MÙA 01 · NHIỆM VỤ',
      film_community: 'Cộng đồng điện ảnh',
      nav_home: '🏠 Trang chủ',
      nav_about: '🎬 Về dự án',
      nav_events: '📅 Sự kiện',
      nav_voting: '🗳️ Bình chọn',
      nav_verify: '🎖️ Chứng nhận',
      nav_apply: '✨ Tuyển dụng',
      nav_missions: '⚡ Nhiệm vụ',
      nav_ranking: '🏆 Bảng Xếp Hạng',
      nav_organizers: '💼 Ban Tổ Chức',
      nav_grading: '📝 Chấm Điểm',
      nav_honors: '🎖️ Vinh Danh',
      nav_dashboard: '◈ Tổng quan',
      nav_board: '◉ Bảng nhiệm vụ',
      nav_gantt: '📊 Sơ đồ Gantt (Timeline)',
      nav_mine: '◷ Nhiệm vụ của tôi',
      nav_leaderboard: '♛ Bảng vinh danh',
      nav_review: '✓ Duyệt bằng chứng',
      nav_ledger: '≡ Sổ cái điểm XP',
      nav_team: '◎ Đội sản xuất phim',
      nav_role_review: '⚑ Đánh giá vai trò tuần',
      nav_tools: '⚡ Tương tác & Thưởng',
      nav_workspace_label: 'Không gian làm việc',
      nav_admin_label: 'Quản trị & Điều hành',
      nav_auth_login: 'Đăng nhập Google',
      nav_auth_logout: 'Đăng xuất',
      guest_user: 'Khách ghé thăm',
      role_member: 'THÀNH VIÊN',
      crumb_root: 'Ý NIỆM ĐIỆN ẢNH',
      crumb_sub: 'HỆ THỐNG NHIỆM VỤ',
      btn_create_task: '+ Tạo nhiệm vụ mới',

      // Hero & Trang chủ
      hero_eyebrow: 'DỰ ÁN ĐIỆN ẢNH HỌC ĐƯỜNG MÙA 01',
      hero_title: 'Nơi Ý Tưởng Cất Cánh.',
      hero_slogan: 'Mỗi thước phim là một ý niệm, mỗi đóng góp là một dấu ấn.',
      hero_sublead: 'Ý Niệm Điện Ảnh (YNĐA) là cộng đồng sáng tạo và hệ sinh thái học tập dành cho học sinh, sinh viên yêu thích làm phim, nhiếp ảnh, và phê bình điện ảnh.',
      hero_join_btn: '✨ Đăng ký tham gia',
      hero_explore_btn: '🎬 Tìm hiểu dự án',
      hero_stage_label: 'Giai đoạn',
      hero_stage_val: 'Khởi động & Tuyển BTC',
      hero_opp_label: 'Cơ hội',
      hero_opp_val: 'Đồng kiến tạo cộng đồng điện ảnh',

      // 2 Kênh hoạt động (Channels)
      channel_all: 'Tất cả các kênh',
      channel_all_desc: 'Toàn bộ tiến độ phân bổ trên 2 kênh hoạt động',
      channel_kc: 'KÊNH CHÍNH (Main Channel)',
      channel_kc_badge: '🎬 KÊNH CHÍNH',
      channel_kc_desc: 'Kênh phát sóng chính thức, Video chuyên sâu, Phim ngắn & Talkshow',
      channel_kp: 'KÊNH PHỤ (Secondary Channel)',
      channel_kp_badge: '📱 KÊNH PHỤ',
      channel_kp_desc: 'Kênh vệ tinh, Shorts, Reels, TikTok, Behind The Scenes & Meme',
      channel_select_label: 'Kênh phát sóng & Dự án',

      // Sơ đồ Gantt
      gantt_eyebrow: 'Tiến độ & Phân bổ thời gian · Timeline',
      gantt_headline: 'Sơ đồ Gantt (Gantt Chart)',
      gantt_desc: 'Trực quan hóa tiến độ công việc theo 2 Kênh (Kênh Chính & Kênh Phụ), theo dõi deadline và phân bổ thời gian thực hiện rõ ràng.',
      gantt_create_btn: 'Tạo nhiệm vụ',
      gantt_today_btn: 'Hôm nay',
      gantt_prev_month: 'Tháng trước',
      gantt_next_month: 'Tháng sau',
      gantt_fullwidth_btn: 'Toàn khung',
      gantt_collapse_btn: 'Thu gọn',
      gantt_zoom_label: 'Độ rộng:',
      gantt_zoom_compact: 'Gọn',
      gantt_zoom_standard: 'Chuẩn',
      gantt_zoom_wide: 'Rộng',
      gantt_all_channels: 'Tất cả kênh (All Channels)',
      gantt_all_depts: 'Tất cả các Ban (All Depts)',
      gantt_all_status: 'Tất cả trạng thái (All Status)',
      gantt_search_placeholder: '🔍 Tìm kiếm nhiệm vụ...',
      gantt_task_col_title: 'KÊNH & PHÂN BAN & NHIỆM VỤ',
      gantt_no_tasks: 'Không có nhiệm vụ nào khớp với bộ lọc trong tháng này.',
      gantt_assignee: 'Phụ trách:',
      gantt_unassigned: 'Chưa nhận',
      gantt_deadline_label: 'Hạn chót:',

      // Phân ban (Departments)
      dept_media: 'Ban Media',
      dept_truyen_thong: 'Ban Truyền thông',
      dept_noi_dung: 'Ban Nội dung',
      dept_nhan_su: 'Ban Nhân sự',
      dept_duyet_bai: 'Ban Duyệt bài',
      dept_co_van: 'Ban Cố vấn chuyên môn',
      dept_global: 'Toàn dự án / Kênh',

      // Trạng thái (Statuses)
      status_open: 'Đang mở (Open)',
      status_in_progress: 'Đang làm (In Progress)',
      status_submitted: 'Chờ duyệt (Review)',
      status_completed: 'Hoàn thành (Completed)',
      status_claimed: 'Đã nhận việc',
      status_working: 'Đang thực hiện',
      status_approved: 'Đã phê duyệt',
      status_rejected: 'Từ chối',
      status_needs_revision: 'Cần chỉnh sửa',
      status_overdue: 'Quá hạn',

      // Dashboard
      dash_eyebrow: 'Xin chào thành viên Ý Niệm Điện Ảnh',
      dash_headline: 'Hành trình đóng góp & dấu ấn.',
      dash_desc: 'Mỗi đóng góp đều có bằng chứng rõ ràng, chủ sở hữu và lịch sử ghi nhận minh bạch.',
      dash_season_label: 'MÙA HOẠT ĐỘNG',
      dash_season_title: 'Mùa 01 · Khởi nguyên',
      stat_overall_xp: 'Tổng điểm cống hiến',
      stat_active_tasks: 'Nhiệm vụ đang làm',
      stat_completed_tasks: 'Nhiệm vụ hoàn thành',
      stat_role_points: 'Điểm vai trò (Trách nhiệm)',
      stat_available_tasks: 'Nhiệm vụ đang mở',
      stat_rank_sub: '#1 bảng tổng sắp',
      stat_quality_sub: '95% điểm chất lượng',
      stat_role_sub: '+0.0 tổng sắp (Quy đổi 60%)',
      stat_ending_soon: '0 sắp hết hạn nhận',
      panel_my_tasks: 'NHIỆM VỤ ĐANG PHỤ TRÁCH',
      panel_recent_xp: 'LỊCH SỬ GIAO DỊCH XP GẦN ĐÂY',
      btn_view_all: 'XEM TẤT CẢ →',
      btn_view_ledger: 'XEM SỔ CÁI →',

      // Board & Nhiệm vụ
      board_eyebrow: 'Bảng cơ hội đóng góp',
      board_headline: 'Bảng nhiệm vụ (Quest Board)',
      board_desc: 'Chọn nhiệm vụ phù hợp với chuyên môn. Nhận quyền sở hữu. Đóng góp và tích lũy XP.',
      board_scale_label: 'THANG ĐIỂM CHUẨN',
      board_scale_val: '0.25 → 10+ XP',
      board_filter_all: 'Tất cả nhiệm vụ',
      board_filter_global: 'Mở toàn dự án',
      board_filter_dept: 'Mở theo Ban',
      board_filter_mandatory: 'Nhiệm vụ bắt buộc',
      board_empty: 'Hiện chưa có nhiệm vụ nào đang mở.',
      btn_init_starter: '🚀 Khởi tạo nhiệm vụ chuẩn vào hệ thống',
      card_difficulty: 'Độ khó:',
      card_deadline_title: 'THỜI GIAN CHỦ ĐỘNG CHỐT BÀI',
      card_btn_detail: 'Chi tiết & Nhận việc',

      // Vinh danh & Bảng xếp hạng
      lb_eyebrow: 'Bảng vinh danh thành viên minh bạch',
      lb_headline: 'Bảng xếp hạng cống hiến',
      lb_desc: 'Điểm tổng sắp = Điểm Task + Điểm Thưởng − Điểm Phạt + Điểm Vai trò quy đổi (Role Point × 60%).',
      lb_tab_all: '🏆 Tổng sắp toàn dự án',
      lb_tab_core: '⭐ Ban điều hành & Core',
      lb_tab_advisor: '🎓 Ban Cố vấn',
      lb_tab_members: '👥 Thành viên',
      lb_tab_monthly: '📅 Xếp hạng theo tháng',
      lb_rules_title: 'QUY TẮC TÍNH ĐIỂM',
      lb_ai_verify_tag: 'AI KIỂM TRA + DUYỆT THỦ CÔNG',

      // Footer & Modals
      modal_close: 'Đóng',
      modal_cancel: 'Hủy',
      modal_create_btn: 'Tạo & Phân tích AI',
      modal_claim_btn: 'Nhận nhiệm vụ (100% XP)',
      modal_submit_proof_btn: 'Nộp bằng chứng',
      modal_proof_url: 'Đường dẫn bằng chứng (Google Drive / Ảnh / File / Link)',
      modal_proof_desc: 'Mô tả kết quả & Ghi chú cho Reviewer',
      toast_lang_switched: 'Đã chuyển sang Tiếng Việt 🇻🇳'
    },

    en: {
      // Navigation & Header chung
      brand_name: 'Cinematic Concept (YNDA)',
      brand_sub: 'Student & Youth Film Community',
      brand_season: 'SEASON 01 · MISSIONS',
      film_community: 'Film community',
      nav_home: '🏠 Home',
      nav_about: '🎬 About',
      nav_events: '📅 Events',
      nav_voting: '🗳️ Voting',
      nav_verify: '🎖️ Verification',
      nav_apply: '✨ Recruitment',
      nav_missions: '⚡ Missions',
      nav_ranking: '🏆 Leaderboard',
      nav_organizers: '💼 Organizing Board',
      nav_grading: '📝 Scoring & Rubric',
      nav_honors: '🎖️ Hall of Fame',
      nav_dashboard: '◈ Overview',
      nav_board: '◉ Quest Board',
      nav_gantt: '📊 Gantt Chart (Timeline)',
      nav_mine: '◷ My Missions',
      nav_leaderboard: '♛ Hall of Fame',
      nav_review: '✓ Review Proofs',
      nav_ledger: '≡ XP Ledger',
      nav_team: '◎ Film Production',
      nav_role_review: '⚑ Weekly Role Reviews',
      nav_tools: '⚡ Interaction & Bonuses',
      nav_workspace_label: 'Workspace',
      nav_admin_label: 'Management & Operations',
      nav_auth_login: 'Sign in with Google',
      nav_auth_logout: 'Sign out',
      guest_user: 'Guest Visitor',
      role_member: 'MEMBER',
      crumb_root: 'CINEMATIC CONCEPT',
      crumb_sub: 'MISSION CONTROL',
      btn_create_task: '+ New Mission',

      // Hero & Public Page
      hero_eyebrow: 'STUDENT FILMMAKING PROJECT · SEASON 01',
      hero_title: 'Where Ideas Take Flight.',
      hero_slogan: 'Every frame is a concept, every contribution makes a mark.',
      hero_sublead: 'Cinematic Concept (YNDA) is a creative community and learning ecosystem for students passionate about filmmaking, photography, and film criticism.',
      hero_join_btn: '✨ Apply to Join',
      hero_explore_btn: '🎬 Explore Project',
      hero_stage_label: 'Current Stage',
      hero_stage_val: 'Launch & Team Recruitment',
      hero_opp_label: 'Opportunity',
      hero_opp_val: 'Co-creating film community',

      // 2 Channels
      channel_all: 'All Channels',
      channel_all_desc: 'Complete timeline scheduled across both channels',
      channel_kc: 'MAIN CHANNEL',
      channel_kc_badge: '🎬 MAIN CHANNEL',
      channel_kc_desc: 'Official broadcasting channel, in-depth film analysis, short films & talkshows',
      channel_kp: 'SECONDARY CHANNEL',
      channel_kp_badge: '📱 SUB CHANNEL',
      channel_kp_desc: 'Satellite channel, Shorts, Reels, TikTok, Behind The Scenes & Memes',
      channel_select_label: 'Broadcast Channel & Project',

      // Gantt Chart
      gantt_eyebrow: 'Schedule & Time Allocation · Timeline',
      gantt_headline: 'Gantt Chart (Roadmap Timeline)',
      gantt_desc: 'Visual progress roadmap grouped by 2 Channels (Main & Sub) and departments, tracking deadlines and execution seamlessly.',
      gantt_create_btn: 'New Task',
      gantt_today_btn: 'Today',
      gantt_prev_month: 'Previous Month',
      gantt_next_month: 'Next Month',
      gantt_fullwidth_btn: 'Full Width',
      gantt_collapse_btn: 'Standard View',
      gantt_zoom_label: 'Day Width:',
      gantt_zoom_compact: 'Compact',
      gantt_zoom_standard: 'Standard',
      gantt_zoom_wide: 'Wide',
      gantt_all_channels: 'All Channels',
      gantt_all_depts: 'All Departments',
      gantt_all_status: 'All Status',
      gantt_search_placeholder: '🔍 Search missions...',
      gantt_task_col_title: 'CHANNELS & DEPARTMENTS & TASKS',
      gantt_no_tasks: 'No tasks found matching filter for this month.',
      gantt_assignee: 'Assignee:',
      gantt_unassigned: 'Unassigned',
      gantt_deadline_label: 'Deadline:',

      // Departments
      dept_media: 'Media Dept',
      dept_truyen_thong: 'Communications Dept',
      dept_noi_dung: 'Content Dept',
      dept_nhan_su: 'HR & Operations Dept',
      dept_duyet_bai: 'Quality Review Dept',
      dept_co_van: 'Advisory Board',
      dept_global: 'Channel / Global',

      // Statuses
      status_open: 'Open',
      status_in_progress: 'In Progress',
      status_submitted: 'In Review',
      status_completed: 'Completed',
      status_claimed: 'Claimed',
      status_working: 'Working',
      status_approved: 'Approved',
      status_rejected: 'Rejected',
      status_needs_revision: 'Needs Revision',
      status_overdue: 'Overdue',

      // Dashboard
      dash_eyebrow: 'Welcome, Cinematic Concept Member',
      dash_headline: 'Your contribution journey & impact.',
      dash_desc: 'Every contribution is verified with proof, clear ownership, and transparent ledger logs.',
      dash_season_label: 'ACTIVE SEASON',
      dash_season_title: 'Season 01 · Origin',
      stat_overall_xp: 'Total Contribution XP',
      stat_active_tasks: 'Active Missions',
      stat_completed_tasks: 'Completed Missions',
      stat_role_points: 'Role Points (Responsibility)',
      stat_available_tasks: 'Available Missions',
      stat_rank_sub: '#1 Leaderboard Rank',
      stat_quality_sub: '95% Quality Score',
      stat_role_sub: '+0.0 to Total (60% Conversion)',
      stat_ending_soon: '0 ending soon',
      panel_my_tasks: 'ASSIGNED MISSIONS',
      panel_recent_xp: 'RECENT XP TRANSACTIONS',
      btn_view_all: 'VIEW ALL →',
      btn_view_ledger: 'VIEW LEDGER →',

      // Board & Missions
      board_eyebrow: 'Contribution Opportunities',
      board_headline: 'Quest Board',
      board_desc: 'Choose missions matching your skills. Take ownership. Deliver value and accumulate XP.',
      board_scale_label: 'STANDARD XP SCALE',
      board_scale_val: '0.25 → 10+ XP',
      board_filter_all: 'All Missions',
      board_filter_global: 'Global Open',
      board_filter_dept: 'Department Open',
      board_filter_mandatory: 'Mandatory Missions',
      board_empty: 'No missions currently open.',
      btn_init_starter: '🚀 Initialize Standard Missions to System',
      card_difficulty: 'Difficulty:',
      card_deadline_title: 'SUBMISSION DEADLINE',
      card_btn_detail: 'Details & Claim',

      // Leaderboard
      lb_eyebrow: 'Transparent Member Recognition',
      lb_headline: 'Contribution Leaderboard',
      lb_desc: 'Total Score = Task XP + Bonus XP − Penalty XP + Converted Role Points (Role Point × 60%).',
      lb_tab_all: '🏆 Overall Ranking',
      lb_tab_core: '⭐ Core & Executives',
      lb_tab_advisor: '🎓 Advisory Board',
      lb_tab_members: '👥 Members',
      lb_tab_monthly: '📅 Monthly Ranking',
      lb_rules_title: 'SCORING RULES',
      lb_ai_verify_tag: 'AI AUDIT + HUMAN REVIEW',

      // Footer & Modals
      modal_close: 'Close',
      modal_cancel: 'Cancel',
      modal_create_btn: 'Create & Run AI Analysis',
      modal_claim_btn: 'Claim Mission (100% XP)',
      modal_submit_proof_btn: 'Submit Proof',
      modal_proof_url: 'Proof URL (Google Drive / Image / File / Link)',
      modal_proof_desc: 'Work summary & notes for reviewer',
      toast_lang_switched: 'Language switched to English 🇬🇧'
    }
  };

  // ---------------------------------------------------------------------------
  // PHRASE REPLACEMENT MAP (Direct text replacement for DOM nodes)
  // NOTE: "Ý Niệm Điện Ảnh" is the official brand name and is NOT translated.
  // ---------------------------------------------------------------------------
  const PHRASE_PAIRS = [
    // ===== BRAND (giữ nguyên "Ý Niệm Điện Ảnh") =====
    // DO NOT add ['Ý Niệm Điện Ảnh', '...'] — brand name stays as-is
    ['Film community', 'Cộng đồng điện ảnh'], // EN->VI pair for reverse
    ['MÙA 01 · NHIỆM VỤ', 'SEASON 01 · MISSIONS'],
    ['Cộng đồng điện ảnh', 'Film community'],
    ['Cộng đồng làm phim học sinh, sinh viên', 'Student & Youth Film Community'],

    // ===== NAVIGATION & HEADER =====
    ['Trang chủ', 'Home'],
    ['Về dự án', 'About Us'],
    ['Bình chọn', 'Voting'],
    ['Chứng nhận', 'Verification'],
    ['Tuyển dụng', 'Recruitment'],
    ['Bảng Xếp Hạng', 'Leaderboard'],
    ['Ban Tổ Chức', 'Organizing Board'],
    ['Chấm Điểm', 'Scoring & Rubric'],
    ['Vinh Danh', 'Hall of Fame'],
    ['Nhiệm Vụ', 'Missions'],
    ['Tổng quan', 'Overview'],
    ['Bảng nhiệm vụ', 'Quest Board'],
    ['Sơ đồ Gantt (Timeline)', 'Gantt Chart (Timeline)'],
    ['Sơ đồ Gantt', 'Gantt Chart'],
    ['Nhiệm vụ của tôi', 'My Missions'],
    ['Bảng vinh danh', 'Hall of Fame'],
    ['Duyệt bằng chứng', 'Review Evidence'],
    ['Sổ cái điểm XP', 'XP Ledger'],
    ['Đội sản xuất phim', 'Film Production Squads'],
    ['Đánh giá vai trò tuần', 'Weekly Role Reviews'],
    ['Tương tác & Thưởng', 'Interaction & Bonuses'],
    ['Không gian làm việc', 'Workspace'],
    ['Quản trị & Điều hành', 'Management & Operations'],
    ['Đăng nhập Google', 'Sign in with Google'],
    ['Đăng xuất', 'Sign out'],
    ['Khách ghé thăm', 'Guest Visitor'],
    ['THÀNH VIÊN', 'MEMBER'],
    ['Tạo nhiệm vụ mới', 'Create New Mission'],
    ['Tạo nhiệm vụ', 'Create Mission'],
    ['Quest Board', 'Quest Board'],

    // ===== TRANG CHỦ (index.html) — HERO =====
    ['DỰ ÁN ĐIỆN ẢNH HỌC ĐƯỜNG MÙA 01', 'STUDENT FILMMAKING PROJECT · SEASON 01'],
    ['Dự án cộng đồng về điện ảnh', 'Community filmmaking project'],
    ['Nơi Ý Tưởng Cất Cánh', 'Where Ideas Take Flight'],
    ['Đăng ký tham gia', 'Apply to Join'],
    ['Tìm hiểu dự án', 'Explore Project'],
    ['Khởi động & Tuyển BTC', 'Launch & Recruitment'],
    ['Đồng kiến tạo cộng đồng điện ảnh', 'Co-creating film community'],
    ['Giai đoạn', 'Current Stage'],
    ['Cơ hội', 'Opportunity'],
    ['Học sinh - Sinh viên toàn quốc', 'Students nationwide'],
    ['Tuyển BTC (Core & Member)', 'Recruiting Crew (Core & Members)'],

    // ===== EVENTS SECTION (index.html) =====
    ['Sự kiện đang & sắp diễn ra', 'Ongoing & Upcoming Events'],
    ['Nơi hội ngộ của những tâm hồn say mê điện ảnh. Theo dõi các hoạt động mới nhất từ dự án.', 'Where cinema enthusiasts gather. Follow the latest activities from the project.'],
    ['Chưa có sự kiện nào', 'No events yet'],
    ['Ban tổ chức sẽ cập nhật các hoạt động sắp tới tại đây.', 'The organizing team will update upcoming activities here.'],
    ['Đang diễn ra', 'Ongoing'],
    ['Sắp diễn ra', 'Upcoming'],
    ['Đã kết thúc', 'Ended'],
    ['Có phí', 'Paid'],
    ['Miễn phí', 'Free'],
    ['Đăng ký tham gia', 'Register to Join'],
    ['Đã đăng ký tham gia', 'Already Registered'],
    ['Thời gian:', 'Date:'],
    ['Địa điểm:', 'Venue:'],
    ['Sự kiện', 'Events'],

    // ===== ABOUT SECTION (index.html) =====
    ['Về Dự Án', 'About The Project'],
    ['Kiến tạo bệ phóng cho các nhà làm phim học sinh - sinh viên toàn quốc. Dự án cộng đồng, minh bạch 100%.', 'Building a launchpad for student filmmakers nationwide. 100% transparent community project.'],
    ['Sứ mệnh', 'Mission'],
    ['Kiến tạo bệ phóng cho thế hệ làm phim trẻ tuổi tài năng.', 'Building a launchpad for the next generation of talented young filmmakers.'],
    ['Tầm nhìn', 'Vision'],
    ['Trở thành cộng đồng điện ảnh học sinh - sinh viên lớn nhất Việt Nam.', 'Becoming the largest student film community in Vietnam.'],
    ['Giá trị cốt lõi', 'Core Values'],
    ['Sáng tạo tự do, minh bạch 100%, kết nối và sẻ chia.', 'Creative freedom, 100% transparency, connection and sharing.'],

    // ===== RULES SECTION (index.html) =====
    ['Thể Lệ & Tiêu Chí Chấm Giải', 'Rules & Judging Criteria'],
    ['Thông tin kỹ thuật và nguyên tắc đánh giá từ Hội đồng chuyên môn', 'Technical specifications and evaluation principles from the Expert Panel'],
    ['Phân hạng Thiết bị Công bằng', 'Fair Device Classification'],
    ['Hình thức chấm điểm', 'Scoring Method'],

    // ===== APPLY / RECRUITMENT SECTION (index.html) =====
    ['Đồng hành cùng dự án', 'Join the Project'],
    ['Chọn vai trò của bạn để cùng thắp sáng đam mê điện ảnh.', 'Choose your role to ignite the passion for cinema.'],
    ['Ban Tổ Chức Mùa 1', 'Organizing Committee Season 1'],
    ['Tham gia ban nội dung, truyền thông, hậu cần hoặc thiết kế.', 'Join the content, communication, logistics, or design team.'],
    ['Thành viên Cộng đồng', 'Community Member'],
    ['Đăng ký tài khoản để bình chọn, tham gia thảo luận và gửi phim.', 'Register an account to vote, join discussions, and submit films.'],
    ['Quy trình tuyển dụng', 'Recruitment Process'],
    ['Nộp đơn trực tuyến', 'Apply Online'],
    ['Điền thông tin và gửi CV/Portfolio.', 'Fill in your info and submit CV/Portfolio.'],
    ['Phỏng vấn', 'Interview'],
    ['Trò chuyện trực tiếp cùng Ban điều hành.', 'Direct conversation with the Executive Board.'],
    ['Thử thách', 'Challenge'],
    ['Thực hiện bài test nhỏ tùy vị trí.', 'Complete a small position-specific test.'],
    ['Onboarding', 'Onboarding'],
    ['Gia nhập đội ngũ cốt lõi.', 'Join the core team.'],
    ['Apply BTC', 'Apply as Crew'],
    ['Tạo Tài Khoản', 'Create Account'],
    ['Đăng nhập', 'Sign In'],

    // ===== SPONSOR / DONATE SECTION (index.html) =====
    ['Đồng hành duy trì website', 'Website maintenance supporter'],
    ['Khoản đóng góp dành riêng cho nền tảng trực tuyến, không thuộc quỹ giải thưởng.', 'This contribution is exclusively for the online platform, not the prize fund.'],
    ['Người Donate Đầu Tiên', 'First Donor'],
    ['Người đồng hành duy trì website — Season 1', 'Website maintenance partner — Season 1'],

    // ===== VINH DANH (vinh-danh.html) =====
    ['Khu Vinh Danh', 'Hall of Honor'],
    ['Những Người Đồng Hành', 'Our Supporters'],
    ['Những sự tin tưởng và đồng hành quý báu đã giúp nền tảng trực tuyến của Ý Niệm Điện Ảnh tiếp tục phát triển.', 'The trust and precious partnership that keeps the Ý Niệm Điện Ảnh online platform growing.'],
    ['Hạng mục', 'Category'],
    ['Duy trì website', 'Website maintenance'],
    ['Ghi nhận', 'Recognition'],
    ['Danh hiệu', 'Title'],
    ['Ghi lại những khoảnh khắc trước khi chúng trở thành ký ức.', 'Capturing moments before they become memories.'],

    // ===== CHANNELS (Gantt 2-channel) =====
    ['Tất cả các kênh', 'All Channels'],
    ['Tất cả kênh', 'All Channels'],
    ['KÊNH CHÍNH', 'MAIN CHANNEL'],
    ['KÊNH PHỤ', 'SECONDARY CHANNEL'],
    ['Kênh Chính', 'Main Channel'],
    ['Kênh Phụ', 'Secondary Channel'],
    ['Kênh phát sóng & Dự án', 'Broadcast Channel & Project'],

    // ===== DEPARTMENTS =====
    ['Ban Media', 'Media Dept'],
    ['Ban Truyền thông', 'Communications Dept'],
    ['Ban Nội dung', 'Content Dept'],
    ['Ban Nhân sự', 'HR & Operations Dept'],
    ['Ban Duyệt bài', 'Quality Review Dept'],
    ['Ban Cố vấn chuyên môn', 'Expert Advisory Board'],
    ['Ban Cố vấn', 'Advisory Board'],
    ['Toàn dự án / Kênh', 'Global / Channel'],
    ['Toàn dự án', 'Global / Project-wide'],

    // ===== TASK STATUSES & STATES =====
    ['Đang mở', 'Open'],
    ['Đang làm', 'In Progress'],
    ['Chờ duyệt', 'Under Review'],
    ['Hoàn thành', 'Completed'],
    ['Đã nhận việc', 'Claimed'],
    ['Đang thực hiện', 'In Progress'],
    ['Quá hạn', 'Overdue'],
    ['Hôm nay', 'Today'],
    ['Toàn khung', 'Full Width'],
    ['Thu gọn', 'Standard View'],
    ['Hạn chót:', 'Deadline:'],
    ['Phụ trách:', 'Assignee:'],
    ['Chưa nhận', 'Unassigned'],
    ['Linh hoạt (Chưa chốt)', 'Flexible (TBD)'],
    ['Chi tiết & Nhận việc', 'Details & Claim'],
    ['Nhận nhiệm vụ (100% XP)', 'Claim Mission (100% XP)'],
    ['Nộp bằng chứng', 'Submit Proof'],
    ['Đóng', 'Close'],
    ['Hủy', 'Cancel'],
    ['Tạo & Phân tích AI', 'Create & AI Analysis'],

    // ===== DASHBOARD & METRICS (ynda.html) =====
    ['Tổng điểm cống hiến', 'Total Contribution XP'],
    ['Nhiệm vụ đang làm', 'Active Missions'],
    ['Nhiệm vụ hoàn thành', 'Completed Missions'],
    ['Điểm vai trò (Trách nhiệm)', 'Role Points (Responsibility)'],
    ['Nhiệm vụ đang mở', 'Available Missions'],
    ['NHIỆM VỤ ĐANG PHỤ TRÁCH', 'ASSIGNED MISSIONS'],
    ['LỊCH SỬ GIAO DỊCH XP GẦN ĐÂY', 'RECENT XP TRANSACTIONS'],
    ['THỜI GIAN CHỦ ĐỘNG CHỐT BÀI', 'SUBMISSION DEADLINE'],
    ['THANG ĐIỂM CHUẨN', 'STANDARD XP SCALE'],
    ['Mở toàn dự án', 'Global Open'],
    ['Mở theo Ban', 'Department Open'],
    ['Nhiệm vụ bắt buộc', 'Mandatory Missions'],
    ['Tất cả nhiệm vụ', 'All Missions'],
    ['Tất cả trạng thái', 'All Status'],
    ['Tất cả các Ban', 'All Departments'],
    ['Bảng vinh danh thành viên minh bạch', 'Transparent Member Recognition'],
    ['Bảng xếp hạng cống hiến', 'Contribution Leaderboard'],
    ['Tổng sắp toàn dự án', 'Overall Ranking'],
    ['Ban điều hành & Core', 'Core & Executives'],
    ['Thành viên', 'Members'],
    ['Xếp hạng theo tháng', 'Monthly Ranking'],
    ['Hành trình đóng góp & dấu ấn.', 'Your contribution journey & impact.'],
    ['Mỗi đóng góp đều có bằng chứng rõ ràng, chủ sở hữu và lịch sử ghi nhận minh bạch.', 'Every contribution has clear proof, ownership, and transparent ledger records.'],
    ['Bảng cơ hội đóng góp', 'Contribution Opportunities'],
    ['Chọn nhiệm vụ phù hợp với chuyên môn. Nhận quyền sở hữu. Đóng góp và tích lũy XP.', 'Choose missions matching your expertise. Take ownership. Contribute and accumulate XP.'],

    // ===== DASHBOARD (dashboard.html) =====
    ['Tổng quan vận hành', 'Operations Overview'],
    ['Sự kiện kích hoạt', 'Active Events'],
    ['Nhân sự Ban Tổ Chức', 'Organizing Staff'],
    ['Tài khoản dự án', 'Project Accounts'],
    ['Đơn apply chờ duyệt', 'Pending Applications'],
    ['Công việc cần làm', 'Tasks To Do'],
    ['Nhiệm vụ của bạn', 'Your Tasks'],
    ['Đã đăng ký dự án', 'Project Registrations'],
    ['Cấu hình cổng bình chọn', 'Voting Portal Settings'],
    ['Mở cổng vote', 'Open Voting'],
    ['Đóng cổng vote', 'Close Voting'],
    ['Lưu cấu hình', 'Save Settings'],
    ['Đang mở', 'Open'],
    ['Chưa mở', 'Not Open'],
    ['Đã đóng', 'Closed'],
    ['Chưa cấu hình', 'Not Configured'],

    // ===== BAN TO CHUC (ban-to-chuc.html) =====
    ['Không thể tải dữ liệu Ban Tổ Chức & Thành Viên', 'Unable to load Organizing Board & Members data'],
    ['Vui lòng kiểm tra lại kết nối mạng.', 'Please check your network connection.'],
    ['Thử lại', 'Try Again'],

    // ===== CHAM DIEM (cham-diem.html) =====
    ['Vui lòng nhập tên người được đánh giá và tuần.', 'Please enter the name and week of the person being evaluated.'],
    ['Đang ghi đánh giá...', 'Recording evaluation...'],
    ['Đang ghi nhận...', 'Recording...'],

    // ===== COMMON ACTIONS & LABELS =====
    ['Xem chi tiết', 'View Details'],
    ['Thêm mới', 'Add New'],
    ['Lưu', 'Save'],
    ['Xóa', 'Delete'],
    ['Tải lên', 'Upload'],
    ['Tải xuống', 'Download'],
    ['Chỉnh sửa', 'Edit'],
    ['Cập nhật', 'Update'],
    ['Xác nhận', 'Confirm'],
    ['Từ chối', 'Reject'],
    ['Phê duyệt', 'Approve'],
    ['Gửi', 'Send'],
    ['Tiếp tục', 'Continue'],
    ['Quay lại', 'Go Back'],
    ['Tìm kiếm', 'Search'],
    ['Lọc', 'Filter'],
    ['Sắp xếp', 'Sort'],
    ['Hiển thị', 'Display'],
    ['Ẩn', 'Hide'],
    ['Thêm', 'Add'],
    ['Bớt', 'Remove'],
    ['Chọn', 'Select'],
    ['Bỏ chọn', 'Deselect'],

    // ===== FOOTER =====
    ['Tất cả quyền được bảo lưu.', 'All rights reserved.'],

    // ===== MISC & TOASTS =====
    ['Đã copy link vote!', 'Vote link copied!'],
    ['Không thể copy. Vui lòng copy thủ công.', 'Cannot copy. Please copy manually.'],
    ['Cổng bình chọn chưa mở. Quay lại sau nhé!', 'Voting portal not open yet. Come back later!'],
    ['Cổng bình chọn đã đóng. Cảm ơn bạn đã theo dõi!', 'Voting portal has closed. Thanks for following!'],
    ['Độ khó:', 'Difficulty:'],
    ['Phần thưởng XP', 'XP Reward'],
    ['Thời gian bắt đầu làm', 'Work Start Time'],
    ['Yêu cầu bằng chứng', 'Proof Requirement'],
    ['Mô tả & Tiêu chuẩn đầu ra', 'Description & Expected Output'],
    ['Ban phụ trách', 'Department'],
    ['Phạm vi nhiệm vụ', 'Mission Scope'],
    ['Hạn chót nhận việc', 'Claim Deadline'],
    ['Thời gian chủ động chốt bài (Deadline)', 'Submission Deadline'],
    ['Mô tả kết quả & Ghi chú cho Reviewer', 'Work summary & notes for reviewer'],
    ['Đường dẫn bằng chứng (Google Drive / Ảnh / File / Link)', 'Proof URL (Google Drive / Image / File / Link)'],
    ['Tên nhiệm vụ', 'Mission Title'],
    ['Khởi tạo nhiệm vụ mới', 'Create New Mission'],
    ['Phân loại theo 2 Kênh giúp đồng bộ tiến độ và sơ đồ Gantt minh bạch.', 'Categorized by 2 Channels for transparent progress tracking and Gantt chart synchronization.'],
    ['TẠO NHIỆM VỤ · TÍCH HỢP AI', 'CREATE MISSION · AI-POWERED'],
    ['Khởi tạo nhiệm vụ chuẩn vào hệ thống', 'Initialize standard missions to system'],
    ['Hiện chưa có nhiệm vụ nào đang mở', 'No missions currently open'],
    ['Hệ thống hoạt động với dữ liệu 2 Kênh (Kênh Chính & Kênh Phụ). Bạn có thể tạo nhiệm vụ mới hoặc khởi tạo nhanh các nhiệm vụ mẫu chuẩn.', 'The system runs on 2-Channel data (Main & Secondary Channel). You can create new missions or initialize standard templates.'],

    // ===== HOMEPAGE HONOR ROLL (Vinh danh trang chủ) =====
    ['Nội dung vinh danh trên website', 'Website Recognition Content'],
    ['Người Đồng Hành Cùng Ý Niệm Điện Ảnh', 'Partners of Ý Niệm Điện Ảnh'],
    ['Hiển thị trên Trang chủ:', 'Displayed on Homepage:'],
    ['Người đồng hành duy trì website — Season 1', 'Website Maintenance Partner — Season 1'],
    ['Hạng mục đóng góp', 'Contribution Category'],
    ['Giá trị đóng góp', 'Contribution Value'],
    ['Thời gian ghi nhận', 'Recognition Period'],
    ['Đồng hành duy trì website — Season 1', 'Website Maintenance Support — Season 1'],
    ['Vinh danh rút gọn', 'Compact Recognition'],

    // ===== HERO SUBLEAD & SLOGAN =====
    ['là cộng đồng sáng tạo và hệ sinh thái học tập dành cho học sinh, sinh viên yêu thích làm phim, nhiếp ảnh, và phê bình điện ảnh.', 'is a creative community and learning ecosystem for students passionate about filmmaking, photography, and film criticism.'],

    // ===== FAQ SECTION =====
    ['Câu hỏi thường gặp', 'Frequently Asked Questions'],
    ['Mọi thắc mắc về dự án sẽ được giải đáp tại đây.', 'All questions about the project are answered here.'],

    // ===== HOMEPAGE ABOUT — Leadership & Core Team =====
    ['Nhóm nòng cốt sáng lập, đồng kiến tạo chiến lược và định hướng dài hạn cho dự án', 'Founding core team, co-creating strategy and long-term direction for the project'],
    ['Ban điều hành', 'Executive Board'],
    ['Trưởng dự án', 'Project Lead'],
    ['Phó dự án', 'Deputy Lead'],

    // ===== VOTING SECTION =====
    ['Bình chọn trực tuyến', 'Online Voting'],
    ['Bình chọn cho tác phẩm yêu thích', 'Vote for your favorite work'],
    ['Cổng bình chọn', 'Voting Portal'],
    ['Tác phẩm dự thi', 'Competition Entries'],
    ['Lượt bình chọn', 'Votes'],
    ['Bình chọn ngay', 'Vote Now'],
    ['Chia sẻ lên Facebook', 'Share on Facebook'],
    ['Copy link bình chọn', 'Copy voting link'],
    ['Chia sẻ', 'Share'],

    // ===== COMMUNITY PAGE =====
    ['Cộng đồng', 'Community'],
    ['Kênh phát sóng', 'Broadcast Channel'],
    ['Tin nhắn', 'Messages'],
    ['Bài đăng', 'Posts'],
    ['Bình luận', 'Comments'],
    ['Thích', 'Like'],
    ['Trả lời', 'Reply'],
    ['Theo dõi', 'Follow'],
    ['Đang theo dõi', 'Following'],
    ['Thành viên mới', 'New Member'],
    ['Quản trị viên', 'Administrator'],
    ['Điều hành viên', 'Moderator'],

    // ===== SCHEDULE PAGE =====
    ['Lịch trình', 'Schedule'],
    ['Lịch hoạt động', 'Activity Schedule'],
    ['Tuần này', 'This Week'],
    ['Tháng này', 'This Month'],
    ['Tất cả', 'All'],

    // ===== REGISTER PAGE (register.html) — Registration & Application Portal =====
    ['Cổng Đăng Ký & Ứng Tuyển', 'Registration & Application Portal'],
    ['Chọn vai trò của bạn để bắt đầu đồng hành cùng chúng tôi', 'Choose your role to begin your journey with us'],
    ['Apply Ban Tổ Chức', 'Apply for Organizing Committee'],
    ['Trực tiếp vận hành các ban Media, duyệt bài, Nội dung, Nhân sự, Truyền thông (Tuyển Member & Phó ban).', 'Directly run the Media, Review, Content, HR & Communications departments (hiring Members & Deputy Leads).'],
    ['Thành viên & Đăng nhập', 'Member & Sign In'],
    ['Tạo tài khoản thành viên để nộp bài thi, bình chọn tác phẩm hoặc đăng nhập khu nội bộ.', 'Create a member account to submit entries, vote for works, or sign in to the private area.'],
    ['🔐 Đăng Nhập Khu Vực Nội Bộ', '🔐 Sign in to the Private Area'],
    ['Truy cập hồ sơ của bạn và quản lý công việc dự án.', 'Access your profile and manage project tasks.'],
    ['Email', 'Email'],
    ['Mật khẩu', 'Password'],
    ['Quên mật khẩu?', 'Forgot password?'],
    ['Gửi lại email xác thực', 'Resend verification email'],
    ['Hoặc', 'Or'],
    ['Đăng nhập bằng Google', 'Sign in with Google'],
    ['Chưa có tài khoản?', "Don't have an account?"],
    [' và ', ' and '],
    ['Quay lại Trang chủ', 'Back to Homepage'],
    ['Đăng ký thành viên', 'Register as a Member'],
    ['🍿 Tạo Tài Khoản Thành Viên', '🍿 Create Member Account'],
    ['Nhận tin tức mới nhất, tham gia bình chọn và tương tác với cộng đồng.', 'Get the latest news, join voting and interact with the community.'],
    ['Họ và tên *', 'Full Name *'],
    ['Email đăng ký *', 'Registration Email *'],
    ['Số điện thoại / Zalo *', 'Phone / Zalo *'],
    ['Trường / đơn vị học tập *', 'School / Institution *'],
    ['Lớp / khoa / năm học *', 'Class / Major / Academic Year *'],
    ['Vai trò quan tâm *', 'Role of Interest *'],
    ['Khán giả (Bình chọn tác phẩm)', 'Audience (Vote for works)'],
    ['Thí sinh / Người làm phim (Đăng ký đội thi)', 'Contestant / Filmmaker (Register team)'],
    ['Ban tổ chức / Cộng tác viên dự án', 'Organizing Committee / Project Collaborator'],
    ['Khách mời / Người tham gia sự kiện (Workshop, Gala...)', 'Guest / Event participant (Workshop, Gala...)'],
    ['Làm phim - Độc lập (Fulltask)', 'Filmmaking - Independent (Full task)'],
    ['Khác (nhập bên dưới)', 'Other (enter below)'],
    ['Giới thiệu ngắn (Không bắt buộc)', 'Short introduction (Optional)'],
    ['Mật khẩu (Tối thiểu 6 ký tự) *', 'Password (at least 6 characters) *'],
    ['Tôi đồng ý với', 'I agree to the'],
    ['Điều khoản sử dụng', 'Terms of Use'],
    ['Chính sách quyền riêng tư', 'Privacy Policy'],
    ['Tạo tài khoản', 'Create Account'],
    ['Đã có tài khoản?', 'Already have an account?'],
    ['Đăng nhập ngay', 'Sign in now'],
    ['Hoàn Tất Thông Tin Tài Khoản', 'Complete Account Information'],
    ['Google đã xác thực tài khoản của bạn. Bổ sung thông tin khi tiện; bạn cũng có thể làm sau.', 'Google has verified your account. Add more info when convenient; you can also do it later.'],
    ['Hoàn tất đăng ký', 'Complete Registration'],
    ['Làm sau', 'Do it later'],
    ['Yêu Cầu Đăng Nhập', 'Sign In Required'],
    ['Vui lòng đăng nhập bằng tài khoản Google để tiếp tục điền đơn ứng tuyển vị trí này.', 'Please sign in with your Google account to continue applying for this position.'],
    ['Đơn Ứng Tuyển President (Chủ tịch)', 'President Application (Chairperson)'],
    ['Hãy chia sẻ thông tin và tầm nhìn của bạn để cùng chúng tôi lãnh đạo dự án cất cánh.', 'Share your information and vision to help us lead the project.'],
    ['Email liên hệ *', 'Contact Email *'],
    ['Giới thiệu bản thân & kinh nghiệm liên quan *', 'Self-introduction & relevant experience *'],
    ['Tầm nhìn & Định hướng phát triển dự án *', 'Vision & Development Direction *'],
    ['Gửi đơn tuyển đợt 2 - President', 'Submit Round-2 Application - President'],
    ['Đơn Ứng Tuyển Co-founder', 'Co-founder Application'],
    ['Chia sẻ kinh nghiệm, thế mạnh và cách bạn muốn đồng kiến tạo dự án.', 'Share your experience, strengths and how you want to co-create the project.'],
    ['Gửi đơn tuyển đợt 2 - Co-founder', 'Submit Round-2 Application - Co-founder'],
    ['Đơn tuyển đợt 2 - Ban Tổ Chức (BTC)', 'Round-2 Application - Organizing Committee (BTC)'],
    ['Chọn phân ban thế mạnh và cùng chúng tôi tổ chức các hoạt động sôi nổi của dự án.', 'Choose your strongest department and help organize the project activities.'],
    ['Phân ban bạn muốn ứng tuyển *', 'Department you want to apply for *'],
    ['Ban Media (Thiết kế & Edit)', 'Media Dept (Design & Edit)'],
    ['Ban duyệt bài', 'Review Dept'],
    ['Ban Nội Dung', 'Content Dept'],
    ['Ban Nhân Sự', 'HR & Operations Dept'],
    ['Ban Truyền Thông', 'Communications Dept'],
    ['Vị trí ứng tuyển *', 'Position you are applying for *'],
    ['Thành viên (Member)', 'Member'],
    ['Phó ban', 'Deputy Lead'],
    ['Phó ban (Tạm đóng nhận đơn)', 'Deputy Lead (temporarily closed)'],
    ['Core Member (Tạm đóng nhận đơn)', 'Core Member (temporarily closed)'],
    ['Giới thiệu bản thân & lý do muốn đồng hành *', 'Self-introduction & reason to join *'],
    ['Gửi đơn tuyển đợt 2 - BTC', 'Submit Round-2 Application - BTC'],
    ['Đang tạm đóng nhận đơn', 'Temporarily closed for applications'],
    ['Phân ban này đang tạm đóng nhận đơn', 'This department is temporarily closed for applications'],
    ['Core Member', 'Core Member'],
    ['Phân ban này hiện đang tạm đóng nhận đơn. Vui lòng chọn phân ban khác.', 'This department is temporarily closed. Please choose another department.'],
    ['Vị trí Core Member của phân ban này đang tạm đóng. Vui lòng chọn vị trí khác.', 'The Core Member position in this department is temporarily closed. Please choose another.'],
    ['Vị trí Phó ban của phân ban này đang tạm đóng. Vui lòng chọn vị trí khác.', 'The Deputy Lead position in this department is temporarily closed. Please choose another.'],
    ['Vui lòng đăng nhập để điền đơn ứng tuyển vị trí này.', 'Please sign in to fill in the application for this position.'],
    ['Vui lòng đăng nhập để điền đơn Co-founder.', 'Please sign in to fill in the Co-founder application.'],
    ['Đơn President hiện đang tạm đóng nhận đơn.', 'President applications are temporarily closed.'],
    ['Đơn Co-founder hiện đang tạm đóng nhận đơn.', 'Co-founder applications are temporarily closed.'],
    ['Đang đăng nhập...', 'Signing in...'],
    ['Đang xử lý...', 'Processing...'],
    ['Đang lưu...', 'Saving...'],
    ['Đang gửi đơn ứng tuyển...', 'Submitting your application...'],
    ['Đã gửi đơn thành công! Hội đồng sáng lập sẽ liên hệ lại với bạn sớm nhất qua Zalo/Email.', 'Application submitted successfully! The founding board will contact you soon via Zalo/Email.'],
    ['Gửi đơn tuyển đợt 2 thành công!', 'Round-2 application submitted successfully!'],
    ['Gặp lỗi:', 'Error:'],
    ['Đăng nhập thành công!', 'Signed in successfully!'],
    ['Đăng ký thành công! Vui lòng check Gmail của bạn.', 'Registration successful! Please check your Gmail.'],
    ['Đã tạo tài khoản bằng Google!', 'Account created with Google!'],
    ['Cập nhật thông tin tài khoản thành công!', 'Account information updated successfully!'],
    ['Đã đăng nhập! Đang chuyển hướng đến Khu nội bộ...', 'Signed in! Redirecting to the private area...'],
    ['Chào mừng quay lại, ', 'Welcome back, '],
    ['Thành viên mới', 'New Member'],
    ['Vui lòng nhập email và mật khẩu!', 'Please enter your email and password!'],
    ['Vui lòng điền đầy đủ các trường thông tin bắt buộc!', 'Please fill in all required fields!'],
    ['Mật khẩu phải dài từ 6 ký tự trở lên!', 'Password must be at least 6 characters!'],
    ['Vui lòng hoàn tất mã kiểm tra Turnstile để chống spam!', 'Please complete the Turnstile check to prevent spam!'],
    ['Vui lòng nhập số điện thoại / Zalo!', 'Please enter your phone / Zalo number!'],
    ['Số điện thoại Zalo phải có đúng 10 chữ số!', 'Zalo phone number must have exactly 10 digits!'],
    ['Giới thiệu bản thân phải dài tối thiểu 20 ký tự!', 'Self-introduction must be at least 20 characters!'],
    ['Tầm nhìn & đóng góp phải dài tối thiểu 30 ký tự!', 'Vision & contribution must be at least 30 characters!'],
    ['Đã đăng ký dự án', 'Project Registrations'],

    // ===== TERMS PAGE (terms.html) =====
    ['ĐIỀU KHOẢN SỬ DỤNG', 'TERMS OF USE'],
    ['Cập nhật lần cuối: Tháng 7 năm 2026', 'Last updated: July 2026'],
    ['Chào mừng bạn đến với ', 'Welcome to '],
    ['. Quy chế hoạt động và Điều khoản sử dụng này thiết lập các điều kiện pháp lý ràng buộc giữa dự án và bạn khi truy cập, đăng ký tài khoản, tham gia cộng đồng hoặc nộp bài dự thi làm phim ngắn. Vui lòng đọc kỹ các nội dung dưới đây.', '. These Operating Regulations and Terms of Use set out the legally binding conditions between the project and you when accessing, registering, joining the community or submitting a short film. Please read carefully.'],
    ['1. Định nghĩa và Dịch vụ', '1. Definitions & Services'],
    ['cung cấp nền tảng số hỗ trợ học sinh, sinh viên yêu thích điện ảnh, bao gồm các hoạt động chính:', 'provides a digital platform supporting students passionate about cinema, including the main activities:'],
    ['Cung cấp thư viện bài học, biểu mẫu hướng dẫn và tài nguyên làm phim bản quyền hợp lệ.', 'Providing a library of lessons, guides and legally licensed filmmaking resources.'],
    ['Tổ chức các sự kiện đào tạo trực tuyến/trực tiếp (Workshop), giao lưu điện ảnh.', 'Organizing online/offline training events (Workshops) and cinema exchanges.'],
    ['Tổ chức cuộc thi làm phim ngắn thường niên và vận hành cổng bình chọn trực tuyến cho cộng đồng.', 'Organizing the annual short film contest and running the online voting portal for the community.'],
    ['2. Tạo và Bảo mật tài khoản', '2. Account Creation & Security'],
    ['Khi đăng ký tài khoản bằng Email thường hoặc tài khoản Google, bạn cam kết cung cấp thông tin cá nhân chính xác, trung thực (Họ tên, Số điện thoại, Trường/Lớp đang theo học).', 'When registering with email or a Google account, you commit to providing accurate, truthful personal information (name, phone, school/class).'],
    ['Mỗi người dùng chỉ được đăng ký một tài khoản duy nhất. Mọi hành vi tạo nhiều tài khoản ảo sẽ bị đình chỉ tư cách tham gia cộng đồng.', 'Each user may register only one account. Any creation of multiple fake accounts will result in suspension from the community.'],
    ['Bạn có trách nhiệm tự bảo mật mật khẩu của mình. Dự án sẽ không chịu trách nhiệm cho bất kỳ tổn thất nào phát sinh do tài khoản của bạn bị bên thứ ba sử dụng trái phép.', 'You are responsible for keeping your password secure. The project is not liable for losses arising from unauthorized third-party use of your account.'],
    ['3. Đăng ký cuộc thi và Đóng góp quỹ', '3. Contest Registration & Fund Contributions'],
    ['Để đảm bảo tính minh bạch, hạn chế tài khoản ảo và nâng cao trách nhiệm khi tham gia, hệ thống yêu cầu đóng góp một khoản quỹ nhỏ (ví dụ: 5.000đ khi gia nhập đội ngũ hoặc đăng ký dự thi).', 'To ensure transparency, limit fake accounts and encourage responsibility, the system requires a small fund contribution (e.g. VND 5,000 when joining a team or registering to compete).'],
    ['Cơ chế phân bổ:', 'Allocation mechanism:'],
    ['Khoản đóng góp được tái đầu tư vào hoạt động của dự án, bao gồm giải thưởng, chứng nhận và chi phí vận hành theo kế hoạch công khai. Chi tiết phân bổ ngân sách được cập nhật trong báo cáo tài chính định kỳ.', 'Contributions are reinvested into project operations, including prizes, certificates and running costs per the public plan. Budget allocation details are updated in periodic financial reports.'],
    ['Mọi giao dịch thanh toán lệ phí hoặc đóng góp được xử lý tự động qua các cổng liên kết an toàn (như PayOS). Khi đã hoàn thành giao dịch thành công, khoản đóng góp sẽ không được hoàn trả dưới bất kỳ hình thức nào.', 'All fee or contribution payments are processed automatically through secure gateways (such as PayOS). Once a transaction completes, contributions are non-refundable in any form.'],
    ['4. Quyền sở hữu trí tuệ và Bản quyền tác phẩm', '4. Intellectual Property & Work Copyright'],
    ['Quyền của Thí sinh:', 'Contestant rights:'],
    ['Các đội thi và thí sinh tham gia giữ toàn bộ quyền sở hữu trí tuệ gốc đối với tác phẩm phim ngắn do mình sản xuất.', 'Participating teams and contestants retain all original intellectual property rights over the short films they produce.'],
    ['Quyền của Dự án:', 'Project rights:'],
    ['Bằng việc nộp bài dự thi, thí sinh cấp quyền cho Ban tổ chức Ý Niệm Điện Ảnh được phép sử dụng hình ảnh, trailer, đoạn cắt hoặc toàn bộ tác phẩm phim ngắn để trình chiếu, quảng bá và phổ biến trên các nền tảng truyền thông của dự án vì mục đích phi thương mại.', 'By submitting, contestants grant the Organizing Board permission to use images, trailers, clips or whole films for non-commercial screening, promotion and distribution on project platforms.'],
    ['Cam kết bản quyền:', 'Copyright commitment:'],
    ['Thí sinh tự chịu trách nhiệm pháp lý đảm bảo tác phẩm không vi phạm bản quyền hình ảnh, kịch bản, và đặc biệt là âm nhạc. Khuyến khích thí sinh sử dụng danh sách thư viện nhạc hợp lệ được dự án cung cấp. Dự án không giải quyết các tranh chấp bản quyền giữa thí sinh và bên thứ ba.', 'Contestants are legally responsible for ensuring their works do not violate image, script or especially music copyright. Using the project\'s licensed music library is encouraged. The project does not resolve copyright disputes between contestants and third parties.'],
    ['5. Quy tắc Bình chọn (Audience Choice) và Chống gian lận', '5. Voting Rules (Audience Choice) & Anti-Fraud'],
    ['Giải Bình chọn của Cộng đồng (Audience Choice) là hạng mục riêng, không ảnh hưởng đến kết quả chấm giải chuyên môn. Để đảm bảo tính công bằng:', 'The Community Audience Choice award is a separate category and does not affect professional judging results. To ensure fairness:'],
    ['Mỗi tài khoản hợp lệ chỉ được thực hiện bình chọn 01 lần duy nhất cho mỗi tác phẩm dự thi.', 'Each valid account may vote only once per contest entry.'],
    ['Hệ thống tích hợp công nghệ tự động kiểm tra địa chỉ IP và mã thiết bị đặc trưng để nhận diện hành vi spam.', 'The system automates IP and device-fingerprint checks to detect spam behavior.'],
    ['Nghiêm cấm tuyệt đối:', 'Strictly prohibited:'],
    ['Sử dụng bot, tài khoản ảo (clone), phần mềm thay đổi IP/VPN, hoặc mua bán lượt bình chọn dưới mọi hình thức để can thiệp vào kết quả.', 'Using bots, fake (clone) accounts, IP/VPN-changing software, or buying/selling votes in any form to interfere with results.'],
    ['Ban tổ chức có toàn quyền hủy bỏ lượt bình chọn nghi vấn, hạ điểm bình chọn hoặc tước quyền tham gia của đội thi nếu phát hiện hành vi gian lận cố ý mà không cần báo trước.', 'The Organizing Board has full authority to cancel suspicious votes, lower scores or disqualify teams upon detection of intentional fraud without prior notice.'],
    ['6. Giới hạn trách nhiệm', '6. Limitation of Liability'],
    ['Dự án Ý Niệm Điện Ảnh là dự án cộng đồng hỗ trợ học tập và thực hành nghệ thuật. Chúng tôi nỗ lực tối đa để vận hành hệ thống ổn định nhưng không cam kết website sẽ luôn hoạt động liên tục hoặc hoàn toàn không gặp lỗi kỹ thuật ngoài tầm kiểm soát.', 'The project is a community initiative supporting learning and artistic practice. We strive to keep the system stable but do not guarantee uninterrupted operation or zero technical faults beyond our control.'],
    ['Chúng tôi không can thiệp và không chịu trách nhiệm đối với các tranh chấp nội bộ xảy ra giữa các thành viên trong cùng một đội thi (như phân chia quyền tác giả, giải thưởng hoặc tài chính nội bộ).', 'We do not intervene nor accept liability for internal disputes among members of the same team (e.g. authorship, prize or team-finance sharing).'],
    ['7. Thay đổi Điều khoản', '7. Changes to Terms'],
    ['Ban tổ chức có quyền sửa đổi, bổ sung các điều khoản này vào bất kỳ lúc nào để phù hợp với hoạt động tổ chức thực tế. Mọi thay đổi sẽ có hiệu lực ngay khi được cập nhật tại trang web này. Việc bạn tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp thuận các điều khoản mới.', 'The Organizing Board may amend these terms at any time to match actual operations. Changes take effect once updated on this site. Continued use of the service means acceptance of the new terms.'],
    ['© 2026 Ý Niệm Điện Ảnh. Dự án cộng đồng dành cho thế hệ trẻ.', '© 2026 Ý Niệm Điện Ảnh. A community project for the young generation.'],

    // ===== PRIVACY PAGE (privacy.html) =====
    ['CHÍNH SÁCH QUYỀN RIÊNG TƯ', 'PRIVACY POLICY'],
    ['Bảo mật thông tin của bạn là ưu tiên hàng đầu của ', 'Protecting your information is our top priority at '],
    ['. Chính sách quyền riêng tư này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân của bạn khi bạn sử dụng dịch vụ trên website của chúng tôi.', '. This Privacy Policy explains how we collect, use, store and protect your personal data when you use our website services.'],
    ['1. Các loại thông tin thu thập', '1. Types of Information Collected'],
    ['Chúng tôi thu thập dữ liệu từ bạn thông qua hai hình thức: thông tin bạn chủ động cung cấp và thông tin hệ thống kỹ thuật tự động ghi nhận.', 'We collect data in two ways: information you voluntarily provide and information automatically recorded by the technical system.'],
    ['Thông tin hồ sơ cá nhân:', 'Personal profile information:'],
    ['Họ và tên, địa chỉ email (xác thực qua OTP hoặc Google), số điện thoại/Zalo liên lạc, tên trường/đơn vị đang học tập, thông tin lớp/khoa/năm học, và ảnh đại diện (avatar) nếu bạn tải lên.', 'Full name, email (verified via OTP or Google), phone/Zalo number, school/institution, class/major/year, and avatar if uploaded.'],
    ['Dữ liệu hoạt động trên hệ thống:', 'Activity data on the system:'],
    ['Bao gồm lịch sử tiến trình học tập các bài học điện ảnh, kết quả tham gia khảo sát, chứng nhận đã được cấp, danh sách đội thi bạn tham gia, tác phẩm phim ngắn nộp dự thi và các nội dung bình luận công khai.', 'Including learning progress history, survey results, certificates issued, teams you joined, submitted short films and public comments.'],
    ['Thông tin kỹ thuật chống gian lận:', 'Technical anti-fraud information:'],
    ['Địa chỉ IP truy cập, thông tin trình duyệt, hệ điều hành và mã nhận diện thiết bị đặc trưng (device fingerprinting). Các thông tin này được thu thập tự động mỗi khi bạn thực hiện chức năng bình chọn tác phẩm.', 'Access IP, browser info, OS and device fingerprinting. These are collected automatically each time you vote.'],
    ['2. Mục đích sử dụng thông tin', '2. How We Use Information'],
    ['Chúng tôi sử dụng thông tin thu thập được cho các mục đích thiết thực dưới đây:', 'We use the collected information for the practical purposes below:'],
    ['Vận hành tài khoản:', 'Account operation:'],
    ['Đăng ký, đăng nhập thành viên, khôi phục mật khẩu và cá nhân hóa trang quản lý (Dashboard).', 'Registration, member sign-in, password recovery and personalized Dashboard.'],
    ['Quản lý cuộc thi:', 'Contest management:'],
    ['Xác nhận thành viên đội thi, liên hệ các đội thi, phục vụ quá trình chấm điểm của Ban giám khảo và làm căn cứ cấp chứng nhận (Certificates) tham gia hoạt động.', 'Confirming team members, contacting teams, supporting jury scoring and issuing participation Certificates.'],
    ['Bảo vệ tính công bằng khi Bình chọn:', 'Protecting voting fairness:'],
    ['Sử dụng dữ liệu IP và mã thiết bị để phát hiện và tự động chặn các hành vi spam vote, sử dụng tài khoản ảo hoặc dùng công cụ tự động để gian lận điểm số của tác phẩm dự thi.', 'Using IP and device data to detect and block vote spam, fake accounts or automated scoring fraud.'],
    ['Liên lạc và Thông báo:', 'Communication & Notifications:'],
    ['Gửi thông tin hướng dẫn, lịch trình workshop, thông báo kết quả cuộc thi và phản hồi các thắc mắc/báo lỗi từ người dùng.', 'Sending guides, workshop schedules, contest results and responding to user questions/bug reports.'],
    ['3. Lưu trữ và Bảo mật thông tin', '3. Storage & Information Security'],
    ['Nền tảng lưu trữ:', 'Storage platform:'],
    ['Toàn bộ dữ liệu của dự án được lưu trữ và bảo mật trên nền tảng cơ sở dữ liệu Firebase (Google Cloud) với các thiết lập phân quyền nghiêm ngặt (Firebase Security Rules), ngăn chặn mọi hành vi truy cập dữ liệu trái phép từ bên ngoài.', 'All project data is stored and secured on Firebase (Google Cloud) with strict Firebase Security Rules preventing unauthorized access.'],
    ['Thời gian lưu trữ:', 'Retention period:'],
    ['Thông tin cá nhân của bạn sẽ được lưu giữ cho đến khi dự án ngừng hoạt động hoặc cho tới khi bạn gửi yêu cầu xóa bỏ tài khoản chính thức.', 'Your personal data is retained until the project stops operating or you officially request account deletion.'],
    ['Bảo vệ truyền tải:', 'Data transfer protection:'],
    ['Mọi luồng truyền tải dữ liệu giữa máy khách và máy chủ đều được mã hóa an toàn qua giao thức bảo mật HTTPS (SSL/TLS).', 'All data transferred between client and server is securely encrypted over HTTPS (SSL/TLS).'],
    ['4. Cam kết Không chia sẻ dữ liệu cho bên thứ ba', '4. Commitment Not to Share Data with Third Parties'],
    ['Chúng tôi cam kết ', 'We commit to '],
    ['không bao giờ bán, cho thuê, chia sẻ hay tiết lộ thông tin cá nhân', 'never selling, renting, sharing or disclosing your personal information'],
    [' của bạn cho bất kỳ đơn vị thứ ba nào vì mục đích thương mại hoặc tiếp thị quảng cáo.', ' to any third party for commercial or advertising purposes.'],
    ['Thông tin chỉ được chia sẻ trong phạm vi nội bộ dự án (Ban tổ chức, Ban giám khảo chấm thi) phục vụ trực tiếp cho việc vận hành cuộc thi hoặc khi có yêu cầu bằng văn bản chính thức từ cơ quan pháp luật có thẩm quyền theo quy định của pháp luật Việt Nam.', 'Information is shared only within the project (Organizing & Jury boards) to run the contest, or upon an official written request from competent authorities per Vietnamese law.'],
    ['5. Quyền lợi và Quyết định của bạn', '5. Your Rights & Choices'],
    ['Bạn hoàn toàn làm chủ thông tin cá nhân của mình trên hệ thống:', 'You fully control your personal information on the system:'],
    ['Quyền xem và cập nhật:', 'Right to view and update:'],
    ['Bạn có thể dễ dàng truy cập, thay đổi thông tin cá nhân hoặc cập nhật ảnh đại diện của mình bất kỳ lúc nào thông qua chức năng "Chỉnh sửa hồ sơ" ngay trên Dashboard cá nhân.', 'You can easily access, change personal info or update your avatar anytime via the "Edit profile" feature on your personal Dashboard.'],
    ['Quyền yêu cầu xóa tài khoản:', 'Right to request account deletion:'],
    ['Trong trường hợp không còn muốn tham gia dự án, bạn có quyền liên hệ trực tiếp với chúng tôi qua email hỗ trợ để yêu cầu xóa vĩnh viễn tài khoản cùng tất cả dữ liệu cá nhân liên quan khỏi cơ sở dữ liệu hệ thống.', 'If you no longer wish to participate, you may contact us directly via support email to request permanent deletion of your account and related personal data.'],
    ['6. Sử dụng Cookie và Công nghệ của bên thứ ba', '6. Cookies & Third-Party Technologies'],
    ['Chúng tôi sử dụng cookie phiên làm việc (Session Cookie) để giữ trạng thái đăng nhập cho bạn trên trình duyệt, giúp bạn không cần đăng nhập lại mỗi lần tải trang.', 'We use session cookies to keep your sign-in state in the browser, so you do not need to log in again on every page load.'],
    ['Hệ thống sử dụng giải pháp bảo mật **Cloudflare Turnstile** tại các biểu mẫu Đăng ký/Đăng nhập để chống spam bot và ngăn chặn tấn công giả mạo tự động.', 'The system uses **Cloudflare Turnstile** security on sign-up/sign-in forms to block bot spam and automated impersonation attacks.'],
    ['7. Thông tin liên hệ', '7. Contact Information'],
    ['Mọi câu hỏi, thắc mắc hoặc yêu cầu liên quan đến Chính sách quyền riêng tư này, vui lòng gửi về hòm thư hỗ trợ chính thức của Ban tổ chức:', 'For any questions or requests regarding this Privacy Policy, please email the official support inbox of the Organizing Board:'],
    ['Địa chỉ Email:', 'Email address:'],

    // ===== REGISTER PAGE — DYNAMIC DEPARTMENT DESCRIPTIONS =====
    ['Nhiệm vụ Ban Media:', 'Media Dept duties:'],
    ['Thiết kế poster, banner truyền thông, chỉnh sửa/edit video clip, chuẩn bị tư liệu hình ảnh và âm thanh phục vụ cho sự kiện và các ấn phẩm số của dự án.', 'Designing posters and promo banners, editing video clips, and preparing visual and audio materials for events and the project\'s digital publications.'],
    ['Nhiệm vụ Ban Duyệt Bài:', 'Review Dept duties:'],
    ['Theo dõi, đánh giá kỹ thuật và chất lượng nội dung các bài dự thi/phim ngắn được gửi về; đảm bảo tính hợp lệ bản quyền và sự tuân thủ quy chế giải đấu.', 'Monitoring and assessing the technical quality and content of submitted entries/short films; ensuring valid copyright and compliance with contest regulations.'],
    ['Nhiệm vụ Ban Nội Dung:', 'Content Dept duties:'],
    ['Lên kế hoạch bài viết, soạn thảo các văn bản chính thức (thư ngỏ, quy chế cuộc thi), xây dựng kịch bản chương trình và sáng tạo nội dung cho Website/Fanpage.', 'Planning articles, drafting official documents (open letters, contest rules), building program scripts and creating content for the Website/Fanpage.'],
    ['Nhiệm vụ Ban Nhân Sự:', 'HR Dept duties:'],
    ['Điều phối công việc của các phân ban, tổ chức các buổi họp nội bộ BTC, quản lý thông tin thành viên, làm chất xúc tác gắn kết và hỗ trợ giải quyết thắc mắc nội bộ.', 'Coordinating department work, organizing internal BTC meetings, managing member information, connecting teams and resolving internal questions.'],
    ['Nhiệm vụ Ban Truyền Thông:', 'Communications Dept duties:'],
    ['Lên chiến dịch quảng bá dự án, liên hệ hợp tác chéo với các đối tác/trường học/CLB, phát triển đối tượng tiếp cận và truyền thông giải đấu tới công chúng.', 'Planning promotion campaigns, reaching cross-collaborations with partners/schools/clubs, expanding audiences and promoting the contest to the public.'],

    // ===== REGISTER PAGE — FORM PLACEHOLDERS =====
    ['Họ và tên đầy đủ của bạn', 'Your full name'],
    ['Số điện thoại liên hệ (10 chữ số)', 'Contact phone number (10 digits)'],
    ['Kinh nghiệm của bạn, các dự án trước đây bạn từng tham gia hoặc vận hành (tối thiểu 20 ký tự)...', 'Your experience, previous projects you ran or joined (at least 20 characters)...'],
    ['Tại sao bạn muốn ứng cử vị trí President? Định hướng và giá trị bạn mong muốn mang lại cho Ý Niệm Điện Ảnh là gì (tối thiểu 30 ký tự)...', 'Why do you want to run for President? The direction and value you want to bring to Ý Niệm Điện Ảnh (at least 30 characters)...'],
    ['Kinh nghiệm, thế mạnh hoặc dự án bạn từng tham gia (tối thiểu 20 ký tự)...', 'Your experience, strengths or projects you joined (at least 20 characters)...'],
    ['Bạn muốn đồng hành và tạo giá trị gì cho Ý Niệm Điện Ảnh (tối thiểu 30 ký tự)...', 'How do you want to accompany and create value for Ý Niệm Điện Ảnh (at least 30 characters)...'],
    ['Giới thiệu bản thân và lý do tại sao bạn lựa chọn phân ban này (tối thiểu 20 ký tự)...', 'Introduce yourself and why you chose this department (at least 20 characters)...'],
    ['Tên trường học hoặc nơi công tác', 'School name or workplace'],
    ['Ví dụ: 11A1, Khoa Truyền thông, Năm 1', 'e.g. 11A1, Communications Dept, Year 1'],
    ['Nhập vai trò khác...', 'Enter another role...'],
    ['Bạn thích điện ảnh ở điểm nào? Bạn muốn tham gia dự án như thế nào?', 'What do you love about cinema? How would you like to join the project?'],
    ['Tên trường học của bạn', 'Your school name'],
    ['Giới thiệu bản thân...', 'Introduce yourself...'],
    // ============ FAQ (Trang chủ) ============
    ['💬 Câu Hỏi Thường Gặp (FAQ)', '💬 Frequently Asked Questions (FAQ)'],
    ['Giải đáp thắc mắc về hoạt động, phí tham gia và quyền lợi thành viên.', 'Answers to questions about activities, participation fees and member benefits.'],
    ['1. Ý Niệm Điện Ảnh (YNĐA) là gì?', '1. What is Ý Niệm Điện Ảnh (YNĐA)?'],
    ['2. Dự án có thu phí không? Phí tham gia được dùng làm gì?', '2. Does the project charge fees? What is the participation fee used for?'],
    ['3. Quyền lợi khi nhận Chứng nhận (Certificate) của YNĐA?', '3. What benefits come with receiving a YNĐA Certificate?'],
    ['Ý Niệm Điện Ảnh (YNĐA) là một dự án cộng đồng sáng tạo và hệ sinh thái học tập kéo dài 6 tháng dành cho học sinh, sinh viên yêu thích điện ảnh, nhiếp ảnh và phê bình nghệ thuật tại Việt Nam. Dự án tạo sân chơi công bằng để các bạn kể câu chuyện của mình qua lăng kính máy ảnh và những thước phim.', 'Ý Niệm Điện Ảnh (YNĐA) is a creative community project and a 6-month learning ecosystem for Vietnamese students who love cinema, photography and art criticism. The project creates a fair playground for you to tell your own stories through the camera lens and your films.'],
    ['Dự án cam kết minh bạch tài chính. Các sự kiện cơ bản và nộp bài dự thi thông thường đều miễn phí. Một số hoạt động đặc biệt hoặc đăng ký đội thi có thể có mức phí nhỏ (từ 5.000đ đến 20.000đ). Phí tham gia được tái đầu tư vào hoạt động của sự kiện, bao gồm giải thưởng, chứng nhận và chi phí vận hành theo kế hoạch công khai.', 'The project is committed to financial transparency. Basic events and regular contest submissions are free. Some special activities or team registration may carry a small fee (from 5,000đ to 20,000đ). Participation fees are reinvested into event activities, including prizes, certificates and operating costs under a public plan.'],
    ['Người tham gia hoàn thành các workshop chuyên đề hoặc nộp bài dự thi hợp lệ sẽ nhận được Chứng nhận tham gia (Certificate). Mỗi chứng chỉ cấp ra đều đi kèm mã số độc bản (Unique Certificate ID) giúp các bạn dễ dàng tra cứu, xác thực năng lực trực tiếp trên hệ thống Website công khai của dự án để làm đẹp hồ sơ cá nhân.', 'Participants who complete themed workshops or submit valid entries will receive a Certificate of Participation. Every certificate issued comes with a unique Certificate ID so you can easily look it up and verify your achievement directly on the project\u2019s public website to strengthen your personal profile.'],
    // ============ Footer (Trang chủ) ============
    ['Chính sách bảo mật', 'Privacy Policy'],
    ['Điều khoản dịch vụ', 'Terms of Service'],
    ['Tra cứu chứng nhận', 'Verify a Certificate'],
    ['Ý Niệm Điện Ảnh là dự án cộng đồng dành cho thế hệ trẻ. "Ghi lại những khoảnh khắc trước khi chúng trở thành ký ức." ✨', 'Ý Niệm Điện Ảnh is a community project for the younger generation. "Capturing moments before they become memories." ✨'],
    ['Phí tham gia được tái đầu tư vào hoạt động của sự kiện, bao gồm giải thưởng, chứng nhận và chi phí vận hành theo kế hoạch công khai.', 'Participation fees are reinvested into event activities, including prizes, certificates and operating costs under a public plan.'],
    // ============ Auth / Navbar (login/logout) ============
    ['Hồ sơ', 'Profile'],
    ['🔐 Khu vực nội bộ', '🔐 Private Area'],
    ['Thoát', 'Log Out'],
    // ============ Minh bạch tài chính (finance transparency) ============
    ['📊 MINH BẠCH TÀI CHÍNH', '📊 FINANCIAL TRANSPARENCY'],
    ['🏆 Quỹ giải thưởng', '🏆 Prize Fund'],
    ['⚙️ Quỹ vận hành', '⚙️ Operating Fund'],
    ['💖 Đóng góp chung', '💖 General Contribution'],
    ['Mỗi khoản đóng góp được ghi nhận theo đúng mục đích mà người đóng góp lựa chọn.', 'Every contribution is recorded to the exact purpose chosen by the donor.'],
    ['☕ Bạn muốn đồng hành cùng chúng tôi?', '☕ Want to support us?'],
    ['Đồng hành & Ủng hộ dự án', 'Support & Partner with the Project'],
    // ============ Donate modal ============
    ['💖 ĐỒNG HÀNH CÙNG YNĐA', '💖 SUPPORT YNĐA'],
    ['Ý Niệm Điện Ảnh là một dự án cộng đồng và không bắt buộc người tham gia đóng phí. Mọi đóng góp đều hoàn toàn tự nguyện và được sử dụng theo mục đích mà bạn lựa chọn.', 'Ý Niệm Điện Ảnh is a community project and participants are never required to pay fees. All contributions are completely voluntary and used for the purpose you choose.'],
    ['Bạn muốn đóng góp cho:', 'What would you like to contribute to:'],
    ['Khoản đóng góp được đưa trực tiếp vào Quỹ giải thưởng, dành cho các thí sinh và thành viên có thành tích nổi bật.', 'Your contribution goes directly into the Prize Fund, for contestants and members with outstanding achievements.'],
    ['⚙️ Vận hành dự án', '⚙️ Operating the Project'],
    ['Hỗ trợ chi phí duy trì website, máy chủ, công cụ, workshop và các chi phí cần thiết để YNĐA tiếp tục hoạt động.', 'Supports the cost of maintaining the website, servers, tools, workshops and the expenses needed to keep YNĐA running.'],
    ['💖 Tùy BTC phân bổ', '💖 At BTC\u2019s Discretion'],
    ['Cho phép BTC chủ động sử dụng khoản đóng góp cho nhu cầu phù hợp của dự án.', 'Allows the organizing committee to use your contribution for the project\u2019s needs as they see fit.'],
    ['🤝 TÀI TRỢ DỰ ÁN', '🤝 PROJECT SPONSORSHIP'],
    ['Dành cho cá nhân, tổ chức, thương hiệu muốn đồng hành ở quy mô lớn hơn.', 'For individuals, organizations and brands that want to partner on a larger scale.'],
    ['🥉 BẠC — 500.000đ', '🥉 SILVER — 500,000đ'],
    ['🥇 VÀNG — 1.000.000đ', '🥇 GOLD — 1,000,000đ'],
    ['💎 BẠCH KIM — 2.000.000đ', '💎 PLATINUM — 2,000,000đ'],
    ['👑 KIM CƯƠNG — 3.000.000đ', '👑 DIAMOND — 3,000,000đ'],
    ['✨ TÀI TRỢ ĐẶC BIỆT — Trên 3.000.000đ', '✨ SPECIAL SPONSORSHIP — Above 3,000,000đ'],
    ['BTC sẽ liên hệ trực tiếp để trao đổi về hình thức hỗ trợ và quyền lợi phù hợp.', 'The organizing committee will contact you directly to discuss the support format and suitable benefits.'],
    ['📧 Liên hệ BTC', '📧 Contact BTC'],
    ['← Quay lại', '← Go Back'],
    ['Bước 2: Số tiền đóng góp', 'Step 2: Contribution Amount'],
    ['Mục đích:', 'Purpose:'],
    ['Số tiền tài trợ:', 'Sponsorship Amount:'],
    ['Quyền lợi', 'Benefits'],
    ['Tài trợ', 'Sponsor'],
    ['🥉 BẠC', '🥉 SILVER'],
    ['🥇 VÀNG', '🥇 GOLD'],
    ['💎 BẠCH KIM', '💎 PLATINUM'],
    ['👑 KIM CƯƠNG', '👑 DIAMOND'],
    ['Vinh danh trên Website', 'Honored on the Website'],
    ['Ghi tên/nickname trên Bảng vàng', 'Name/nickname on the Hall of Fame'],
    ['Thư/giấy tri ân nhà tài trợ', 'Sponsor thank-you letter'],
    ['Tất cả quyền lợi Bạc', 'All Silver benefits'],
    ['Logo/tên hiển thị nổi bật trên Website', 'Prominent logo/name display on the Website'],
    ['Vinh danh trong nội dung tri ân', 'Honored in thank-you content'],
    ['Tất cả quyền lợi Vàng', 'All Gold benefits'],
    ['Logo/tên trên Banner Nhà đồng hành', 'Logo/name on the Partner Banner'],
    ['Vị trí hiển thị nổi bật hơn', 'More prominent display position'],
    ['Vinh danh trong tổng kết mùa', 'Honored in the season wrap-up'],
    ['Tất cả quyền lợi Bạch kim', 'All Platinum benefits'],
    ['Vị trí nổi bật trên Banner Nhà đồng hành', 'Prominent spot on the Partner Banner'],
    ['Tên/nickname/logo/avatar theo lựa chọn', 'Name/nickname/logo/avatar of your choice'],
    ['Vinh danh nổi bật trong tổng kết', 'Prominently honored in the wrap-up'],
    ['Thư/giấy tri ân đặc biệt', 'Special thank-you letter'],
    ['🤝 Tài trợ dự án', '🤝 Sponsor the Project'],
    // ============ Dashboard sidebar (TABS) ============
    ['Hồ sơ của tôi', 'My Profile'],
    ['Thay frame', 'Change Frame'],
    ['Quản lý sự kiện', 'Manage Events'],
    ['Đơn tuyển & Nhân sự', 'Applications & Staff'],
    ['Bảng Thông báo', 'Announcements'],
    ['Sổ tay Tài chính', 'Finance Ledger'],
    ['Giao dịch & Quỹ', 'Transactions & Funds'],
    ['Feedback & Báo lỗi', 'Feedback & Bug Reports'],
    ['Thư viện Tài liệu', 'Document Library'],
    ['Quản lý Bài dự thi', 'Manage Submissions'],
    ['Quản lý tài khoản', 'Account Management'],
    ['📧 Gửi email', '📧 Send Email'],
    ['📧 Gửi email hàng loạt', '📧 Send Bulk Emails'],
    ['📨 Gửi email hàng loạt', '📨 Send Bulk Emails'],
    ['📝 Chấm điểm & đánh giá', '📝 Scoring & Review'],
    ['Chấm điểm & đánh giá', 'Scoring & Review'],
    ['Bảng xếp hạng', 'Leaderboard'],
    ['Khu vực nội bộ', 'Private Area'],
    // ============ Dashboard overview stats ============
    ['📊 Tổng quan vận hành', '📊 Operations Overview'],
    // ============ Voting portal config (dashboard) ============
    ['⏰ Cấu hình cổng bình chọn', '⏰ Voting Portal Settings'],
    ['💾 Lưu cấu hình', '💾 Save Settings'],
    // ============ Dashboard admin / data panel ============
    ['🗄️ Quan tri du lieu', '🗄️ Data Management'],
    ['📤 Xuat tat ca du lieu (JSON)', '📤 Export All Data (JSON)'],
    ['📤 Xuat nguoi dung (CSV)', '📤 Export Users (CSV)'],
    ['📤 Xuat su kien (CSV)', '📤 Export Events (CSV)'],
    ['📤 Xuat cong viec (CSV)', '📤 Export Tasks (CSV)'],
    ['📥 Nhap du lieu tu file', '📥 Import Data from File'],
    ['🔧 Bat bao tri', '🔧 Enable Maintenance'],
    ['🔓 Tat bao tri', '🔓 Disable Maintenance'],
    ['⚠️ Cleanup role sai', '⚠️ Cleanup invalid roles'],
    // ============ Internal announcements ============
    ['📢 Bảng tin nội bộ mới nhất', '📢 Latest Internal Announcements'],
    ['Bảng tin nội bộ mới nhất', 'Latest Internal Announcements'],
    ['Chưa có thông báo nào.', 'No announcements yet.'],
    // ============ Feedback FAB ============
    ['Góp ý / báo lỗi', 'Feedback / Report Bug'],
    ['Góp ý và báo lỗi', 'Feedback and bug reports'],
    // ============ Rules: Fair Device Classification ============
    ['Hạng mục Ống Kính Di Động (Mobile):', 'Mobile Lens Category:'],
    ['Hạng mục Ống Kính Điện Ảnh (Camera):', 'Camera Lens Category:'],
    ['Dành riêng cho phim quay bằng điện thoại, độ phân giải tối thiểu 1080p. Khuyến khích sự sáng tạo không giới hạn thiết bị.', 'Exclusively for films shot on phones, minimum 1080p resolution. Creativity is encouraged without device limits.'],
    ['Dành cho máy ảnh, máy quay chuyên dụng (Mirrorless, DSLR...). Yêu cầu kỹ thuật tối thiểu 1080p, khuyến khích 4K.', 'For cameras and dedicated camcorders (Mirrorless, DSLR...). Minimum 1080p requirement, 4K encouraged.'],
    ['Thời lượng tác phẩm:', 'Film Duration:'],
    ['Từ 3 đến 7 phút (tính cả credit đầu/cuối), nộp bài qua liên kết Drive hoặc Youtube ẩn.', '3 to 7 minutes (including opening/closing credits), submitted via a Drive link or unlisted YouTube.'],
    ['Điểm đánh giá các tác phẩm dự thi được quyết định 100% bằng lượt **Bình chọn trực tuyến** từ cộng đồng.', 'Contest entries are scored 100% by **Online Voting** from the community.'],
    ['Để đảm bảo tính công bằng tối đa và tránh gian lận vote, hệ thống tích hợp công nghệ quét địa chỉ IP và mã thiết bị đặc biệt. Mỗi địa chỉ IP hoặc thiết bị chỉ được bình chọn 1 lần duy nhất cho mỗi tác phẩm.', 'To ensure maximum fairness and prevent vote fraud, the system integrates IP address and device fingerprint scanning. Each IP address or device may vote only once per entry.']
  ];

  // ---------------------------------------------------------------------------
  // CORE i18n LOGIC
  // ---------------------------------------------------------------------------
  let currentLang = (function () {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') return saved;
    } catch (_) {}
    return DEFAULT_LANG;
  })();

  function t(key, fallback = '') {
    const dict = DICTIONARY[currentLang] || DICTIONARY[DEFAULT_LANG];
    if (dict && dict[key] !== undefined) return dict[key];
    return fallback || key;
  }

  function getLanguage() {
    return currentLang;
  }

  // Sorted phase pairs for the active language direction. Longer phrases are
  // replaced first so a shorter substring (e.g. "Đăng nhập") never corrupts a
  // longer phrase (e.g. "Đăng nhập bằng Google") before it is processed.
  let _pairsCache = null;
  function getSortedPairs() {
    if (_pairsCache) return _pairsCache;
    const isEn = currentLang === 'en';
    const raw = isEn ? PHRASE_PAIRS : PHRASE_PAIRS.map(([vi, en]) => [en, vi]);
    _pairsCache = raw.slice().sort((a, b) => b[0].length - a[0].length);
    return _pairsCache;
  }

  function setLanguage(lang, silent = false) {
    if (lang !== 'vi' && lang !== 'en') lang = DEFAULT_LANG;
    currentLang = lang;
    _pairsCache = null;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem('ynda_gantt_lang', lang);
    } catch (_) {}

    // Update HTML lang attribute
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);

    // Apply translations across all tagged elements
    applyTranslations();

    // Update Language Toggle buttons everywhere
    updateLanguageButtons();

    // Dispatch global event for specific components (e.g., Gantt Chart, Canvas, etc.)
    window.dispatchEvent(new CustomEvent('ynda:lang-changed', { detail: { lang } }));

    // Show toast if available and not silent
    if (!silent && typeof window.toast === 'function') {
      window.toast(t('toast_lang_switched'));
    }
  }

  function toggleLanguage() {
    setLanguage(currentLang === 'vi' ? 'en' : 'vi');
  }

  // ---------------------------------------------------------------------------
  // AUTO TRANSLATION OF DOM ELEMENTS
  // ---------------------------------------------------------------------------
  function applyTranslations() {
    const dict = DICTIONARY[currentLang] || DICTIONARY.vi;

    // 1. Elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = dict[key];
        } else {
          el.innerHTML = dict[key];
        }
      }
    });

    // 2. Elements with data-i18n-ph (placeholder)
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key]) el.placeholder = dict[key];
    });

    // 3. Elements with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key]) el.title = dict[key];
    });

    // 4. Update Navigation links & Top ecosystem bar
    updateEcosystemNav(dict);

    // 5. Update Sidebar navigation if present
    updateSidebarNav(dict);

    // 6. Perform intelligent phrase replacements across text nodes
    translateTextNodes();

    // 6b. Translate form placeholders & titles via phrase map
    translateElementAttributes(document.body);

    // 7. Update Gantt Chart if active on page
    if (typeof window.setGanttLang === 'function') {
      window.setGanttLang(currentLang);
    }
  }

  function updateEcosystemNav(dict) {
    const ecoLinks = document.querySelectorAll('.eco-links a, nav .links a');
    ecoLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim();
      if (href === '/' || href.includes('index.html') || text.includes('Trang chủ') || text.includes('Home')) {
        a.textContent = dict.nav_home || '🏠 Home';
      } else if (href.includes('/ynda') || href.includes('ynda.html') || text.includes('Nhiệm Vụ') || text.includes('Missions')) {
        a.textContent = dict.nav_missions || '⚡ Missions';
      } else if (href.includes('/bang-xep-hang') || text.includes('Bảng Xếp Hạng') || text.includes('Leaderboard')) {
        a.textContent = dict.nav_ranking || '🏆 Leaderboard';
      } else if (href.includes('/ban-to-chuc') || text.includes('Ban Tổ Chức') || text.includes('Organizing')) {
        a.textContent = dict.nav_organizers || '💼 Organizing Board';
      } else if (href.includes('/cham-diem') || text.includes('Chấm Điểm') || text.includes('Scoring')) {
        a.textContent = dict.nav_grading || '📝 Scoring';
      } else if (href.includes('/vinh-danh') || text.includes('Vinh Danh') || text.includes('Honors')) {
        a.textContent = dict.nav_honors || '🎖️ Hall of Fame';
      } else if (href.includes('/verify') || text.includes('Chứng nhận') || text.includes('Verification')) {
        a.textContent = dict.nav_verify || '🎖️ Verification';
      }
    });
  }

  function updateSidebarNav(dict) {
    const navMap = {
      dashboard: dict.nav_dashboard,
      board: dict.nav_board,
      gantt: dict.nav_gantt,
      mine: dict.nav_mine,
      leaderboard: dict.nav_leaderboard,
      review: dict.nav_review,
      ledger: dict.nav_ledger,
      team: dict.nav_team,
      'role-review': dict.nav_role_review,
      tools: dict.nav_tools
    };

    document.querySelectorAll('.sidebar .nav').forEach(btn => {
      const page = btn.dataset.page;
      if (page && navMap[page]) {
        const badge = btn.querySelector('.nav-badge');
        const badgeHtml = badge ? badge.outerHTML : '';
        const ico = btn.querySelector('.ico')?.textContent || '';
        btn.innerHTML = `<span class="ico">${ico}</span>${navMap[page].replace(/^[^\s]+\s*/, '')} ${badgeHtml}`;
      }
    });

    const labels = document.querySelectorAll('.sidebar .nav-label');
    if (labels.length >= 2) {
      labels[0].textContent = dict.nav_workspace_label;
      labels[1].textContent = dict.nav_admin_label;
    }
  }

function translateTextNodes() {
    const isEn = currentLang === 'en';
    const pairs = getSortedPairs();

    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('.ynda-global-lang-switch') || parent.closest('.gantt-lang-toggle')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      let val = node.nodeValue;
      if (!val || !val.trim()) return;

      pairs.forEach(([fromText, toText]) => {
        if (val.includes(fromText)) {
          val = val.split(fromText).join(toText);
        }
      });

      if (node.nodeValue !== val) {
        node.nodeValue = val;
      }
    });
  }

  // Translate placeholder/title attributes via the same phrase map.
  // Used so form inputs and tooltips on any page follow the selected language.
  function translateElementAttributes(rootNode) {
    if (!rootNode) return;
    const pairs = getSortedPairs();
    const targets = rootNode.querySelectorAll
      ? rootNode.querySelectorAll('[placeholder], [title], [aria-label]')
      : [];

    targets.forEach(el => {
      ['placeholder', 'title', 'aria-label'].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        let val = el.getAttribute(attr);
        if (!val || !val.trim()) return;
        let updated = val;
        pairs.forEach(([fromText, toText]) => {
          if (updated.includes(fromText)) {
            updated = updated.split(fromText).join(toText);
          }
        });
        if (updated !== val) el.setAttribute(attr, updated);
      });
    });
  }

  function updateLanguageButtons() {
    document.querySelectorAll('.ynda-lang-btn, .gantt-lang-btn, .lang-switch-btn').forEach(btn => {
      const l = btn.getAttribute('data-lang') || (btn.id?.includes('En') ? 'en' : 'vi');
      btn.classList.toggle('active', l === currentLang);
    });
  }

  // ---------------------------------------------------------------------------
  // AUTO-INJECT GLOBAL LANGUAGE SWITCHER IN ALL NAVBARS
  // ---------------------------------------------------------------------------
  function buildLangSwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'ynda-global-lang-switch';
    switcher.innerHTML = `
      <button type="button" class="ynda-lang-btn ${currentLang === 'vi' ? 'active' : ''}" data-lang="vi" onclick="window.YNDA_i18n.setLanguage('vi')">
        🇻🇳 VN
      </button>
      <button type="button" class="ynda-lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="window.YNDA_i18n.setLanguage('en')">
        🇬🇧 EN
      </button>
    `;
    return switcher;
  }

  function injectGlobalLangSwitchers() {
    // Only ever inject a single switcher per page.
    if (document.querySelector('.ynda-global-lang-switch')) return;

    const navContainers = document.querySelectorAll('.eco-nav, nav, .topbar, header');
    let injected = false;

    navContainers.forEach(container => {
      if (container.querySelector('.ynda-global-lang-switch')) return;

      const switcher = buildLangSwitcher();
      // Target placement: insert into links group or actions
      const targetGroup = container.querySelector('.eco-links') ||
                          container.querySelector('.links') ||
                          container.querySelector('.actions') ||
                          container;
      targetGroup.appendChild(switcher);
      injected = true;
    });

    // Fallback: pages without a navbar (register, terms, privacy...) get a
    // floating switcher fixed to the top-right so the toggle is always visible.
    if (!injected) {
      const floating = buildLangSwitcher();
      floating.classList.add('ynda-float-lang-switch');
      document.body.appendChild(floating);
    }
  }

  // ---------------------------------------------------------------------------
  // STYLES INJECTION FOR GLOBAL LANGUAGE SWITCHER
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('ynda-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'ynda-i18n-styles';
    style.textContent = `
      .ynda-global-lang-switch {
        display: inline-flex;
        align-items: center;
        background: #090a10;
        border: 1px solid rgba(228, 184, 102, 0.3);
        border-radius: 20px;
        padding: 2px 4px;
        gap: 2px;
        user-select: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        margin-left: 8px;
      }
      .ynda-global-lang-switch.ynda-float-lang-switch {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 99999;
        margin-left: 0;
        box-shadow: 0 6px 20px rgba(0,0,0,0.45);
      }
      @media (max-width: 600px) {
        .ynda-global-lang-switch.ynda-float-lang-switch {
          top: 10px;
          right: 10px;
          z-index: 99999;
        }
      }
      .ynda-lang-btn {
        background: transparent;
        border: none;
        color: #8f93a7;
        padding: 4px 9px;
        font-size: 11.5px;
        font-weight: 600;
        font-family: 'DM Mono', monospace, -apple-system, sans-serif;
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.18s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        line-height: 1;
      }
      .ynda-lang-btn:hover {
        color: #fff;
        background: rgba(255,255,255,0.06);
      }
      .ynda-lang-btn.active {
        background: linear-gradient(135deg, #e4b866, #b8863c);
        color: #080911 !important;
        font-weight: 800;
        box-shadow: 0 2px 8px rgba(228,184,102,0.35);
      }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION ON DOM READY + MUTATION OBSERVER FOR DYNAMIC CONTENT
  // ---------------------------------------------------------------------------
  let _mutationTimer = null;

  function translateSubtree(rootNode) {
    if (!rootNode || rootNode.nodeType !== 1) return;
    const pairs = getSortedPairs();

    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('.ynda-global-lang-switch') || parent.closest('.gantt-lang-toggle')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      let val = node.nodeValue;
      if (!val || !val.trim()) return;

      pairs.forEach(([fromText, toText]) => {
        if (val.includes(fromText)) {
          val = val.split(fromText).join(toText);
        }
      });

      if (node.nodeValue !== val) {
        node.nodeValue = val;
      }
    });

    translateElementAttributes(rootNode);
  }

  function startMutationObserver() {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver(mutations => {
      // Debounce: batch translate after mutations settle
      if (_mutationTimer) clearTimeout(_mutationTimer);
      _mutationTimer = setTimeout(() => {
        // Re-inject the switcher if a nav re-render (e.g. login/logout) wiped it.
        // Guarded internally so it never duplicates.
        injectGlobalLangSwitchers();

        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              translateSubtree(node);
            } else if (node.nodeType === 3) {
              // Single text node added
              const parent = node.parentElement;
              if (parent) translateSubtree(parent);
            }
          });
        });
      }, 80);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    injectStyles();
    injectGlobalLangSwitchers();
    applyTranslations();
    startMutationObserver();

    // Delayed secondary pass: catch content rendered by async scripts
    // (e.g. Firebase data, AJAX calls that populate event lists, about cards, etc.)
    setTimeout(() => applyTranslations(), 800);
    setTimeout(() => applyTranslations(), 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export to global scope
  window.YNDA_i18n = {
    t,
    getLanguage,
    setLanguage,
    toggleLanguage,
    applyTranslations,
    DICTIONARY
  };

})(window, document);
