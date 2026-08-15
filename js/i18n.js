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
  // ---------------------------------------------------------------------------
  const PHRASE_PAIRS = [
    // Brand & Header
    ['Ý Niệm Điện Ảnh', 'Cinematic Concept'],
    ['MÙA 01 · NHIỆM VỤ', 'SEASON 01 · MISSIONS'],
    ['Cộng đồng điện ảnh', 'Film community'],
    ['Trang chủ', 'Home'],
    ['Về dự án', 'About Us'],
    ['Sự kiện', 'Events'],
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

    // Hero
    ['DỰ ÁN ĐIỆN ẢNH HỌC ĐƯỜNG MÙA 01', 'STUDENT FILMMAKING PROJECT · SEASON 01'],
    ['Nơi Ý Tưởng Cất Cánh', 'Where Ideas Take Flight'],
    ['Đăng ký tham gia', 'Apply to Join'],
    ['Tìm hiểu dự án', 'Explore Project'],
    ['Khởi động & Tuyển BTC', 'Launch & Recruitment'],
    ['Đồng kiến tạo cộng đồng điện ảnh', 'Co-creating film community'],
    ['Giai đoạn', 'Current Stage'],
    ['Cơ hội', 'Opportunity'],

    // Channels
    ['Tất cả các kênh', 'All Channels'],
    ['Tất cả kênh', 'All Channels'],
    ['KÊNH CHÍNH', 'MAIN CHANNEL'],
    ['KÊNH PHỤ', 'SECONDARY CHANNEL'],
    ['Kênh Chính', 'Main Channel'],
    ['Kênh Phụ', 'Secondary Channel'],

    // Depts
    ['Ban Media', 'Media Dept'],
    ['Ban Truyền thông', 'Communications Dept'],
    ['Ban Nội dung', 'Content Dept'],
    ['Ban Nhân sự', 'HR & Operations Dept'],
    ['Ban Duyệt bài', 'Quality Review Dept'],
    ['Ban Cố vấn', 'Advisory Board'],
    ['Ban Cố vấn chuyên môn', 'Expert Advisory Board'],
    ['Toàn dự án / Kênh', 'Global / Channel'],
    ['Toàn dự án', 'Global / Project-wide'],

    // Statuses
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

    // Dashboard & Metrics
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
    ['Bảng vinh danh thành viên minh bạch', 'Transparent Member Recognition'],
    ['Bảng xếp hạng cống hiến', 'Contribution Leaderboard'],
    ['Tổng sắp toàn dự án', 'Overall Ranking'],
    ['Ban điều hành & Core', 'Core & Executives'],
    ['Thành viên', 'Members'],
    ['Xếp hạng theo tháng', 'Monthly Ranking']
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

  function setLanguage(lang, silent = false) {
    if (lang !== 'vi' && lang !== 'en') lang = DEFAULT_LANG;
    currentLang = lang;
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
    const pairs = isEn ? PHRASE_PAIRS : PHRASE_PAIRS.map(([vi, en]) => [en, vi]);

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

  function updateLanguageButtons() {
    document.querySelectorAll('.ynda-lang-btn, .gantt-lang-btn, .lang-switch-btn').forEach(btn => {
      const l = btn.getAttribute('data-lang') || (btn.id?.includes('En') ? 'en' : 'vi');
      btn.classList.toggle('active', l === currentLang);
    });
  }

  // ---------------------------------------------------------------------------
  // AUTO-INJECT GLOBAL LANGUAGE SWITCHER IN ALL NAVBARS
  // ---------------------------------------------------------------------------
  function injectGlobalLangSwitchers() {
    const navContainers = document.querySelectorAll('.eco-nav, nav, .topbar, header');
    if (!navContainers.length) return;

    navContainers.forEach(container => {
      if (container.querySelector('.ynda-global-lang-switch')) return;

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

      // Target placement: insert into links group or actions
      const targetGroup = container.querySelector('.eco-links') || 
                          container.querySelector('.links') || 
                          container.querySelector('.actions') || 
                          container;
      targetGroup.appendChild(switcher);
    });
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
  // INITIALIZATION ON DOM READY
  // ---------------------------------------------------------------------------
  function init() {
    injectStyles();
    injectGlobalLangSwitchers();
    applyTranslations();
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
