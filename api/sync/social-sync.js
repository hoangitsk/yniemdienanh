const SOCIAL_POSTS_FILE = require('path').join(__dirname, '..', '..', 'social-posts.json');
const fs = require('fs');

let cachedPosts = [];
function loadPosts() {
    if (fs.existsSync(SOCIAL_POSTS_FILE)) {
        try { cachedPosts = JSON.parse(fs.readFileSync(SOCIAL_POSTS_FILE, 'utf-8')); } catch (e) { cachedPosts = []; }
    }
    return cachedPosts;
}
function savePosts() {
    fs.writeFileSync(SOCIAL_POSTS_FILE, JSON.stringify(cachedPosts, null, 2), 'utf-8');
}

// Normalize a post from any platform into unified format
function normalizePost(platform, raw) {
    const base = {
        id: platform + '-' + (raw.id || raw.postId || Date.now()),
        platform,
        syncedAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
    };
    switch (platform) {
        case 'youtube':
            return {
                ...base,
                platformPostId: raw.id?.videoId || raw.id || raw.snippet?.resourceId?.videoId || '',
                title: raw.snippet?.title || raw.title || '',
                description: raw.snippet?.description || raw.description || '',
                url: raw.url || (raw.id?.videoId ? `https://www.youtube.com/watch?v=${raw.id.videoId}` : ''),
                embedUrl: raw.id?.videoId ? `https://www.youtube.com/embed/${raw.id.videoId}` : '',
                thumbnailUrl: raw.snippet?.thumbnails?.high?.url || raw.snippet?.thumbnails?.medium?.url || raw.snippet?.thumbnails?.default?.url || '',
                authorName: raw.snippet?.channelTitle || '',
                authorAvatar: '',
                publishedAt: raw.snippet?.publishedAt || '',
                mediaType: 'video',
            };
        case 'instagram':
            return {
                ...base,
                platformPostId: raw.id || '',
                title: '',
                description: raw.caption || raw.description || '',
                url: raw.permalink || raw.url || '',
                embedUrl: '',
                thumbnailUrl: raw.media_url || raw.thumbnailUrl || raw.mediaUrl || '',
                authorName: raw.username || raw.authorName || '',
                authorAvatar: '',
                publishedAt: raw.timestamp || raw.publishedAt || '',
                mediaType: raw.media_type === 'VIDEO' || raw.mediaType === 'video' ? 'video' : 'image',
            };
        case 'tiktok':
            return {
                ...base,
                platformPostId: raw.id || raw.postId || '',
                title: raw.title || raw.desc || '',
                description: raw.desc || raw.description || '',
                url: raw.share_url || raw.url || (raw.id ? `https://www.tiktok.com/@${raw.author?.unique_id || 'user'}/video/${raw.id}` : ''),
                embedUrl: raw.id ? `https://www.tiktok.com/embed/v2/${raw.id}` : '',
                thumbnailUrl: raw.cover_image_url || raw.cover || raw.thumbnailUrl || raw.video?.cover?.url_list?.[0] || '',
                authorName: raw.author?.nickname || raw.author?.unique_id || raw.authorName || '',
                authorAvatar: raw.author?.avatar_url || raw.authorAvatar || '',
                publishedAt: raw.create_time || raw.publishedAt || '',
                mediaType: 'video',
            };
        default:
            return { ...base, ...raw };
    }
}

// --- YouTube Data API v3 ---
async function syncYouTube(config) {
    const { apiKey, channelId, channelHandle } = config;
    if (!apiKey) { console.warn('[SocialSync] YouTube: missing apiKey'); return []; }
    const id = channelId || channelHandle || '';
    if (!id) { console.warn('[SocialSync] YouTube: missing channelId/handle'); return []; }

    // First get channel uploads playlist
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${id}&part=snippet,id&order=date&maxResults=20&type=video`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (data.error) {
        console.error('[SocialSync] YouTube API error:', data.error.message || JSON.stringify(data.error));
        return [];
    }
    const items = data.items || [];
    return items.map(item => normalizePost('youtube', item));
}

// --- Instagram Basic Display API ---
async function syncInstagram(config) {
    const { accessToken, userId } = config;
    if (!accessToken) { console.warn('[SocialSync] Instagram: missing accessToken'); return []; }
    const uid = userId || 'me';
    const url = `https://graph.instagram.com/${uid}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username&access_token=${accessToken}&limit=20`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
        console.error('[SocialSync] Instagram API error:', data.error.message || JSON.stringify(data.error));
        return [];
    }
    const items = data.data || [];
    return items.map(item => normalizePost('instagram', item));
}

// --- TikTok API v2 ---
async function syncTikTok(config) {
    const { accessToken, openId } = config;
    if (!accessToken || !openId) { console.warn('[SocialSync] TikTok: missing accessToken or openId'); return []; }
    const url = 'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,create_time,share_url,video_description,author';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20 }),
    });
    const data = await res.json();
    if (data.error) {
        console.error('[SocialSync] TikTok API error:', JSON.stringify(data.error));
        return [];
    }
    const items = data.data?.videos || [];
    return items.map(item => normalizePost('tiktok', item));
}

// Main sync function
async function syncAll(config) {
    const allPosts = [];
    const errors = [];

    // YouTube
    if (config.youtube?.enabled) {
        try {
            const posts = await syncYouTube(config.youtube);
            allPosts.push(...posts.map(p => ({ ...p, syncedAt: new Date().toISOString() })));
            console.log(`[SocialSync] YouTube: synced ${posts.length} posts`);
        } catch (e) { errors.push({ platform: 'youtube', error: e.message }); console.error('[SocialSync] YouTube sync error:', e.message); }
    }

    // Instagram
    if (config.instagram?.enabled) {
        try {
            const posts = await syncInstagram(config.instagram);
            allPosts.push(...posts.map(p => ({ ...p, syncedAt: new Date().toISOString() })));
            console.log(`[SocialSync] Instagram: synced ${posts.length} posts`);
        } catch (e) { errors.push({ platform: 'instagram', error: e.message }); console.error('[SocialSync] Instagram sync error:', e.message); }
    }

    // TikTok
    if (config.tiktok?.enabled) {
        try {
            const posts = await syncTikTok(config.tiktok);
            allPosts.push(...posts.map(p => ({ ...p, syncedAt: new Date().toISOString() })));
            console.log(`[SocialSync] TikTok: synced ${posts.length} posts`);
        } catch (e) { errors.push({ platform: 'tiktok', error: e.message }); console.error('[SocialSync] TikTok sync error:', e.message); }
    }

    // Merge with existing: deduplicate by platform+platformPostId
    const existing = loadPosts();
    const existingKeys = new Set(existing.map(p => p.platform + ':' + p.platformPostId));
    for (const p of allPosts) {
        const key = p.platform + ':' + p.platformPostId;
        if (!existingKeys.has(key)) {
            existing.push(p);
            existingKeys.add(key);
        }
    }
    // Sort newest first
    existing.sort((a, b) => (b.publishedAt || b.syncedAt || '').localeCompare(a.publishedAt || a.syncedAt || ''));
    cachedPosts = existing;
    savePosts();

    // Also save to Firestore if available
    if (config._db) {
        try {
            for (const p of allPosts) {
                await config._db.collection('social_posts').doc(p.id).set(p, { merge: true });
            }
            console.log(`[SocialSync] Saved ${allPosts.length} posts to Firestore`);
        } catch (e) { console.warn('[SocialSync] Firestore save skipped:', e.message); }
    }

    return { synced: allPosts.length, total: cachedPosts.length, errors };
}

function getPosts(limit) {
    const posts = loadPosts();
    return limit ? posts.slice(0, limit) : posts;
}

module.exports = { syncAll, getPosts, normalizePost, loadPosts };